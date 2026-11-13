import { z } from 'zod';

export const RelevanceScoreSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);

export type RelevanceScore = z.infer<typeof RelevanceScoreSchema>;

export const EvidenceStatusSchema = z.enum(['valid', 'invalid', 'not_required']);
export type EvidenceStatus = z.infer<typeof EvidenceStatusSchema>;

export const JudgmentRoleSchema = z.enum([
  'gemini_teacher',
  'gpt_independent_judge',
]);
export type JudgmentRole = z.infer<typeof JudgmentRoleSchema>;

export const RelevanceJudgmentSchema = z
  .object({
    judgmentId: z.string().min(1),
    queryId: z.string().min(1),
    candidateSongId: z.string().min(1),
    candidateSectionId: z.string().min(1),
    role: JudgmentRoleSchema,
    provider: z.enum(['google', 'openai']),
    modelId: z.string().min(1),
    promptVersion: z.string().min(1),
    relevanceScore: RelevanceScoreSchema,
    evidenceQuotes: z.array(z.string()),
    reasoningSummary: z.string().min(1),
    schemaValid: z.boolean(),
    evidenceStatus: EvidenceStatusSchema,
  })
  .strict();

export type RelevanceJudgment = z.infer<typeof RelevanceJudgmentSchema>;

export type ConfidenceTier =
  | 'high_confidence'
  | 'medium_confidence'
  | 'major_disagreement'
  | 'invalid_evidence'
  | 'invalid_run_record';

export type TrainingUse =
  | 'positive'
  | 'explicit_negative'
  | 'partial_relevance_excluded'
  | 'separate_medium_confidence'
  | 'excluded';

export interface ConsensusRecord {
  queryId: string;
  candidateSongId: string;
  candidateSectionId: string;
  teacherJudgmentId: string;
  judgeJudgmentId: string;
  teacherScore: RelevanceScore;
  judgeScore: RelevanceScore;
  absoluteDelta: number;
  confidenceTier: ConfidenceTier;
  consensusGrade: RelevanceScore | null;
  automaticTrainingEligible: boolean;
  trainingUse: TrainingUse;
  exclusionReasons: string[];
}

export interface ReferenceText {
  id: string;
  text: string;
  scope: 'development' | 'diagnostic' | 'external' | 'synthetic';
}

export interface LeakageThresholds {
  maxWordJaccard: number;
  maxCharTrigramJaccard: number;
  minNormalizedLevenshteinDistance: number;
  rejectFrozenE5CosineAbove: number;
  reviewFrozenE5CosineAtOrAbove: number;
}

export const DEFAULT_LEAKAGE_THRESHOLDS: LeakageThresholds = {
  maxWordJaccard: 0.35,
  maxCharTrigramJaccard: 0.45,
  minNormalizedLevenshteinDistance: 0.3,
  rejectFrozenE5CosineAbove: 0.8,
  reviewFrozenE5CosineAtOrAbove: 0.75,
};

export type LeakageDecision = 'passed' | 'rejected' | 'human_review' | 'incomplete';

export interface LeakageAuditResult {
  exactMatchFound: boolean;
  substringMatchFound: boolean;
  maxWordJaccard: number;
  maxCharTrigramJaccard: number;
  minNormalizedLevenshteinDistance: number;
  maxFrozenE5Cosine: number | null;
  closestReferenceId: string | null;
  heldOutIntentFlag: boolean;
  decision: LeakageDecision;
  reasons: string[];
}
