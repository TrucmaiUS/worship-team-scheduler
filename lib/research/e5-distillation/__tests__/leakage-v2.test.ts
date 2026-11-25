import { describe, expect, it } from 'vitest';
import path from 'node:path';
import {
  auditQueryLeakageV2, candidateFingerprint, leakageHash, leakageMorphology, normalizeLeakageText,
  registryFingerprint, type LeakageCandidateV2, type LeakageRegistryV2, type LeakageAdjudicationV2,
} from '../leakage-v2';
import { loadFrozenPilotLeakageV2, fileSha256 } from '../leakage-v2-pilot';

const candidate: LeakageCandidateV2 = { queryId: 'unit-fixture', queryText: 'Comfort in grief',
  songId: 'song-a', sectionId: 'section-a', lyrics: 'Fixture lyric, never training data' };
const registry: LeakageRegistryV2 = { schemaVersion: 'leakage-registry-v2', externalCoverage: 'not_available',
  references: [
    { id: 'short', text: 'Faithful', scope: 'development', topicId: null, kind: 'title' },
    { id: 'T11', text: 'Songs that testify about Jesus Christ and point people toward who He is',
      scope: 'diagnostic', topicId: 'T11', kind: 'query' },
    { id: 'general', text: 'Holy Spirit', scope: 'diagnostic', topicId: 'T11', kind: 'topic_label' },
  ], mappings: [{ id: 'map', referenceId: 'T11', songId: 'song-a',
    provenance: { source: 'unit-fixture', sha256: '0'.repeat(64), trust: 'approved' } }] };
const run = (text: string) => auditQueryLeakageV2({ candidate: { ...candidate, queryText: text }, registry });
const evidence = (relation: 'equivalent' | 'different') => ({
  candidateFingerprint: candidateFingerprint(candidate), referenceId: 'T11',
  referenceTextSha256: leakageHash(registry.references[1].text), relation,
  authority: 'Unit fixture reviewer', rationale: 'Explicit test-only intent comparison',
});

describe('Leakage v2: separate vocabulary, lexical, intent and supervision', () => {
  it('uses NFC, punctuation and full-token boundaries without broad stemming', () => {
    expect(normalizeLeakageText('  THÁNH—LINH! ')).toBe('thánh linh');
    expect(leakageMorphology('witnesses witnessing faithfully faithfulness Faithful')).toBe('witness witness faithfully faithfulness faithful');
    const result = run('God shows faithfulness through the darkness');
    expect(result.status).toBe('passed');
    expect(result.comparisons.find(r => r.referenceId === 'short')!.lexical.tokenContained).toBe(false);
  });
  it.each(['Holy Spirit comfort and companionship', 'Thánh Linh giúp con vượt qua thử thách',
    'Grace faith obedience discipleship and worship', 'The Spirit empowers us in weakness'])('allows foundational vocabulary: %s', text => {
    expect(run(text).status).toBe('passed');
  });
  it('does not isolate the entire song or section', () => {
    const r = run('Comfort in grief');
    expect(r.mappingFindings).toMatchObject([{ sameSong: true, sameTarget: true, equivalentIntent: false, confirmed: false }]);
    expect(r.status).toBe('passed');
  });
  it.each(['Following Jesus in a costume of praise', 'Holy Spirit guidance into truthful living',
    'Thánh Linh giúp con ghi nhớ lời Chúa', 'Holy Spirit brings faithful companionship'])('does not match inside words: %s', text => {
    expect(run(text).status).toBe('passed');
  });
  it.each([
    ['T11', 'Songs that testify about Jesus Christ'],
    ['T11', 'Thánh Linh làm chứng về Chúa Giê-su'],
    ['T12', 'Holy Spirit guiding us into all truth'],
    ['T12', 'Thánh Linh dẫn dắt con vào mọi lẽ thật'],
    ['T13', 'Jesus calling people to follow Him'],
    ['T13', 'Chúa Giê-su kêu gọi con theo Ngài'],
    ['T14', 'The cost of giving up comfort to follow Jesus'],
    ['T14', 'Giving up possessions to follow Jesus'],
    ['T14', 'Từ bỏ mọi sự để theo Chúa Giê-su'],
    ['T15', 'The command to love one another as disciples'],
    ['T15', 'Điều răn yêu thương nhau của môn đồ'],
    ['T16', 'Making disciples of all nations'],
    ['T16', 'Đại mạng lệnh môn đồ hóa muôn dân'],
  ])('detects explicit held-out intent %s: %s', (topic, text) => {
    const result = run(text);
    expect(result.status).toBe('confirmed_leakage');
    expect(result.confirmations.some(c => c.topicId === topic)).toBe(true);
  });
  it('keeps genuine ambiguity for resolution, including negation contexts', () => {
    expect(run('Holy Spirit empowering us to bear witness to His glory everywhere').status).toBe('human_review');
    expect(run('Holy Spirit guide our hearts into truth').status).toBe('human_review');
    expect(run('Songs about comfort, not about testifying about Jesus Christ').status).toBe('human_review');
  });
  it('detects normalized protected text reuse on a different song', () => {
    const r = auditQueryLeakageV2({ candidate: { ...candidate, songId: 'other',
      queryText: `  ${registry.references[1].text.toUpperCase()}!!!` }, registry });
    expect(r.confirmations.some(c => c.reason === 'distinctive_protected_query_copy')).toBe(true);
  });
  it('records high lexical similarity as a signal, without automatic confirmation', () => {
    const local: LeakageRegistryV2 = { ...registry, references: [{ ...registry.references[1], id: 'vocab',
      text: 'Holy Spirit bringing comfort peace hope and strength', topicId: 'T09', scope: 'development' }], mappings: [] };
    const r = auditQueryLeakageV2({ candidate: { ...candidate,
      queryText: 'Holy Spirit bringing hope peace comfort and strength today' }, registry: local });
    expect(r.comparisons[0].candidateSignals).toContain('word_similarity');
    expect(r.status).toBe('passed');
  });
  it('never confirms leakage solely from a high semantic score', () => {
    const args = { candidate, registry, semanticScores: { T11: 0.99 } };
    expect(auditQueryLeakageV2(args).status).toBe('human_review');
    expect(auditQueryLeakageV2({ ...args, intentEvidence: [evidence('different')] }).status).toBe('passed');
  });
  it('confirms verified equivalent intent and protected mapping together', () => {
    const r = auditQueryLeakageV2({ candidate, registry, intentEvidence: [evidence('equivalent')] });
    expect(r.status).toBe('confirmed_leakage');
    expect(r.mappingFindings[0].confirmed).toBe(true);
    expect(r.confirmations.some(c => c.reason === 'protected_query_song_supervision')).toBe(true);
  });
  it('detects explicit reuse of diagnostic supervision without seeing the protected wording', () => {
    expect(auditQueryLeakageV2({ candidate, registry, supervisionMappingIds: ['map'] }).status).toBe('confirmed_leakage');
    expect(() => auditQueryLeakageV2({ candidate, registry, supervisionMappingIds: ['unknown'] })).toThrow('Unknown supervision');
  });
  it('respects section-specific mapping scope', () => {
    const local = { ...registry, mappings: [{ ...registry.mappings[0], sectionIds: ['other-section'] }] };
    const result = auditQueryLeakageV2({ candidate, registry: local, supervisionMappingIds: ['map'] });
    expect(result.mappingFindings[0].sameTarget).toBe(false);
    expect(result.status).toBe('passed');
  });
  it('does not upgrade legacy qrel provenance to human gold', () => {
    const local: LeakageRegistryV2 = { ...registry, mappings: [{ ...registry.mappings[0],
      provenance: { ...registry.mappings[0].provenance, trust: 'legacy_unverified' } }] };
    const result = auditQueryLeakageV2({ candidate, registry: local, intentEvidence: [evidence('equivalent')] });
    expect(result.mappingFindings[0]).toMatchObject({ confirmed: false, provenanceReviewRequired: true });
    // Independently verified prohibited intent still fails, regardless of qrel trust.
    expect(result.status).toBe('confirmed_leakage');
  });
  it('fails closed when required coverage is absent', () => {
    expect(auditQueryLeakageV2({ candidate, registry, requireSemanticScores: true }).status).toBe('incomplete');
    expect(auditQueryLeakageV2({ candidate, registry, requireExternalCoverage: true }).status).toBe('incomplete');
    expect(() => auditQueryLeakageV2({ candidate, registry, semanticScores: { T11: NaN } })).toThrow('Invalid semantic');
    expect(() => auditQueryLeakageV2({ candidate, registry, semanticScores: { unknown: 0.9 } })).toThrow('Invalid semantic');
  });
  it('rejects unbound, conflicting and incomplete provenance evidence', () => {
    expect(() => auditQueryLeakageV2({ candidate, registry, intentEvidence: [{ ...evidence('different'),
      referenceTextSha256: 'bad' }] })).toThrow('Unbound');
    expect(() => auditQueryLeakageV2({ candidate, registry, intentEvidence: [evidence('different'), evidence('equivalent')] })).toThrow('Conflicting');
    expect(() => auditQueryLeakageV2({ candidate, registry: { ...registry, mappings: [{ ...registry.mappings[0], referenceId: 'unknown' }] } })).toThrow();
    expect(() => run('!!!')).toThrow('Empty normalized');
  });
});

describe('Human adjudication is content-bound, never an ID/topic allowlist', () => {
  const ambiguous = { ...candidate, queryText: 'Holy Spirit enabling us to bear witness to His glory' };
  const approval: LeakageAdjudicationV2 = { id: 'approval-fixture', candidateFingerprint: candidateFingerprint(ambiguous),
    registryFingerprint: registryFingerprint(registry), decision: 'passed', authority: 'Human fixture', date: '2026-11-25',
    rationale: 'T09 companionship rather than specialized T11',
    provenance: { source: 'fixture', sha256: '0'.repeat(64), trust: 'approved' } };
  it('preserves a scoped human pass with full lineage', () => {
    const r = auditQueryLeakageV2({ candidate: ambiguous, registry, adjudications: [approval] });
    expect(r.status).toBe('passed');
    expect(r.appliedAdjudication).toEqual(approval);
    expect(r.trainingEligible).toBe(false);
  });
  it.each(['queryText', 'songId', 'sectionId', 'lyrics', 'queryId'] as const)('invalidates approval after changing %s', field => {
    const changed = { ...ambiguous, [field]: `${ambiguous[field]} changed` };
    const r = auditQueryLeakageV2({ candidate: changed, registry, adjudications: [approval] });
    expect(r.appliedAdjudication).toBeNull();
    expect(r.ignoredAdjudicationIds).toContain(approval.id);
  });
  it('invalidates approval when the protected registry changes', () => {
    const changed: LeakageRegistryV2 = { ...registry, references: [...registry.references,
      { ...registry.references[0], id: 'new-protected', text: 'New reserved evaluation intent' }] };
    expect(auditQueryLeakageV2({ candidate: ambiguous, registry: changed, adjudications: [approval] }).status).toBe('human_review');
  });
  it('rejects conflicting approvals and does not bypass missing checks', () => {
    expect(() => auditQueryLeakageV2({ candidate: ambiguous, registry,
      adjudications: [approval, { ...approval, id: 'conflict', decision: 'confirmed_leakage' }] })).toThrow('Conflicting Human');
    expect(auditQueryLeakageV2({ candidate: ambiguous, registry, adjudications: [approval],
      requireExternalCoverage: true }).status).toBe('incomplete');
  });
});

describe('Frozen 50-pair pilot regression (no model/provider calls)', () => {
  it('preserves all final decisions, original buckets and protected input bytes', () => {
    const root = process.cwd();
    const loaded = loadFrozenPilotLeakageV2(root);
    const actual = loaded.candidates.map(c => auditQueryLeakageV2({ candidate: c, registry: loaded.registry,
      adjudications: loaded.adjudications }));
    expect(actual.map(r => ({ queryId: r.queryId, status: r.status }))).toEqual(loaded.expected);
    expect(loaded.adjudications).toHaveLength(10);
    const base = loaded.candidates.map(c => auditQueryLeakageV2({ candidate: c, registry: loaded.registry }));
    expect(base.filter(r => r.status !== 'passed').map(r => r.queryId)).toEqual(['TP043']);
    expect(actual.find(r => r.queryId === 'TP043')).toMatchObject({ status: 'passed',
      appliedAdjudication: { date: '2026-11-25' } });
    expect(base.find(r => r.queryId === 'TP018')!.comparisons.find(c => c.referenceId === 'benchmark:G4-Q002')!
      .lexical.tokenContained).toBe(false);
    expect(loaded.pairs.find(r => r.queryId === 'TP018')!.pilotBucket).toBe('rejected_validation');
    for (const id of ['TP012', 'TP040']) expect(loaded.pairs.find(r => r.queryId === id)!.judgeSchemaPass).toBe(false);
    for (const file of loaded.inputs) expect(fileSha256(path.resolve(root, file.path))).toBe(file.sha256);
  }, 120_000);
});
