import { z } from 'zod';
import { validateEvidence } from './evidence';
import { EvidenceQuoteSchema } from './request-contracts';
import { RelevanceScoreSchema, type RelevanceScore } from './types';

const ReviewSchema = z.object({
  reviewerId: z.string().min(1),
  relevanceScore: RelevanceScoreSchema,
  evidenceQuotes: z.array(EvidenceQuoteSchema),
  rationale: z.string().min(10),
}).strict();

export const JUDGE_SELECTION_REFERENCE_SIZE = 50;
export const JUDGE_SELECTION_MINIMUM_PER_GRADE = 8;
export const JUDGE_SELECTION_EXPECTED_LABEL_COUNTS = [17, 9, 8, 16] as const;
export const JUDGE_SELECTION_EXPECTED_LANGUAGE_STRATA = {
  en_query_vi_lyrics: 25,
  vi_query_vi_lyrics: 25,
} as const;

export const JudgeSelectionPairSchema = z.object({
  pairId: z.string().min(1),
  sourceQueryId: z.string().min(1),
  originalSourceQueryId: z.string().min(1),
  sourceTopicId: z.string().regex(/^T\d{2}$/).nullable(),
  split: z.literal('development_only'),
  languageStratum: z.enum(['en_query_vi_lyrics', 'vi_query_vi_lyrics']),
  difficultTheologicalDistinction: z.string().min(1),
  distinctionTag: z.string().regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/),
  queryText: z.string().min(1),
  candidate: z.object({
    sourceSectionId: z.string().min(1),
    candidateAlias: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
    sectionType: z.string().min(1),
    lyrics: z.string().min(1),
    textProvenance: z.enum(['exact_corpus_section', 'versioned_text_correction_v1']),
  }).strict(),
  humanReference: z.object({
    initialReviews: z.tuple([ReviewSchema, ReviewSchema]),
    adjudication: ReviewSchema.nullable(),
    evidenceContextNotes: z.string().min(10).nullable(),
  }).strict(),
}).strict().superRefine((pair, context) => {
  if (/^EXT[-_]/i.test(pair.sourceQueryId)) {
    context.addIssue({ code: 'custom', path: ['sourceQueryId'], message: 'External queries are prohibited.' });
  }
  if (pair.sourceTopicId && /^T1[1-6]$/.test(pair.sourceTopicId)) {
    context.addIssue({ code: 'custom', path: ['sourceTopicId'], message: 'T11–T16 are prohibited.' });
  }
  const [first, second] = pair.humanReference.initialReviews;
  if (first.reviewerId === second.reviewerId) {
    context.addIssue({ code: 'custom', path: ['humanReference'], message: 'Initial human reviews must be independent.' });
  }
  const disagreement = first.relevanceScore !== second.relevanceScore;
  if (disagreement && !pair.humanReference.adjudication) {
    context.addIssue({ code: 'custom', path: ['humanReference', 'adjudication'], message: 'Human disagreement requires adjudication.' });
  }
  if (pair.humanReference.adjudication && [first.reviewerId, second.reviewerId]
    .includes(pair.humanReference.adjudication.reviewerId)) {
    context.addIssue({ code: 'custom', path: ['humanReference', 'adjudication'], message: 'Adjudicator must be independent.' });
  }
  const reviews = [...pair.humanReference.initialReviews,
    ...(pair.humanReference.adjudication ? [pair.humanReference.adjudication] : [])];
  for (const [index, review] of reviews.entries()) {
    const evidence = validateEvidence(pair.candidate.lyrics, review.evidenceQuotes, review.relevanceScore);
    if (evidence.status === 'invalid') {
      context.addIssue({ code: 'custom', path: ['humanReference', 'reviews', index, 'evidenceQuotes'],
        message: `Invalid human-reference evidence: ${evidence.reasons.join(',')}.` });
    }
  }
});

export type JudgeSelectionPair = z.infer<typeof JudgeSelectionPairSchema>;

export const JudgeSelectionOutputSchema = z.object({
  pairId: z.string().min(1),
  provider: z.literal('groq'),
  modelId: z.enum(['openai/gpt-oss-120b', 'qwen/qwen3.8-27b']),
  schemaPass: z.boolean(),
  relevanceScore: RelevanceScoreSchema.nullable(),
  evidenceQuotes: z.array(EvidenceQuoteSchema),
  evidenceContextSupported: z.boolean().nullable(),
  inputTokens: z.number().int().nonnegative().nullable(),
  outputTokens: z.number().int().nonnegative().nullable(),
  latencyMs: z.number().nonnegative().nullable(),
  failureCode: z.string().nullable(),
}).strict().superRefine((output, context) => {
  if (output.schemaPass && output.relevanceScore === null) {
    context.addIssue({ code: 'custom', path: ['relevanceScore'], message: 'Schema-pass output needs a score.' });
  }
  if (!output.schemaPass && !output.failureCode) {
    context.addIssue({ code: 'custom', path: ['failureCode'], message: 'Failed output needs an explicit failure code.' });
  }
  if (output.relevanceScore === 0 && output.evidenceQuotes.length !== 0) {
    context.addIssue({ code: 'custom', path: ['evidenceQuotes'],
      message: 'Grade 0 requires an empty evidence array.' });
  }
  if (output.relevanceScore !== null && output.relevanceScore >= 2 && output.evidenceQuotes.length === 0) {
    context.addIssue({ code: 'custom', path: ['evidenceQuotes'],
      message: 'Grades 2–3 require at least one evidence span.' });
  }
});

export type JudgeSelectionOutput = z.infer<typeof JudgeSelectionOutputSchema>;

export interface JudgeSelectionSourceIndex {
  developmentQueries: ReadonlyMap<string, { topicId: string | null; queryText: string }>;
  corpusSections: ReadonlyMap<string, { sectionType: string; lyrics: string }>;
}

export interface JudgeMetrics {
  modelId: JudgeSelectionOutput['modelId'];
  totalPairs: number;
  scoredPairs: number;
  exactAgreement: number;
  meanAbsoluteError: number | null;
  quadraticWeightedKappa: number | null;
  macroF1: number | null;
  confusionMatrix: number[][];
  confusionMatrixColumns: readonly ['0', '1', '2', '3', 'schema_failure'];
  perGrade: Array<{
    grade: RelevanceScore;
    support: number;
    predicted: number;
    exactMatches: number;
    precision: number;
    recall: number;
    f1: number;
  }>;
  evidenceRequiredCount: number;
  evidenceVerbatimMatchRate: number | null;
  evidenceContextAuditedCount: number;
  evidenceContextSupportRate: number | null;
  criticalDisagreementRate: number;
  schemaPassRate: number;
  inputTokens: number;
  outputTokens: number;
  meanLatencyMs: number | null;
  p95LatencyMs: number | null;
  queryClusterBootstrap: {
    clusterField: 'sourceQueryId';
    clusterCount: number;
    replicates: number;
    seed: number;
    confidenceLevel: 0.95;
    intervals: {
      exactAgreement: MetricInterval | null;
      meanAbsoluteError: MetricInterval | null;
      quadraticWeightedKappa: MetricInterval | null;
      macroF1: MetricInterval | null;
    };
  };
}

interface MetricInterval {
  lower: number;
  upper: number;
}

type NullablePrediction = RelevanceScore | null;

interface AlignedJudgeItem {
  pair: JudgeSelectionPair;
  output: JudgeSelectionOutput;
}

export const JUDGE_SELECTION_CRITERIA = {
  version: 'judge-selection-v5',
  hardGates: {
    schemaPassRate: 1,
    evidenceVerbatimMatchRate: 1,
    minimumEvidenceContextSupportRate: 0.95,
    maximumCriticalDisagreementRate: 0.05,
  },
  rankingOrder: [
    'quadraticWeightedKappa',
    'macroF1',
    'exactAgreement',
    'evidenceContextSupportRate',
    'lowerTotalTokens',
    'lowerMeanLatencyMs',
  ],
} as const;

export function finalHumanScore(pair: JudgeSelectionPair): RelevanceScore {
  const [first, second] = pair.humanReference.initialReviews;
  if (first.relevanceScore === second.relevanceScore) return first.relevanceScore;
  if (!pair.humanReference.adjudication) throw new Error(`Pair ${pair.pairId} lacks adjudication.`);
  return pair.humanReference.adjudication.relevanceScore;
}

export function validateJudgeSelectionSet(
  input: unknown,
  sourceIndex?: JudgeSelectionSourceIndex
): JudgeSelectionPair[] {
  const pairs = z.array(JudgeSelectionPairSchema).length(JUDGE_SELECTION_REFERENCE_SIZE).parse(input);
  if (new Set(pairs.map(pair => pair.pairId)).size !== pairs.length) throw new Error('Pair IDs must be unique.');
  const labelCounts = [0, 1, 2, 3].map(label =>
    pairs.filter(pair => finalHumanScore(pair) === label).length);
  if (labelCounts.some(count => count < JUDGE_SELECTION_MINIMUM_PER_GRADE)) {
    throw new Error(`Each human reference label 0–3 needs at least ${JUDGE_SELECTION_MINIMUM_PER_GRADE} pairs.`);
  }
  if (labelCounts.some((count, grade) => count !== JUDGE_SELECTION_EXPECTED_LABEL_COUNTS[grade])) {
    throw new Error(`Human-reference label distribution must remain ${JUDGE_SELECTION_EXPECTED_LABEL_COUNTS.join('/')}.`);
  }
  for (const [stratum, expected] of Object.entries(JUDGE_SELECTION_EXPECTED_LANGUAGE_STRATA)) {
    const observed = pairs.filter(pair => pair.languageStratum === stratum).length;
    if (observed !== expected) {
      throw new Error(`Language stratum ${stratum} must contain ${expected} pairs; found ${observed}.`);
    }
  }
  if (new Set(pairs.map(pair => pair.distinctionTag)).size < 15) {
    throw new Error('At least 15 distinct human-reviewed theological distinction tags are required.');
  }
  if (sourceIndex) {
    for (const pair of pairs) {
      const query = sourceIndex.developmentQueries.get(pair.sourceQueryId);
      if (!query) throw new Error(`Unknown or non-development source query: ${pair.sourceQueryId}.`);
      if (query.topicId && /^T1[1-6]$/.test(query.topicId)) {
        throw new Error(`T11–T16 source query is prohibited: ${pair.sourceQueryId}.`);
      }
      if (query.topicId !== pair.sourceTopicId || query.queryText !== pair.queryText) {
        throw new Error(`Source query metadata mismatch: ${pair.sourceQueryId}.`);
      }
      const section = sourceIndex.corpusSections.get(pair.candidate.sourceSectionId);
      if (!section) throw new Error(`Unknown corpus section: ${pair.candidate.sourceSectionId}.`);
      const exactText = section.lyrics === pair.candidate.lyrics;
      const versionedText = pair.candidate.textProvenance === 'versioned_text_correction_v1' &&
        normalizeVersionedCandidate(section.lyrics) === normalizeVersionedCandidate(pair.candidate.lyrics);
      if (section.sectionType !== pair.candidate.sectionType || (!exactText && !versionedText)) {
        throw new Error(`Corpus section text/type mismatch: ${pair.candidate.sourceSectionId}.`);
      }
    }
  }
  return pairs;
}

function normalizeVersionedCandidate(value: string): string {
  return value.replace(/\r\n?/gu, '\n')
    .replace(/[\t ]+$/gmu, '')
    .replace(/[\t ]*\/[\t ]*(?=\n|$)/gu, '')
    .trim();
}

function quadraticWeightedKappa(reference: RelevanceScore[], predicted: RelevanceScore[]): number {
  const categories = 4;
  const observed = buildScoredConfusionMatrix(reference, predicted);
  const refCounts = Array(categories).fill(0);
  const predCounts = Array(categories).fill(0);
  for (let index = 0; index < reference.length; index += 1) {
    refCounts[reference[index]] += 1;
    predCounts[predicted[index]] += 1;
  }
  let weightedObserved = 0;
  let weightedExpected = 0;
  for (let left = 0; left < categories; left += 1) {
    for (let right = 0; right < categories; right += 1) {
      const weight = ((left - right) ** 2) / ((categories - 1) ** 2);
      weightedObserved += weight * observed[left][right];
      weightedExpected += weight * (refCounts[left] * predCounts[right] / reference.length);
    }
  }
  return weightedExpected === 0 ? (weightedObserved === 0 ? 1 : 0) : 1 - weightedObserved / weightedExpected;
}

function buildScoredConfusionMatrix(reference: RelevanceScore[], predicted: RelevanceScore[]): number[][] {
  const matrix = Array.from({ length: 4 }, () => Array<number>(4).fill(0));
  for (let index = 0; index < reference.length; index += 1) {
    matrix[reference[index]][predicted[index]] += 1;
  }
  return matrix;
}

function buildReportedConfusionMatrix(
  reference: RelevanceScore[],
  predicted: NullablePrediction[]
): number[][] {
  const matrix = Array.from({ length: 4 }, () => Array<number>(5).fill(0));
  for (let index = 0; index < reference.length; index += 1) {
    matrix[reference[index]][predicted[index] ?? 4] += 1;
  }
  return matrix;
}

function perGradeMetrics(reference: RelevanceScore[], predicted: NullablePrediction[]): JudgeMetrics['perGrade'] {
  return ([0, 1, 2, 3] as const).map(grade => {
    let truePositive = 0;
    let falsePositive = 0;
    let falseNegative = 0;
    for (let index = 0; index < reference.length; index += 1) {
      if (predicted[index] === grade && reference[index] === grade) truePositive += 1;
      if (predicted[index] === grade && reference[index] !== grade) falsePositive += 1;
      if (predicted[index] !== grade && reference[index] === grade) falseNegative += 1;
    }
    const precision = truePositive + falsePositive === 0 ? 0 : truePositive / (truePositive + falsePositive);
    const recall = truePositive + falseNegative === 0 ? 0 : truePositive / (truePositive + falseNegative);
    return {
      grade,
      support: truePositive + falseNegative,
      predicted: truePositive + falsePositive,
      exactMatches: truePositive,
      precision,
      recall,
      f1: precision + recall === 0 ? 0 : 2 * precision * recall / (precision + recall),
    };
  });
}

function macroF1(reference: RelevanceScore[], predicted: NullablePrediction[]): number {
  return [0, 1, 2, 3].reduce((sum, label) => {
    let truePositive = 0;
    let falsePositive = 0;
    let falseNegative = 0;
    for (let index = 0; index < reference.length; index += 1) {
      if (predicted[index] === label && reference[index] === label) truePositive += 1;
      if (predicted[index] === label && reference[index] !== label) falsePositive += 1;
      if (predicted[index] !== label && reference[index] === label) falseNegative += 1;
    }
    const precision = truePositive + falsePositive === 0 ? 0 : truePositive / (truePositive + falsePositive);
    const recall = truePositive + falseNegative === 0 ? 0 : truePositive / (truePositive + falseNegative);
    const f1 = precision + recall === 0 ? 0 : 2 * precision * recall / (precision + recall);
    return sum + f1;
  }, 0) / 4;
}

function percentile(values: number[], probability: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function metricInterval(values: Array<number | null>): MetricInterval | null {
  const finite = values.filter((value): value is number => value !== null && Number.isFinite(value));
  const lower = percentile(finite, 0.025);
  const upper = percentile(finite, 0.975);
  return lower === null || upper === null ? null : { lower, upper };
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function sampleMetrics(items: AlignedJudgeItem[]): {
  exactAgreement: number;
  meanAbsoluteError: number | null;
  quadraticWeightedKappa: number | null;
  macroF1: number;
} {
  const references = items.map(item => finalHumanScore(item.pair));
  const predictions = items.map(item => item.output.schemaPass ? item.output.relevanceScore : null);
  const scored = items.flatMap((item, index) => predictions[index] === null ? [] : [{
    reference: references[index], prediction: predictions[index] as RelevanceScore,
  }]);
  const scoredReferences = scored.map(item => item.reference);
  const scoredPredictions = scored.map(item => item.prediction);
  return {
    exactAgreement: items.length === 0 ? 0 : scored.filter(item =>
      item.reference === item.prediction).length / items.length,
    meanAbsoluteError: scored.length === 0 ? null : scored.reduce((sum, item) =>
      sum + Math.abs(item.reference - item.prediction), 0) / scored.length,
    quadraticWeightedKappa: scored.length === 0 ? null :
      quadraticWeightedKappa(scoredReferences, scoredPredictions),
    macroF1: macroF1(references, predictions),
  };
}

function queryClusterBootstrap(items: AlignedJudgeItem[]): JudgeMetrics['queryClusterBootstrap'] {
  const seed = 20261113;
  const replicates = 2000;
  const clusters = [...Map.groupBy(items, item => item.pair.sourceQueryId).values()];
  const random = seededRandom(seed);
  const samples = Array.from({ length: replicates }, () => {
    const resampled = Array.from({ length: clusters.length }, () =>
      clusters[Math.floor(random() * clusters.length)]).flat();
    return sampleMetrics(resampled);
  });
  return {
    clusterField: 'sourceQueryId',
    clusterCount: clusters.length,
    replicates,
    seed,
    confidenceLevel: 0.95,
    intervals: {
      exactAgreement: metricInterval(samples.map(sample => sample.exactAgreement)),
      meanAbsoluteError: metricInterval(samples.map(sample => sample.meanAbsoluteError)),
      quadraticWeightedKappa: metricInterval(samples.map(sample => sample.quadraticWeightedKappa)),
      macroF1: metricInterval(samples.map(sample => sample.macroF1)),
    },
  };
}

export function evaluateJudgeCandidate(
  pairInput: unknown,
  outputInput: unknown,
  sourceIndex?: JudgeSelectionSourceIndex
): JudgeMetrics {
  const pairs = validateJudgeSelectionSet(pairInput, sourceIndex);
  const outputs = z.array(JudgeSelectionOutputSchema).length(pairs.length).parse(outputInput);
  if (new Set(outputs.map(output => output.modelId)).size !== 1) throw new Error('Evaluate one model per run.');
  const outputByPair = new Map(outputs.map(output => [output.pairId, output]));
  if (outputByPair.size !== pairs.length || pairs.some(pair => !outputByPair.has(pair.pairId))) {
    throw new Error('Judge output pair IDs must match the frozen reference set exactly.');
  }
  const aligned = pairs.map(pair => ({ pair, output: outputByPair.get(pair.pairId)! }));
  const valid = aligned.filter(item => item.output.schemaPass && item.output.relevanceScore !== null);
  const allReferences = aligned.map(item => finalHumanScore(item.pair));
  const allPredictions = aligned.map(item => item.output.schemaPass ? item.output.relevanceScore : null);
  const references = valid.map(item => finalHumanScore(item.pair));
  const predictions = valid.map(item => item.output.relevanceScore as RelevanceScore);
  const evidenceRequired = valid.filter(item => (item.output.relevanceScore as number) >= 2)
    .map(item => ({
      ...item,
      evidenceValidation: validateEvidence(
        item.pair.candidate.lyrics,
        item.output.evidenceQuotes,
        item.output.relevanceScore as RelevanceScore
      ),
    }));
  const contextAudited = evidenceRequired.filter(item =>
    item.output.evidenceContextSupported !== null);
  const latencies = outputs.flatMap(output => output.latencyMs === null ? [] : [output.latencyMs])
    .sort((left, right) => left - right);
  const exactCorrect = valid.filter((item, index) => predictions[index] === finalHumanScore(item.pair)).length;
  const critical = valid.filter((item, index) =>
    Math.abs(predictions[index] - finalHumanScore(item.pair)) >= 2).length;
  const absoluteError = valid.reduce((sum, item, index) =>
    sum + Math.abs(predictions[index] - finalHumanScore(item.pair)), 0);
  return {
    modelId: outputs[0].modelId,
    totalPairs: pairs.length,
    scoredPairs: valid.length,
    exactAgreement: exactCorrect / pairs.length,
    meanAbsoluteError: valid.length === 0 ? null : absoluteError / valid.length,
    quadraticWeightedKappa: valid.length === 0 ? null : quadraticWeightedKappa(references, predictions),
    macroF1: macroF1(allReferences, allPredictions),
    confusionMatrix: buildReportedConfusionMatrix(allReferences, allPredictions),
    confusionMatrixColumns: ['0', '1', '2', '3', 'schema_failure'],
    perGrade: perGradeMetrics(allReferences, allPredictions),
    evidenceRequiredCount: evidenceRequired.length,
    evidenceVerbatimMatchRate: evidenceRequired.length === 0 ? null :
      evidenceRequired.filter(item => item.evidenceValidation.status === 'valid').length / evidenceRequired.length,
    evidenceContextAuditedCount: contextAudited.length,
    evidenceContextSupportRate: evidenceRequired.length === 0 ? null :
      contextAudited.length !== evidenceRequired.length ? null :
        contextAudited.filter(item => item.output.evidenceContextSupported).length / evidenceRequired.length,
    criticalDisagreementRate: critical / pairs.length,
    schemaPassRate: outputs.filter(output => output.schemaPass).length / pairs.length,
    inputTokens: outputs.reduce((sum, output) => sum + (output.inputTokens ?? 0), 0),
    outputTokens: outputs.reduce((sum, output) => sum + (output.outputTokens ?? 0), 0),
    meanLatencyMs: latencies.length === 0 ? null : latencies.reduce((sum, value) => sum + value, 0) / latencies.length,
    p95LatencyMs: latencies.length === 0 ? null : latencies[Math.ceil(latencies.length * 0.95) - 1],
    queryClusterBootstrap: queryClusterBootstrap(aligned),
  };
}

export function passesJudgeSelectionGates(metrics: JudgeMetrics): boolean {
  const gates = JUDGE_SELECTION_CRITERIA.hardGates;
  return metrics.schemaPassRate === gates.schemaPassRate &&
    metrics.evidenceVerbatimMatchRate === gates.evidenceVerbatimMatchRate &&
    metrics.evidenceContextSupportRate !== null &&
    metrics.evidenceContextSupportRate >= gates.minimumEvidenceContextSupportRate &&
    metrics.criticalDisagreementRate <= gates.maximumCriticalDisagreementRate &&
    metrics.quadraticWeightedKappa !== null && metrics.macroF1 !== null;
}

export function compareJudgeCandidates(left: JudgeMetrics, right: JudgeMetrics): {
  selectedModelId: JudgeMetrics['modelId'] | null;
  status: 'selected' | 'no_candidate_passed' | 'tie_requires_human_decision';
  gatePass: Record<JudgeMetrics['modelId'], boolean>;
} {
  const leftPass = passesJudgeSelectionGates(left);
  const rightPass = passesJudgeSelectionGates(right);
  const gatePass = { [left.modelId]: leftPass, [right.modelId]: rightPass } as
    Record<JudgeMetrics['modelId'], boolean>;
  if (!leftPass && !rightPass) return { selectedModelId: null, status: 'no_candidate_passed', gatePass };
  if (leftPass !== rightPass) {
    return { selectedModelId: leftPass ? left.modelId : right.modelId, status: 'selected', gatePass };
  }
  const descending: Array<keyof JudgeMetrics> = [
    'quadraticWeightedKappa', 'macroF1', 'exactAgreement', 'evidenceContextSupportRate',
  ];
  for (const key of descending) {
    const leftValue = left[key] as number;
    const rightValue = right[key] as number;
    if (leftValue !== rightValue) {
      return { selectedModelId: leftValue > rightValue ? left.modelId : right.modelId,
        status: 'selected', gatePass };
    }
  }
  const leftTokens = left.inputTokens + left.outputTokens;
  const rightTokens = right.inputTokens + right.outputTokens;
  if (leftTokens !== rightTokens) {
    return { selectedModelId: leftTokens < rightTokens ? left.modelId : right.modelId,
      status: 'selected', gatePass };
  }
  if (left.meanLatencyMs !== null && right.meanLatencyMs !== null &&
      left.meanLatencyMs !== right.meanLatencyMs) {
    return { selectedModelId: left.meanLatencyMs < right.meanLatencyMs ? left.modelId : right.modelId,
      status: 'selected', gatePass };
  }
  return { selectedModelId: null, status: 'tie_requires_human_decision', gatePass };
}
