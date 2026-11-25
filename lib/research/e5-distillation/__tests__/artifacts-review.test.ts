import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ArtifactStore, recordId } from '../artifacts';
import { buildCandidatePool, blindPayload } from '../candidate-pool';
import type { CorpusSnapshot } from '../corpus';
import { auditQueryLeakage } from '../leakage';
import { inspectHeldOutIntent } from '../held-out-intent';
import { validateEvidence } from '../evidence';
import { buildConsensusRecord } from '../consensus';
import { auditContrastiveBatch, buildKnownRelevanceGraph } from '../relevance-graph';
import { queueLeakageReview, recordReviewDecision, recordReviewResolution, resolveLeakageReview } from '../review';
import { ContrastiveTrainingExampleSchema, GeneratedQueryCandidateSchema } from '../schemas';
import type { RelevanceJudgment } from '../types';

const snapshot: CorpusSnapshot = {
  sha256: 'fixture',
  anchorSongIds: ['anchor'],
  songs: [],
  eligibleSongs: [
    { songId: 'A', title: 'Hidden title A', artist: 'Hidden artist A', sections: [
      { songId: 'A', sectionId: 'A1', sectionType: 'verse', sectionLabel: 'Verse', lyrics: 'Chúa dẫn con qua đêm tối, ban niềm hy vọng', passageText: 'Song: Hidden title A\nSection: [Verse]\nChúa dẫn con qua đêm tối, ban niềm hy vọng' },
    ] },
    { songId: 'B', title: 'Hidden title B', artist: 'Hidden artist B', sections: [
      { songId: 'B', sectionId: 'B1', sectionType: 'chorus', sectionLabel: 'Chorus', lyrics: 'Lời ca về ánh nắng và cánh đồng', passageText: 'Song: Hidden title B\nSection: [Chorus]\nLời ca về ánh nắng và cánh đồng' },
    ] },
  ],
};

function judgment(role: RelevanceJudgment['role'], score: 0 | 3, candidate: 'A' | 'B'): RelevanceJudgment {
  return {
    judgmentId: role + candidate,
    queryId: 'SYN-FIXTURE-1',
    candidateSongId: candidate,
    candidateSectionId: candidate + '1',
    role,
    provider: role === 'gemini_teacher' ? 'google' : 'openai',
    modelId: 'offline-fixture',
    promptVersion: 'fixture',
    relevanceScore: score,
    evidenceQuotes: score === 3 ? ['Chúa dẫn con qua đêm tối'] : [],
    reasoningSummary: 'Fixture judgment, not a research label.',
    schemaValid: true,
    evidenceStatus: score === 3 ? 'valid' : 'not_required',
  };
}

describe('Phase 1 offline integration', () => {
  it('moves a fixture from leakage to a resumable, audited training candidate', () => {
    const query = 'Tìm khúc ca về hy vọng khi gặp đêm tối';
    const generated = GeneratedQueryCandidateSchema.parse({
      schemaVersion: 'generated-query-v3.0',
      queryId: 'SYN-FIXTURE-1', queryText: query,
      language: 'vi', queryType: 'thematic',
      sourceTopicIds: ['T01'], sourceSongIds: ['A'], sourceSectionIds: ['A1'],
      split: 'train_candidate', corpusManifestSha256: 'a'.repeat(64),
      recordSha256: 'b'.repeat(64),
    });
    const intent = inspectHeldOutIntent(query);
    const leakage = auditQueryLeakage({
      queryText: query,
      references: [{ id: 'DEV-1', scope: 'development', text: 'Bài ca về sự hiệp một của hội thánh' }],
      frozenE5CosineByReferenceId: { 'DEV-1': 0.12 },
      heldOutIntentFlag: intent.explicit,
    });
    expect(leakage.decision).toBe('passed');
    expect(intent.requiresHumanReview).toBe(false);

    const pool = buildCandidatePool(snapshot, {
      queryId: 'SYN-FIXTURE-1',
      queryText: query,
      sourceSectionId: 'A1',
      lexicalDepth: 1,
      e5Depth: 1,
      controlCount: 2,
      e5Scores: new Map([['A1', 0.8], ['B1', 0.1]]),
      seed: 'fixture-seed',
    });
    expect(pool).toHaveLength(2);
    const payload = blindPayload(query, pool[0]);
    expect(JSON.stringify(payload)).not.toContain('Hidden title');
    expect(JSON.stringify(payload)).not.toContain('songId');

    const evidence = validateEvidence(snapshot.eligibleSongs[0].sections[0].lyrics,
      ['Chúa dẫn con qua đêm tối'], 3);
    expect(evidence.status).toBe('valid');
    const positives = buildConsensusRecord(judgment('gemini_teacher', 3, 'A'),
      judgment('gpt_independent_judge', 3, 'A'));
    const negatives = buildConsensusRecord(judgment('gemini_teacher', 0, 'B'),
      judgment('gpt_independent_judge', 0, 'B'));
    const graph = buildKnownRelevanceGraph([positives, negatives]);
    const batch = auditContrastiveBatch([{
      exampleId: 'fixture-example',
      queryId: 'SYN-FIXTURE-1',
      positiveSongId: 'A',
      positiveSectionId: 'A1',
      explicitNegativeSectionIds: ['B1'],
    }], graph);
    expect(batch.passed).toBe(true);
    const trainingCandidate = ContrastiveTrainingExampleSchema.parse({
      schemaVersion: 'contrastive-training-example-v3.0',
      trainingExampleId: 'fixture-example', queryId: generated.queryId,
      queryText: query, positiveSongId: 'A', positiveSectionId: 'A1',
      positivePassageText: snapshot.eligibleSongs[0].sections[0].passageText,
      explicitNegativeSectionIds: ['B1'], sourceConsensusRecordIds: ['c'.repeat(64)],
      lossFamily: 'relevance_aware_contrastive', queryPrefix: 'query: ',
      passagePrefix: 'passage: ', falseNegativeAuditPassed: true, split: 'train',
    });

    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'e5-phase1-'));
    try {
      const store = new ArtifactStore(temp);
      store.writeRecord('generated_queries', recordId('generated', generated), generated);
      store.writeRecord('leakage_decisions', recordId('leakage', leakage), leakage);
      const id = recordId('fixture', { query, pool });
      const artifact = { generated, leakage, pool, evidence, positives, negatives, batch, trainingCandidate };
      const hash = store.writeRecord('training_candidates', id, artifact);
      expect(store.writeRecord('training_candidates', id, artifact)).toBe(hash);
      expect(store.readRecord<typeof artifact>('training_candidates', id)).toEqual(artifact);
      const manifest = store.materializeJsonl('training_candidates', ['a'.repeat(64)]);
      expect(manifest.recordCount).toBe(1);
      expect(manifest.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(store.materializeJsonl('training_candidates', ['a'.repeat(64)])).toEqual(manifest);
      expect(store.materializeJsonl('generated_queries').recordCount).toBe(1);
      expect(store.materializeJsonl('leakage_decisions').recordCount).toBe(1);
      expect(() => store.writeRecord('training_candidates', id, { changed: true })).toThrow();
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
  });

  it('rejects incomplete semantic scores and keeps explicit held-out intent closed', () => {
    expect(() => buildCandidatePool(snapshot, {
      queryId: 'Q', queryText: 'text', sourceSectionId: 'A1',
      lexicalDepth: 1, e5Depth: 1, controlCount: 1,
      e5Scores: new Map([['A1', 0.5]]), seed: 'x',
    })).toThrow(/Complete frozen E5 scores/);
    expect(inspectHeldOutIntent('Holy Spirit as guide to all truth').explicit).toBe(true);
  });

  it('persists ambiguous intent for a named human reviewer without auto approval', () => {
    const audit = auditQueryLeakage({
      queryText: 'Bài ca về sự hướng dẫn của Thánh Linh',
      references: [{ id: 'DEV', scope: 'development', text: 'Khúc hát về tình yêu thương' }],
      frozenE5CosineByReferenceId: { DEV: 0.3 },
      requiresHumanReview: true,
    });
    expect(audit.decision).toBe('human_review');
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'e5-review-'));
    try {
      const store = new ArtifactStore(temp);
      const reviewId = queueLeakageReview(store, 'SYN-REVIEW', 'Bài ca về sự hướng dẫn của Thánh Linh', audit, 'a'.repeat(64));
      expect(store.readRecord<{ status: string }>('review_queue', reviewId).status).toBe('pending_human_review');
      const firstReview = {
        reviewId, queryId: 'SYN-REVIEW', reviewerId: 'reviewer-fixture',
        reviewerRole: 'first_reviewer' as const,
        decision: 'discarded', rationale: 'Specialized held-out intent is too close.',
        decidedAtUtc: '2026-11-13T00:00:00Z', policyVersion: 'v1',
      };
      const decisionId = recordReviewDecision(store, firstReview);
      expect(store.hasRecord('review_decisions', decisionId)).toBe(true);
      expect(resolveLeakageReview([firstReview]).status).toBe('pending_second_review');
      const secondReview = { ...firstReview, reviewerId: 'second-fixture',
        reviewerRole: 'second_reviewer' as const };
      expect(resolveLeakageReview([firstReview, secondReview]).finalDecision).toBe('discarded');
      const secondDecisionId = recordReviewDecision(store, secondReview);
      const resolutionId = recordReviewResolution(store, [decisionId, secondDecisionId]);
      expect(store.readRecord<{ finalDecision: string }>('review_resolutions', resolutionId)
        .finalDecision).toBe('discarded');
      const disagreement = { ...secondReview, decision: 'passed' as const };
      expect(resolveLeakageReview([firstReview, disagreement]).status).toBe('pending_adjudication');
      const adjudicator = { ...firstReview, reviewerId: 'adjudicator-fixture',
        reviewerRole: 'adjudicator' as const, decision: 'discarded' as const };
      expect(resolveLeakageReview([firstReview, disagreement, adjudicator]).finalDecision).toBe('discarded');
      expect(() => resolveLeakageReview([firstReview, { ...secondReview,
        reviewerId: firstReview.reviewerId,
      }])).toThrow(/Independent reviewers/);
      expect(() => recordReviewDecision(store, {
        reviewId, queryId: 'DIFFERENT-QUERY', reviewerId: 'reviewer-fixture',
        reviewerRole: 'first_reviewer',
        decision: 'passed', rationale: 'Mismatched query must be rejected.',
        decidedAtUtc: '2026-11-13T00:00:00Z', policyVersion: 'v1',
      })).toThrow(/does not match/);
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
  });
});
