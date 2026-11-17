import {
  DEFAULT_LEAKAGE_THRESHOLDS,
  LeakageAuditResult,
  LeakageThresholds,
  ReferenceText,
} from './types';
import {
  charNgramJaccard,
  normalizeForComparison,
  normalizedLevenshteinDistance,
  wordJaccard,
} from './normalization';

export interface LeakageAuditInput {
  queryText: string;
  references: ReferenceText[];
  frozenE5CosineByReferenceId?: Readonly<Record<string, number>>;
  heldOutIntentFlag?: boolean;
  requiresHumanReview?: boolean;
  requireSemanticCheck?: boolean;
  thresholds?: Partial<LeakageThresholds>;
}

interface ReferenceComparison {
  referenceId: string;
  exact: boolean;
  substring: boolean;
  wordJaccard: number;
  charTrigramJaccard: number;
  normalizedLevenshteinDistance: number;
  frozenE5Cosine: number | null;
}

function resolveThresholds(overrides?: Partial<LeakageThresholds>): LeakageThresholds {
  return { ...DEFAULT_LEAKAGE_THRESHOLDS, ...overrides };
}

function validateThresholds(thresholds: LeakageThresholds): void {
  for (const [name, value] of Object.entries(thresholds)) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(`Invalid leakage threshold ${name}: ${value}`);
    }
  }

  if (
    thresholds.reviewFrozenE5CosineAtOrAbove > thresholds.rejectFrozenE5CosineAbove
  ) {
    throw new Error('Semantic review threshold cannot exceed the rejection threshold.');
  }
}

function compareReference(
  queryText: string,
  reference: ReferenceText,
  cosineByReferenceId?: Readonly<Record<string, number>>
): ReferenceComparison {
  const query = normalizeForComparison(queryText);
  const candidate = normalizeForComparison(reference.text);
  const semanticScore = cosineByReferenceId?.[reference.id];

  if (semanticScore !== undefined && (!Number.isFinite(semanticScore) || semanticScore < -1 || semanticScore > 1)) {
    throw new Error(`Invalid cosine score for ${reference.id}: ${semanticScore}`);
  }

  return {
    referenceId: reference.id,
    exact: query.length > 0 && query === candidate,
    substring:
      query.length > 0 &&
      candidate.length > 0 &&
      (query.includes(candidate) || candidate.includes(query)),
    wordJaccard: wordJaccard(query, candidate),
    charTrigramJaccard: charNgramJaccard(query, candidate),
    normalizedLevenshteinDistance: normalizedLevenshteinDistance(query, candidate),
    frozenE5Cosine: semanticScore ?? null,
  };
}

function chooseClosestReference(comparisons: ReferenceComparison[]): string | null {
  if (comparisons.length === 0) return null;

  return comparisons.reduce((best, current) => {
    const bestScore = Math.max(
      best.wordJaccard,
      best.charTrigramJaccard,
      1 - best.normalizedLevenshteinDistance,
      best.frozenE5Cosine ?? -1
    );
    const currentScore = Math.max(
      current.wordJaccard,
      current.charTrigramJaccard,
      1 - current.normalizedLevenshteinDistance,
      current.frozenE5Cosine ?? -1
    );
    return currentScore > bestScore ? current : best;
  }).referenceId;
}

export function auditQueryLeakage(input: LeakageAuditInput): LeakageAuditResult {
  const thresholds = resolveThresholds(input.thresholds);
  validateThresholds(thresholds);

  if (!normalizeForComparison(input.queryText)) {
    throw new Error('Query text must not be empty.');
  }
  if (input.references.length === 0) {
    throw new Error('At least one protected reference is required.');
  }

  const comparisons = input.references.map((reference) =>
    compareReference(input.queryText, reference, input.frozenE5CosineByReferenceId)
  );

  const exactMatchFound = comparisons.some((item) => item.exact);
  const substringMatchFound = comparisons.some((item) => item.substring);
  const maxWordJaccard = Math.max(...comparisons.map((item) => item.wordJaccard));
  const maxCharTrigramJaccard = Math.max(
    ...comparisons.map((item) => item.charTrigramJaccard)
  );
  const minNormalizedLevenshteinDistance = Math.min(
    ...comparisons.map((item) => item.normalizedLevenshteinDistance)
  );
  const suppliedCosines = comparisons
    .map((item) => item.frozenE5Cosine)
    .filter((value): value is number => value !== null);
  const maxFrozenE5Cosine =
    suppliedCosines.length > 0 ? Math.max(...suppliedCosines) : null;
  const heldOutIntentFlag = input.heldOutIntentFlag ?? false;
  const requiresHumanReview = input.requiresHumanReview ?? false;
  const requireSemanticCheck = input.requireSemanticCheck ?? true;
  const reasons: string[] = [];

  if (exactMatchFound) reasons.push('exact_match');
  if (substringMatchFound) reasons.push('substring_match');
  if (maxWordJaccard > thresholds.maxWordJaccard) reasons.push('word_jaccard_above_limit');
  if (maxCharTrigramJaccard > thresholds.maxCharTrigramJaccard) {
    reasons.push('char_trigram_jaccard_above_limit');
  }
  if (
    minNormalizedLevenshteinDistance < thresholds.minNormalizedLevenshteinDistance
  ) {
    reasons.push('normalized_levenshtein_below_limit');
  }
  if (heldOutIntentFlag) reasons.push('held_out_intent');
  if (
    maxFrozenE5Cosine !== null &&
    maxFrozenE5Cosine > thresholds.rejectFrozenE5CosineAbove
  ) {
    reasons.push('frozen_e5_cosine_above_limit');
  }

  const rejectReasons = new Set([
    'exact_match',
    'substring_match',
    'word_jaccard_above_limit',
    'char_trigram_jaccard_above_limit',
    'normalized_levenshtein_below_limit',
    'held_out_intent',
    'frozen_e5_cosine_above_limit',
  ]);

  let decision: LeakageAuditResult['decision'];
  if (reasons.some((reason) => rejectReasons.has(reason))) {
    decision = 'rejected';
  } else if (requireSemanticCheck && suppliedCosines.length !== comparisons.length) {
    reasons.push('semantic_check_missing');
    decision = 'incomplete';
  } else if (requiresHumanReview || (
    maxFrozenE5Cosine !== null &&
    maxFrozenE5Cosine >= thresholds.reviewFrozenE5CosineAtOrAbove
  )) {
    reasons.push(requiresHumanReview
      ? 'held_out_vocabulary_requires_human_review'
      : 'frozen_e5_cosine_requires_human_review');
    decision = 'human_review';
  } else {
    decision = 'passed';
  }

  return {
    exactMatchFound,
    substringMatchFound,
    maxWordJaccard,
    maxCharTrigramJaccard,
    minNormalizedLevenshteinDistance,
    maxFrozenE5Cosine,
    closestReferenceId: chooseClosestReference(comparisons),
    heldOutIntentFlag,
    decision,
    reasons,
  };
}
