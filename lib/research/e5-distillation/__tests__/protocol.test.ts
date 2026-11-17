import { describe, expect, it } from 'vitest';
import {
  RelevanceJudgment,
  RelevanceScore,
} from '../types';
import { auditQueryLeakage } from '../leakage';
import { validateEvidence } from '../evidence';
import { buildConsensusRecord } from '../consensus';
import {
  auditContrastiveBatch,
  buildKnownRelevanceGraph,
} from '../relevance-graph';
import {
  assertPinnedProviderIdentity,
  parsePinnedProviderConfig,
} from '../research-config';
import { validateGenerationSource } from '../split-integrity';

function judgment(
  role: RelevanceJudgment['role'],
  score: RelevanceScore,
  overrides: Partial<RelevanceJudgment> = {}
): RelevanceJudgment {
  return {
    judgmentId: role === 'gemini_teacher' ? 'teacher-1' : 'judge-1',
    queryId: 'Q1',
    candidateSongId: 'song-A',
    candidateSectionId: 'section-A',
    role,
    provider: role === 'gemini_teacher' ? 'google' : 'openai',
    modelId: role === 'gemini_teacher' ? 'gemini-pinned' : 'gpt-pinned',
    promptVersion: 'v3.0',
    relevanceScore: score,
    evidenceQuotes: score >= 2 ? ['Ngài dẫn lối con đi'] : [],
    reasoningSummary: 'Synthetic test rationale.',
    schemaValid: true,
    evidenceStatus: score >= 2 ? 'valid' : 'not_required',
    ...overrides,
  };
}

describe('offline Milestone 2 research controls', () => {
  describe('leakage audit', () => {
    const references = [
      {
        id: 'DEV-1',
        text: 'Tìm bài hát về lòng tin cậy Chúa trong bão tố',
        scope: 'development' as const,
      },
    ];

    it('rejects exact or near-duplicate protected queries', () => {
      const result = auditQueryLeakage({
        queryText: 'Tìm bài hát về lòng tin cậy Chúa trong bão tố',
        references,
      });

      expect(result.decision).toBe('rejected');
      expect(result.reasons).toContain('exact_match');
    });

    it('fails incomplete when the required frozen-E5 check is missing', () => {
      const result = auditQueryLeakage({
        queryText: 'Khúc ca về niềm hy vọng được đổi mới mỗi ngày',
        references,
      });

      expect(result.decision).toBe('incomplete');
      expect(result.reasons).toContain('semantic_check_missing');
    });

    it('routes the semantic ambiguity band to human review', () => {
      const result = auditQueryLeakage({
        queryText: 'Khúc ca về niềm hy vọng được đổi mới mỗi ngày',
        references,
        frozenE5CosineByReferenceId: { 'DEV-1': 0.78 },
      });

      expect(result.decision).toBe('human_review');
    });

    it('keeps a partial semantic comparison incomplete', () => {
      const result = auditQueryLeakage({
        queryText: 'Khúc ca về niềm hy vọng được đổi mới mỗi ngày',
        references: [...references, {
          id: 'DEV-2',
          text: 'Tìm bài hát về tình yêu của hội thánh',
          scope: 'development',
        }],
        frozenE5CosineByReferenceId: { 'DEV-1': 0.2 },
      });
      expect(result.decision).toBe('incomplete');
    });

    it('sends ambiguous held-out vocabulary to human review', () => {
      const result = auditQueryLeakage({
        queryText: 'Khúc ca về niềm hy vọng được đổi mới mỗi ngày',
        references,
        frozenE5CosineByReferenceId: { 'DEV-1': 0.2 },
        requiresHumanReview: true,
      });
      expect(result.decision).toBe('human_review');
    });

    it('rejects a held-out intent even when lexical checks are low', () => {
      const result = auditQueryLeakage({
        queryText: 'Một lời cầu xin được sai đi đến muôn dân',
        references,
        frozenE5CosineByReferenceId: { 'DEV-1': 0.2 },
        heldOutIntentFlag: true,
      });

      expect(result.decision).toBe('rejected');
      expect(result.reasons).toContain('held_out_intent');
    });
  });

  describe('evidence verification', () => {
    const lyrics = 'Giữa đêm tối Ngài vẫn dẫn lối con đi\nLòng con tin cậy nơi Ngài';

    it('accepts meaningful verbatim evidence for grade 3', () => {
      const result = validateEvidence(
        lyrics,
        ['Ngài vẫn dẫn lối con đi'],
        3
      );
      expect(result.status).toBe('valid');
    });

    it('rejects hallucinated evidence for grade 2', () => {
      const result = validateEvidence(lyrics, ['Ngài dời núi trước mắt con'], 2);
      expect(result.status).toBe('invalid');
      expect(result.reasons).toContain('evidence_not_verbatim_substring');
    });

    it('allows grade 0 without a quote', () => {
      expect(validateEvidence(lyrics, [], 0).status).toBe('not_required');
    });

    it('accepts multiple separate contiguous spans', () => {
      const result = validateEvidence(lyrics, [
        'Giữa đêm tối',
        'Lòng con tin cậy nơi Ngài',
      ], 3);
      expect(result.status).toBe('valid');
    });

    it('requires exact case and whitespace for verbatim evidence', () => {
      expect(validateEvidence(lyrics, ['ngài vẫn dẫn lối con đi'], 2).status).toBe('invalid');
      expect(validateEvidence(lyrics, ['Giữa đêm tối\nNgài vẫn dẫn lối con đi'], 2).status)
        .toBe('invalid');
    });

    it('rejects ellipsis, slash delimiters, and grade 0 evidence', () => {
      expect(validateEvidence(lyrics, ['Ngài vẫn...con đi'], 2).reasons)
        .toContain('evidence_contains_ellipsis_or_slash');
      expect(validateEvidence(lyrics, ['Giữa đêm tối / Lòng con tin cậy nơi Ngài'], 2).reasons)
        .toContain('evidence_contains_ellipsis_or_slash');
      expect(validateEvidence(lyrics, ['Giữa đêm tối'], 0).reasons)
        .toContain('grade_zero_evidence_must_be_empty');
    });
  });

  describe('consensus policy', () => {
    it('accepts delta-zero positives with valid evidence', () => {
      const result = buildConsensusRecord(
        judgment('gemini_teacher', 3),
        judgment('gpt_independent_judge', 3)
      );
      expect(result.confidenceTier).toBe('high_confidence');
      expect(result.automaticTrainingEligible).toBe(true);
      expect(result.trainingUse).toBe('positive');
    });

    it('keeps agreed grade 1 out of automatic negative training', () => {
      const result = buildConsensusRecord(
        judgment('gemini_teacher', 1),
        judgment('gpt_independent_judge', 1)
      );
      expect(result.confidenceTier).toBe('high_confidence');
      expect(result.automaticTrainingEligible).toBe(false);
      expect(result.trainingUse).toBe('partial_relevance_excluded');
    });

    it('separates delta-one records', () => {
      const result = buildConsensusRecord(
        judgment('gemini_teacher', 3),
        judgment('gpt_independent_judge', 2)
      );
      expect(result.confidenceTier).toBe('medium_confidence');
      expect(result.consensusGrade).toBeNull();
      expect(result.automaticTrainingEligible).toBe(false);
    });

    it('excludes delta-two-or-more records', () => {
      const result = buildConsensusRecord(
        judgment('gemini_teacher', 3),
        judgment('gpt_independent_judge', 0)
      );
      expect(result.confidenceTier).toBe('major_disagreement');
      expect(result.automaticTrainingEligible).toBe(false);
    });
  });

  describe('multi-positive and false-negative audit', () => {
    it('detects a known positive from another row becoming an in-batch negative', () => {
      const records = [
        buildConsensusRecord(
          judgment('gemini_teacher', 3),
          judgment('gpt_independent_judge', 3)
        ),
        buildConsensusRecord(
          judgment('gemini_teacher', 2, {
            judgmentId: 'teacher-2',
            candidateSongId: 'song-B',
            candidateSectionId: 'section-B',
          }),
          judgment('gpt_independent_judge', 2, {
            judgmentId: 'judge-2',
            candidateSongId: 'song-B',
            candidateSectionId: 'section-B',
          })
        ),
        buildConsensusRecord(
          judgment('gemini_teacher', 2, {
            judgmentId: 'teacher-3',
            queryId: 'Q2',
            candidateSongId: 'song-B',
            candidateSectionId: 'section-B',
          }),
          judgment('gpt_independent_judge', 2, {
            judgmentId: 'judge-3',
            queryId: 'Q2',
            candidateSongId: 'song-B',
            candidateSectionId: 'section-B',
          })
        ),
      ];

      const graph = buildKnownRelevanceGraph(records);
      const audit = auditContrastiveBatch(
        [
          {
            exampleId: 'E1',
            queryId: 'Q1',
            positiveSongId: 'song-A',
            positiveSectionId: 'section-A',
          },
          {
            exampleId: 'E2',
            queryId: 'Q2',
            positiveSongId: 'song-B',
            positiveSectionId: 'section-B',
          },
        ],
        graph
      );

      expect(audit.passed).toBe(false);
      expect(audit.violations.some((item) => item.type === 'in_batch_false_negative')).toBe(
        true
      );
    });
  });

  describe('fail-closed provider configuration', () => {
    const validConfig = {
      role: 'gemini_teacher' as const,
      task: 'label' as const,
      provider: 'google' as const,
      modelId: 'gemini-concrete-model',
      promptVersion: 'gemini-relevance-label-v3.0',
      promptSha256: 'a'.repeat(64),
      allowFallback: false as const,
      maxAttempts: 3,
      maxOutputTokens: 512,
      timeoutMs: 30000,
      responseSchemaSha256: 'b'.repeat(64),
      temperature: 0,
      topP: 0.95,
    };

    it('rejects placeholder model IDs and fallback-enabled configs', () => {
      expect(() =>
        parsePinnedProviderConfig({ ...validConfig, modelId: '<pending-model-id>' })
      ).toThrow();
      expect(() =>
        parsePinnedProviderConfig({ ...validConfig, allowFallback: true })
      ).toThrow();
    });

    it('stops when the observed model differs from the pin', () => {
      const config = parsePinnedProviderConfig(validConfig);
      expect(() =>
        assertPinnedProviderIdentity(config, {
          provider: 'google',
          modelId: 'different-model',
        })
      ).toThrow(/Model mismatch/);
    });

    it('permits a GPT Judge config without unsupported temperature and forbids generation', () => {
      const { temperature: _temperature, topP: _topP, ...base } = validConfig;
      const judge = { ...base, role: 'gpt_independent_judge' as const,
        provider: 'openai' as const, modelId: 'gpt-5.4-mini-2026-03-17',
        reasoningEffort: 'none' as const };
      expect(parsePinnedProviderConfig(judge).temperature).toBeUndefined();
      expect(() => parsePinnedProviderConfig({ ...judge, task: 'generation' })).toThrow();
    });
  });

  describe('split integrity', () => {
    const policy = {
      anchorSongIds: new Set(['anchor-song']),
      protectedQueryIds: new Set(['G2-Q011', 'EXT-Q001']),
    };

    it('accepts an eligible T01-T10 source', () => {
      const result = validateGenerationSource(
        { topicIds: ['T08'], songIds: ['song-A'], sectionIds: ['section-A'] },
        policy
      );
      expect(result.eligible).toBe(true);
    });

    it('rejects diagnostic topics, anchors, and protected queries', () => {
      const result = validateGenerationSource(
        {
          topicIds: ['T11'],
          songIds: ['anchor-song'],
          sectionIds: ['section-A'],
          referencedQueryIds: ['G2-Q011'],
        },
        policy
      );
      expect(result.eligible).toBe(false);
      expect(result.reasons).toEqual(
        expect.arrayContaining([
          'diagnostic_topic_prohibited:T11',
          'anchor_song_prohibited:anchor-song',
          'protected_query_prohibited:G2-Q011',
        ])
      );
    });
  });
});
