import { createHash } from 'node:crypto';
import { z } from 'zod';
import { charNgramJaccard, normalizedLevenshteinDistance, tokenizeWords, wordJaccard } from './normalization';

export const LEAKAGE_V2_VERSION = 'leakage-validator-v2.0.0';
export const LEAKAGE_V2_POLICY = Object.freeze({
  wordCandidate: 0.35, characterCandidate: 0.45, editCandidate: 0.3,
  semanticCandidate: 0.75, minimumContainedTokens: 8,
});
const Id = z.string().min(1);
const Hash = z.string().regex(/^[a-f0-9]{64}$/u);
const Provenance = z.object({ source: Id, sha256: Hash, trust: z.enum(['approved', 'legacy_unverified']) }).strict();
const Reference = z.object({
  id: Id, text: Id, scope: z.enum(['development', 'diagnostic', 'external']),
  topicId: z.string().nullable(), kind: z.enum(['query', 'topic_label', 'topic_description', 'title', 'artist']),
}).strict();
const Mapping = z.object({
  id: Id, referenceId: Id, songId: Id, sectionIds: z.array(Id).min(1).optional(),
  provenance: Provenance,
}).strict();
export const LeakageRegistryV2Schema = z.object({
  schemaVersion: z.literal('leakage-registry-v2'),
  references: z.array(Reference).min(1), mappings: z.array(Mapping),
  externalCoverage: z.enum(['not_available', 'included']),
}).strict().superRefine((r, ctx) => {
  const ids = new Set(r.references.map(x => x.id));
  if (ids.size !== r.references.length || new Set(r.mappings.map(x => x.id)).size !== r.mappings.length) {
    ctx.addIssue({ code: 'custom', message: 'Registry IDs must be unique.' });
  }
  for (const m of r.mappings) if (!ids.has(m.referenceId)) {
    ctx.addIssue({ code: 'custom', message: `Unknown mapping reference ${m.referenceId}.` });
  }
  for (const ref of r.references) if (!normalizeLeakageText(ref.text)) {
    ctx.addIssue({ code: 'custom', message: `Empty normalized reference ${ref.id}.` });
  }
  if ((r.externalCoverage === 'included') !== r.references.some(x => x.scope === 'external')) {
    ctx.addIssue({ code: 'custom', message: 'External coverage must reflect actual protected references.' });
  }
});
export type LeakageRegistryV2 = z.infer<typeof LeakageRegistryV2Schema>;

export const LeakageCandidateV2Schema = z.object({
  queryId: Id, queryText: Id, songId: Id, sectionId: Id, lyrics: Id,
}).strict();
export type LeakageCandidateV2 = z.infer<typeof LeakageCandidateV2Schema>;

export function normalizeLeakageText(value: string): string {
  // Preserve Vietnamese diacritics; punctuation/hyphens are token boundaries.
  return tokenizeWords(value).join(' ');
}

const MORPHOLOGY: Record<string, string> = {
  witnesses: 'witness', witnessing: 'witness', witnessed: 'witness',
  testifies: 'testify', testified: 'testify', testifying: 'testify', testimony: 'testify',
  guides: 'guide', guiding: 'guide', guided: 'guide', leads: 'lead', leading: 'lead',
  disciples: 'disciple', discipling: 'disciple', making: 'make', makes: 'make',
  commands: 'command', commanded: 'command', commanding: 'command',
  calls: 'call', called: 'call', calling: 'call', following: 'follow', follows: 'follow',
  loving: 'love', loves: 'love', loved: 'love', sacrifices: 'sacrifice', sacrificing: 'sacrifice',
  giving: 'give', surrendering: 'surrender',
};
export function leakageMorphology(value: string): string {
  // Deliberately no broad stemming: faithful and faithfulness remain distinct.
  return tokenizeWords(value).map(token => MORPHOLOGY[token] ?? token).join(' ');
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value)
    .sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
export function leakageHash(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}
export function candidateFingerprint(input: LeakageCandidateV2): string {
  // Exact content binding: even a changed lyric or a reused TP ID invalidates approval.
  return leakageHash(LeakageCandidateV2Schema.parse(input));
}
export function registryFingerprint(input: LeakageRegistryV2): string {
  const registry = LeakageRegistryV2Schema.parse(input);
  return leakageHash({ ...registry,
    references: [...registry.references].sort((a, b) => a.id.localeCompare(b.id)),
    mappings: [...registry.mappings].sort((a, b) => a.id.localeCompare(b.id)),
  });
}

export const LeakageAdjudicationV2Schema = z.object({
  id: Id, candidateFingerprint: Hash, registryFingerprint: Hash,
  decision: z.enum(['passed', 'confirmed_leakage', 'human_review']),
  authority: Id, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u), rationale: Id,
  provenance: Provenance,
}).strict();
export type LeakageAdjudicationV2 = z.infer<typeof LeakageAdjudicationV2Schema>;

export interface IntentFindingV2 {
  topicId: string; ruleId: string; matchedPhrase: string; confidence: 'explicit' | 'ambiguous';
}

export function inspectIntentV2(text: string): IntentFindingV2[] {
  const n = leakageMorphology(text);
  const findings: IntentFindingV2[] = [];
  // Unicode-safe full-token boundaries, including Vietnamese and compounds.
  // Proximity checks below are bounded relational templates, not a bag of words.
  const has = (pattern: string) => new RegExp(`(?:^| )(?:${pattern})(?= |$)`, 'u').test(n);
  const near = (left: string, right: string, gap = 6) => has(`(?:${left})(?: [\\p{L}\\p{N}]+){0,${gap}} (?:${right})`);
  const spirit = has('holy spirit|thánh linh');
  const witnessTerms = 'witness|testify|làm chứng|chứng nhân';
  const christTerms = 'christ|jesus|giê su|giê xu|đấng cơ đốc';
  const followTerms = 'follow|theo ngài|theo chúa|theo giê|môn đồ';
  const callTerms = 'call|kêu gọi|mời gọi';
  const guideTerms = 'guide|lead|dẫn dắt|hướng dẫn|dẫn vào';
  const costTerms = 'cost|give up|sacrifice|từ bỏ|cái giá|hy sinh|surrender worldly possessions';
  const loveTerms = 'love one another|yêu thương nhau|yêu thương lẫn nhau';
  const commandTerms = 'command|điều răn|truyền dạy|truyền lệnh';
  const witness = has(witnessTerms);
  const christ = has(christTerms);
  const rules: Array<[string, string, boolean]> = [
    ['T11', 'spirit_or_believers_witness_about_christ', near(witnessTerms, christTerms)],
    ['T12', 'spirit_guides_into_all_truth', spirit && near(guideTerms, 'all truth|mọi lẽ thật|mọi chân lý')],
    ['T13', 'jesus_call_to_follow', christ && near(callTerms, followTerms)
      && (near(christTerms, callTerms) || near(followTerms, christTerms))],
    ['T14', 'cost_sacrifice_to_follow_jesus', christ && has(costTerms) && has(followTerms)
      && (near(costTerms, followTerms, 12) || near(followTerms, costTerms, 12))],
    ['T15', 'command_love_as_disciples', has('disciple|môn đồ')
      && (near(commandTerms, loveTerms) || near(loveTerms, commandTerms))],
    ['T16', 'great_commission_make_disciples', has('great commission|đại mạng lệnh')
      || near('make disciple|môn đồ hóa', 'all nations|muôn dân|mọi dân tộc')],
  ];
  for (const [topicId, ruleId, hit] of rules) {
    const label = ({
      T13: 'call of discipleship', T14: 'cost of discipleship',
      T15: 'command of discipleship', T16: 'commission of discipleship',
    } as Record<string, string>)[topicId];
    if (hit || label && has(label)) findings.push({ topicId, ruleId, matchedPhrase: n, confidence: 'explicit' });
  }
  if (witness && (spirit || christ) && !findings.some(f => f.topicId === 'T11')) findings.push({ topicId: 'T11',
    ruleId: 'witness_object_unspecified', matchedPhrase: n, confidence: 'ambiguous' });
  if (spirit && has(guideTerms) && has('truth|lẽ thật|chân lý') && !findings.some(x => x.topicId === 'T12')) {
    findings.push({ topicId: 'T12', ruleId: 'truth_guidance_scope_unspecified', matchedPhrase: n, confidence: 'ambiguous' });
  }
  const partial: Array<[string, boolean]> = [
    ['T13', has(callTerms) && has(followTerms) && has('disciple|môn đồ|jesus|christ|giê su|giê xu')],
    ['T14', has(costTerms) && has('disciple|môn đồ')],
    ['T15', has(commandTerms) && has(loveTerms)],
    ['T16', has('make disciple|môn đồ hóa')],
  ];
  for (const [topicId, hit] of partial) if (hit && !findings.some(f => f.topicId === topicId)) {
    findings.push({ topicId, ruleId: 'specialized_intent_relation_unspecified', matchedPhrase: n, confidence: 'ambiguous' });
  }
  // Rule matches in exclusion/negation/metalinguistic contexts are not entailment proof.
  if (has('not|without|avoid|exclude|không|tránh|ngoại trừ|phân biệt|difference between')) {
    return findings.map(f => ({ ...f, confidence: 'ambiguous', ruleId: `${f.ruleId}:context_requires_resolution` }));
  }
  return findings;
}

export interface IntentEquivalenceEvidenceV2 {
  candidateFingerprint: string; referenceId: string; referenceTextSha256: string;
  relation: 'equivalent' | 'different'; authority: string; rationale: string;
}
export interface LeakageInputV2 {
  candidate: LeakageCandidateV2;
  registry: LeakageRegistryV2;
  adjudications?: LeakageAdjudicationV2[];
  // Scores are supplied by an external frozen encoder, never fabricated here.
  semanticScores?: Record<string, number>;
  requireSemanticScores?: boolean;
  requireExternalCoverage?: boolean;
  intentEvidence?: IntentEquivalenceEvidenceV2[];
  supervisionMappingIds?: string[];
}

export function auditQueryLeakageV2(input: LeakageInputV2) {
  const candidate = LeakageCandidateV2Schema.parse(input.candidate);
  if (!normalizeLeakageText(candidate.queryText)) throw new Error('Empty normalized query.');
  const registry = LeakageRegistryV2Schema.parse(input.registry);
  const fingerprint = candidateFingerprint(candidate);
  const registryHash = registryFingerprint(registry);
  const known = new Set(registry.references.map(r => r.id));
  for (const [id, score] of Object.entries(input.semanticScores ?? {})) {
    if (!known.has(id) || !Number.isFinite(score) || score < -1 || score > 1) {
      throw new Error(`Invalid semantic score or reference ${id}.`);
    }
  }
  const query = normalizeLeakageText(candidate.queryText);
  const padded = ` ${query} `;
  const comparisons = registry.references.map(ref => {
    const normalized = normalizeLeakageText(ref.text);
    const tokens = normalized.split(' ').filter(Boolean);
    const exact = query === normalized;
    const contained = normalized.length > 0 && (padded.includes(` ${normalized} `) || ` ${normalized} `.includes(padded));
    const distinctive = tokens.length >= 4 && !['title', 'artist', 'topic_label'].includes(ref.kind);
    const lexical = {
      exact, tokenContained: contained, morphologyEquivalent: leakageMorphology(candidate.queryText) === leakageMorphology(ref.text),
      wordJaccard: wordJaccard(query, normalized), characterJaccard: charNgramJaccard(query, normalized),
      editDistance: normalizedLevenshteinDistance(query, normalized),
    };
    const cosine = input.semanticScores?.[ref.id] ?? null;
    const candidateSignals: string[] = [];
    if (contained) candidateSignals.push('whole_token_containment');
    if (lexical.wordJaccard > LEAKAGE_V2_POLICY.wordCandidate) candidateSignals.push('word_similarity');
    if (lexical.characterJaccard > LEAKAGE_V2_POLICY.characterCandidate) candidateSignals.push('character_similarity');
    if (lexical.editDistance < LEAKAGE_V2_POLICY.editCandidate) candidateSignals.push('edit_similarity');
    if (cosine !== null && cosine >= LEAKAGE_V2_POLICY.semanticCandidate) candidateSignals.push('semantic_similarity');
    const directCopy = distinctive && (exact || contained && tokens.length >= LEAKAGE_V2_POLICY.minimumContainedTokens
      && query.split(' ').length >= LEAKAGE_V2_POLICY.minimumContainedTokens);
    return { referenceId: ref.id, topicId: ref.topicId, scope: ref.scope, kind: ref.kind,
      matchedPhrase: contained ? (query.length < normalized.length ? query : normalized) : null,
      lexical, cosine, candidateSignals, directCopy };
  });
  const intent = inspectIntentV2(candidate.queryText);
  const contextAmbiguous = intent.some(f => f.ruleId.endsWith(':context_requires_resolution'));
  const equivalence = input.intentEvidence ?? [];
  for (const e of equivalence) {
    const ref = registry.references.find(r => r.id === e.referenceId);
    if (!ref || e.candidateFingerprint !== fingerprint || e.referenceTextSha256 !== leakageHash(ref.text)
      || !e.authority.trim() || !e.rationale.trim() || !['equivalent', 'different'].includes(e.relation)) {
      throw new Error('Unbound or undocumented intent equivalence evidence.');
    }
  }
  for (const id of new Set(equivalence.map(e => e.referenceId))) {
    if (new Set(equivalence.filter(e => e.referenceId === id).map(e => e.relation)).size > 1) {
      throw new Error('Conflicting intent equivalence evidence.');
    }
  }
  const mappingFindings = registry.mappings.filter(m => m.songId === candidate.songId).map(m => {
    const sameTarget = !m.sectionIds || m.sectionIds.includes(candidate.sectionId);
    const evidence = equivalence.filter(e => e.referenceId === m.referenceId);
    if (new Set(evidence.map(e => e.relation)).size > 1) throw new Error('Conflicting intent equivalence evidence.');
    const exactQuery = comparisons.find(c => c.referenceId === m.referenceId)!.lexical.exact;
    const reused = input.supervisionMappingIds?.includes(m.id) ?? false;
    const equivalent = exactQuery || evidence.some(e => e.relation === 'equivalent');
    return { mappingId: m.id, referenceId: m.referenceId, sameSong: true, sameTarget,
      equivalentIntent: equivalent, explicitSupervisionReuse: reused,
      provenance: m.provenance,
      // A legacy qrel's adjudicated=true is not proof of human provenance.
      confirmed: sameTarget && (equivalent || reused) && (m.provenance.trust === 'approved' || reused),
      provenanceReviewRequired: sameTarget && equivalent && m.provenance.trust === 'legacy_unverified' && !reused,
      evidence: evidence.map(e => ({ authority: e.authority, rationale: e.rationale, relation: e.relation })) };
  });
  for (const id of input.supervisionMappingIds ?? []) {
    if (!registry.mappings.some(m => m.id === id)) throw new Error(`Unknown supervision mapping ${id}.`);
  }
  const confirmations: Array<{ reason: string; referenceId: string | null; mappingId?: string; topicId?: string; phrase?: string }> = [];
  for (const c of comparisons.filter(c => c.directCopy && !contextAmbiguous)) confirmations.push({
    reason: 'distinctive_protected_query_copy', referenceId: c.referenceId, phrase: c.matchedPhrase ?? query,
  });
  for (const f of intent.filter(f => f.confidence === 'explicit')) confirmations.push({
    reason: 'specialized_held_out_intent', referenceId: registry.references.find(r => r.topicId === f.topicId)?.id ?? null,
    topicId: f.topicId, phrase: f.matchedPhrase,
  });
  for (const m of mappingFindings.filter(m => m.confirmed)) confirmations.push({
    reason: 'protected_query_song_supervision', referenceId: m.referenceId, mappingId: m.mappingId,
  });
  const unresolved: Array<{ reason: string; referenceId: string | null }> = intent.filter(f => f.confidence === 'ambiguous')
    .map(f => ({ reason: f.ruleId, referenceId: registry.references.find(r => r.topicId === f.topicId)?.id ?? null }));
  for (const m of mappingFindings.filter(m => m.provenanceReviewRequired)) unresolved.push({
    reason: 'mapping_provenance_requires_verification', referenceId: m.referenceId,
  });
  for (const c of comparisons.filter(c => c.cosine !== null && c.cosine >= LEAKAGE_V2_POLICY.semanticCandidate)) {
    if (!equivalence.some(e => e.referenceId === c.referenceId)) unresolved.push({
      reason: 'semantic_candidate_intent_unresolved', referenceId: c.referenceId,
    });
  }
  for (const e of equivalence.filter(e => e.relation === 'equivalent')) {
    confirmations.push({ reason: 'verified_protected_intent_equivalence', referenceId: e.referenceId });
  }
  const approvals = (input.adjudications ?? []).map(a => LeakageAdjudicationV2Schema.parse(a));
  const applicable = approvals.filter(a => a.candidateFingerprint === fingerprint && a.registryFingerprint === registryHash
    && a.provenance.trust === 'approved');
  if (new Set(applicable.map(a => a.decision)).size > 1) throw new Error('Conflicting Human adjudications.');
  const missingChecks: string[] = [];
  if (input.requireSemanticScores && registry.references.some(r => input.semanticScores?.[r.id] === undefined)) missingChecks.push('semantic_scores_missing');
  if (input.requireExternalCoverage && registry.externalCoverage !== 'included') missingChecks.push('external_registry_missing');
  const human = applicable[0] ?? null;
  // A record-specific decision can resolve policy ambiguity; it cannot fabricate
  // missing required encoder coverage or approve new references added later.
  const status = missingChecks.length ? 'incomplete' : human ? human.decision
    : confirmations.length ? 'confirmed_leakage' : unresolved.length ? 'human_review' : 'passed';
  return {
    validatorVersion: LEAKAGE_V2_VERSION, policy: LEAKAGE_V2_POLICY,
    queryId: candidate.queryId, candidateFingerprint: fingerprint, registryFingerprint: registryHash,
    status, decisionMethod: human ? 'scoped_human_adjudication' : 'pipeline_rules',
    foundationalVocabulary: query.match(/holy spirit|thánh linh|faith|đức tin|grace|ân điển|discipleship|môn đồ/gu) ?? [],
    comparisons, intentFindings: intent, mappingFindings, confirmations, unresolved,
    missingChecks, appliedAdjudication: human,
    ignoredAdjudicationIds: approvals.filter(a => !applicable.includes(a)).map(a => a.id),
    coverage: { protectedReferences: registry.references.length, protectedMappings: registry.mappings.length,
      semanticScoresProvided: Object.keys(input.semanticScores ?? {}).length,
      externalCoverage: registry.externalCoverage, method: 'bounded_bilingual_rules_and_supplied_evidence' },
    trainingEligible: false,
  } as const;
}
