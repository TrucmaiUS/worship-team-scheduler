import { z } from 'zod';
import type { PoolCandidate } from './candidate-pool';
import { blindPayload } from './candidate-pool';
import { hasForbiddenEvidenceSyntax } from './evidence';
import { TRAIN_TOPIC_IDS } from './split-integrity';
import { RelevanceScoreSchema } from './types';

const AliasSchema = z.string().regex(/^[A-Z][A-Z0-9_]*$/);

export const GenerationRequestSchema = z.object({
  allowed_topic: z.object({
    topic_id: z.string().regex(/^T\d{2}$/),
    title: z.string().min(1),
    description: z.string(),
  }).strict(),
  source_sections: z.array(z.object({
    section_alias: AliasSchema,
    lyrics: z.string().min(1),
  }).strict()).min(1).max(5),
  target_language: z.enum(['vi', 'en']),
  query_style: z.enum(['natural_thematic_request', 'lyric_paraphrase', 'ambiguous_request']),
  requested_count: z.number().int().min(1).max(5),
}).strict().superRefine((request, context) => {
  if (!TRAIN_TOPIC_IDS.has(request.allowed_topic.topic_id)) {
    context.addIssue({ code: 'custom', path: ['allowed_topic', 'topic_id'],
      message: 'Generation requires T01–T10.' });
  }
  const aliases = request.source_sections.map(section => section.section_alias);
  if (new Set(aliases).size !== aliases.length) {
    context.addIssue({ code: 'custom', path: ['source_sections'],
      message: 'Source aliases must be unique.' });
  }
});

export const GenerationResponseSchema = z.object({
  queries: z.array(z.object({
    query_text: z.string().min(1),
    language: z.enum(['vi', 'en']),
    query_type: z.enum(['thematic', 'lyric', 'entity', 'other']),
    source_section_aliases: z.array(AliasSchema).min(1),
    brief_intent_summary: z.string().min(1),
    contains_title_or_artist: z.boolean(),
    contains_verbatim_lyric_span: z.boolean(),
    possible_held_out_intent: z.boolean(),
  }).strict()).min(1).max(5),
}).strict();

export const BlindLabelRequestSchema = z.object({
  query_text: z.string().min(1),
  candidate: z.object({
    candidate_alias: AliasSchema,
    section_type: z.string().min(1),
    lyrics: z.string().min(1),
  }).strict(),
}).strict();

const RelevanceLabelSchema = z.enum([
  'Not Relevant', 'Partially Relevant', 'Relevant', 'Highly Relevant',
]);
const LABELS = [
  'Not Relevant', 'Partially Relevant', 'Relevant', 'Highly Relevant',
] as const;

export const EvidenceQuoteSchema = z.string().min(1)
  .refine(value => value.trim().length > 0, 'Evidence quotes must not be blank.')
  .refine(value => !hasForbiddenEvidenceSyntax(value),
    'Evidence quotes must not contain ellipsis or slash delimiters.');

export const BlindLabelResponseSchema = z.object({
  candidate_alias: AliasSchema,
  relevance_score: RelevanceScoreSchema,
  relevance_label: RelevanceLabelSchema,
  evidence_quotes: z.array(EvidenceQuoteSchema),
  reasoning_summary: z.string().min(10),
  is_lexical_overlap_only: z.boolean(),
}).strict().superRefine((response, context) => {
  if (response.relevance_label !== LABELS[response.relevance_score]) {
    context.addIssue({ code: 'custom', path: ['relevance_label'],
      message: 'Label must match numeric score.' });
  }
  if (response.relevance_score >= 2 && response.evidence_quotes.length === 0) {
    context.addIssue({ code: 'custom', path: ['evidence_quotes'],
      message: 'Grades 2–3 require evidence.' });
  }
  if (response.relevance_score === 0 && response.evidence_quotes.length !== 0) {
    context.addIssue({ code: 'custom', path: ['evidence_quotes'],
      message: 'Grade 0 requires an empty evidence array.' });
  }
});

export function validateGenerationResponse(requestInput: unknown, responseInput: unknown) {
  const request = GenerationRequestSchema.parse(requestInput);
  const response = GenerationResponseSchema.parse(responseInput);
  if (response.queries.length > request.requested_count) {
    throw new Error('Generation returned more queries than requested.');
  }
  const allowedAliases = new Set(request.source_sections.map(section => section.section_alias));
  for (const query of response.queries) {
    if (query.language !== request.target_language ||
        query.source_section_aliases.some(alias => !allowedAliases.has(alias)) ||
        query.contains_title_or_artist || query.contains_verbatim_lyric_span ||
        query.possible_held_out_intent) {
      throw new Error('Generation response violates the approved request boundary.');
    }
  }
  return response;
}

export function validateBlindLabelResponse(requestInput: unknown, responseInput: unknown) {
  const request = BlindLabelRequestSchema.parse(requestInput);
  const response = BlindLabelResponseSchema.parse(responseInput);
  if (response.candidate_alias !== request.candidate.candidate_alias) {
    throw new Error('Label response candidate alias mismatch.');
  }
  return response;
}

export function buildBlindLabelRequest(queryText: string, candidate: PoolCandidate) {
  return BlindLabelRequestSchema.parse(blindPayload(queryText, candidate));
}
