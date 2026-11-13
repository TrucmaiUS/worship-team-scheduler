import { z } from 'zod';
import {
  EvidenceStatusSchema,
  RelevanceScoreSchema,
} from './types';

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/iu);

export const GeneratedQueryCandidateSchema = z
  .object({
    schemaVersion: z.literal('generated-query-v3.0'),
    queryId: z.string().min(1),
    queryText: z.string().min(1),
    language: z.string().min(2),
    queryType: z.enum(['thematic', 'lyric', 'entity', 'other']),
    sourceTopicIds: z.array(z.string().regex(/^T\d{2}$/u)).min(1),
    sourceSongIds: z.array(z.string().min(1)).min(1),
    sourceSectionIds: z.array(z.string().min(1)).min(1),
    split: z.literal('train_candidate'),
    corpusManifestSha256: Sha256Schema,
    recordSha256: Sha256Schema,
  })
  .strict();

export const JudgmentArtifactSchema = z
  .object({
    schemaVersion: z.literal('relevance-judgment-v3.0'),
    judgmentId: z.string().min(1),
    queryId: z.string().min(1),
    candidateAlias: z.string().min(1),
    candidateSongId: z.string().min(1),
    candidateSectionId: z.string().min(1),
    judgeRole: z.enum(['gemini_teacher', 'gpt_independent_judge']),
    provider: z.enum(['google', 'openai']),
    modelId: z.string().min(1),
    promptVersion: z.string().min(1),
    promptSha256: Sha256Schema,
    requestSha256: Sha256Schema,
    rawResponseSha256: Sha256Schema,
    relevanceScore: RelevanceScoreSchema,
    evidenceQuotes: z.array(z.string()),
    reasoningSummary: z.string().min(1),
    evidenceStatus: EvidenceStatusSchema,
    schemaValid: z.boolean(),
    attempt: z.number().int().min(1).max(5),
    createdAtUtc: z.string().datetime(),
    recordSha256: Sha256Schema,
  })
  .strict();

export const ContrastiveTrainingExampleSchema = z
  .object({
    schemaVersion: z.literal('contrastive-training-example-v3.0'),
    trainingExampleId: z.string().min(1),
    queryId: z.string().min(1),
    queryText: z.string().min(1),
    positiveSongId: z.string().min(1),
    positiveSectionId: z.string().min(1),
    positivePassageText: z.string().min(1),
    explicitNegativeSectionIds: z.array(z.string().min(1)),
    sourceConsensusRecordIds: z.array(Sha256Schema).min(1),
    lossFamily: z.literal('relevance_aware_contrastive'),
    queryPrefix: z.literal('query: '),
    passagePrefix: z.literal('passage: '),
    falseNegativeAuditPassed: z.literal(true),
    split: z.literal('train'),
  })
  .strict();

export type GeneratedQueryCandidate = z.infer<typeof GeneratedQueryCandidateSchema>;
export type JudgmentArtifact = z.infer<typeof JudgmentArtifactSchema>;
export type ContrastiveTrainingExample = z.infer<
  typeof ContrastiveTrainingExampleSchema
>;
