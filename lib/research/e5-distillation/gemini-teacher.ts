import crypto from 'node:crypto';
import { z } from 'zod';
import {
  GenerationRequestSchema,
  validateGenerationResponse,
} from './request-contracts';
import { sha256CanonicalJson } from './groq-judge';

export const GEMINI_TEACHER_MODEL_ID = 'gemini-3.1-flash-lite' as const;
export const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export const GEMINI_TEACHER_RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    queries: {
      type: 'array',
      minItems: 1,
      maxItems: 5,
      items: {
        type: 'object',
        properties: {
          query_text: { type: 'string', minLength: 1 },
          language: { type: 'string', enum: ['vi', 'en'] },
          query_type: { type: 'string', enum: ['thematic', 'lyric', 'entity', 'other'] },
          source_section_aliases: {
            type: 'array',
            minItems: 1,
            items: { type: 'string', pattern: '^[A-Z][A-Z0-9_]*$' },
          },
          brief_intent_summary: { type: 'string', minLength: 1 },
          contains_title_or_artist: { type: 'boolean' },
          contains_verbatim_lyric_span: { type: 'boolean' },
          possible_held_out_intent: { type: 'boolean' },
        },
        required: [
          'query_text',
          'language',
          'query_type',
          'source_section_aliases',
          'brief_intent_summary',
          'contains_title_or_artist',
          'contains_verbatim_lyric_span',
          'possible_held_out_intent',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['queries'],
  additionalProperties: false,
} as const;

const GeminiTeacherConfigSchema = z.object({
  role: z.literal('gemini_teacher'),
  task: z.literal('generation'),
  provider: z.literal('google'),
  modelId: z.literal(GEMINI_TEACHER_MODEL_ID),
  promptVersion: z.string().min(1),
  promptSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  responseSchemaSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  responseFormat: z.literal('json_schema'),
  allowFallback: z.literal(false),
  maxAttempts: z.number().int().min(1).max(5),
  maxTransientRetries: z.number().int().min(0).max(20),
  maxOutputTokens: z.number().int().min(64).max(8192),
  timeoutMs: z.number().int().min(1_000).max(300_000),
  temperature: z.number().min(0).max(2),
  topP: z.number().min(0).max(1),
  seed: z.number().int(),
  thinkingLevel: z.enum(['minimal', 'low', 'medium', 'high']),
}).strict();

export type GeminiTeacherConfig = z.infer<typeof GeminiTeacherConfigSchema>;
type GenerationRequest = z.infer<typeof GenerationRequestSchema>;
type GenerationResponse = ReturnType<typeof validateGenerationResponse>;

interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
}

export interface GeminiTeacherProviderResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
    finishReason?: string;
  }>;
  usageMetadata?: GeminiUsageMetadata;
  modelVersion?: string;
  responseId?: string;
}

export interface GeminiTeacherAttemptLog {
  provider: 'google';
  modelId: typeof GEMINI_TEACHER_MODEL_ID;
  attempt: number;
  generationAttempt: number | null;
  seed: number;
  requestSha256: string;
  responseSha256: string | null;
  promptSha256: string;
  responseSchemaSha256: string;
  httpStatus: number | null;
  latencyMs: number;
  usage: {
    inputTokens: number | null;
    visibleOutputTokens: number | null;
    thoughtTokens: number | null;
    totalTokens: number | null;
  };
  providerRequestId: string | null;
  modelVersion: string | null;
  finishReason: string | null;
  failureCode: string | null;
  failureDetail: string | null;
  retryable: boolean;
}

export interface GeminiTeacherResult {
  provider: 'google';
  modelId: typeof GEMINI_TEACHER_MODEL_ID;
  output: GenerationResponse;
  attempts: GeminiTeacherAttemptLog[];
  providerResponse: GeminiTeacherProviderResponse;
}

export interface GeminiTeacherOptions {
  apiKey: string;
  config: unknown;
  systemPrompt: string;
  request: GenerationRequest;
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  onAttempt?: (log: GeminiTeacherAttemptLog) => void;
}

export function geminiTeacherResponseSchemaSha256(): string {
  return sha256CanonicalJson(GEMINI_TEACHER_RESPONSE_JSON_SCHEMA);
}

export function parseGeminiTeacherConfig(input: unknown): GeminiTeacherConfig {
  const config = GeminiTeacherConfigSchema.parse(input);
  const schemaHash = geminiTeacherResponseSchemaSha256();
  if (config.responseSchemaSha256 !== schemaHash) {
    throw new Error(`Gemini Teacher response schema hash mismatch: expected ${schemaHash}.`);
  }
  return config;
}

export function buildGeminiTeacherEnvelope(
  configInput: unknown,
  systemPrompt: string,
  requestInput: unknown,
  seed?: number
): Record<string, unknown> {
  const config = parseGeminiTeacherConfig(configInput);
  const request = GenerationRequestSchema.parse(requestInput);
  return {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: JSON.stringify(request) }] }],
    generationConfig: {
      candidateCount: 1,
      temperature: config.temperature,
      topP: config.topP,
      seed: seed ?? config.seed,
      maxOutputTokens: config.maxOutputTokens,
      thinkingConfig: { thinkingLevel: config.thinkingLevel },
      responseMimeType: 'application/json',
      responseJsonSchema: GEMINI_TEACHER_RESPONSE_JSON_SCHEMA,
    },
  };
}

function retryableStatus(status: number): boolean {
  return [408, 409, 429, 500, 502, 503, 504].includes(status);
}

function retryDelayMs(attempt: number, retryAfter: string | null): number {
  const seconds = retryAfter === null ? Number.NaN : Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(60_000, seconds * 1000 + 250);
  return Math.min(10_000, 750 * 2 ** (attempt - 1));
}

function usageFrom(payload: GeminiTeacherProviderResponse): GeminiTeacherAttemptLog['usage'] {
  return {
    inputTokens: payload.usageMetadata?.promptTokenCount ?? null,
    visibleOutputTokens: payload.usageMetadata?.candidatesTokenCount ?? null,
    thoughtTokens: payload.usageMetadata?.thoughtsTokenCount ?? null,
    totalTokens: payload.usageMetadata?.totalTokenCount ?? null,
  };
}

export async function callGeminiTeacher(options: GeminiTeacherOptions): Promise<GeminiTeacherResult> {
  if (!options.apiKey.trim()) throw new Error('GEMINI_API_KEY is missing.');
  const config = parseGeminiTeacherConfig(options.config);
  const request = GenerationRequestSchema.parse(options.request);
  const attempts: GeminiTeacherAttemptLog[] = [];
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((milliseconds: number) =>
    new Promise<void>(resolve => setTimeout(resolve, milliseconds)));
  let requestAttempt = 0;
  let generationAttempts = 0;
  let transientFailures = 0;

  while (generationAttempts < config.maxAttempts) {
    requestAttempt += 1;
    const attemptSeed = config.seed + generationAttempts;
    const envelope = buildGeminiTeacherEnvelope(config, options.systemPrompt, request, attemptSeed);
    const requestSha256 = sha256CanonicalJson(envelope);
    const started = Date.now();
    let response: Response | null = null;
    let raw = '';
    let payload: GeminiTeacherProviderResponse = {};
    let failureCode: string | null = null;
    let failureDetail: string | null = null;
    let retryable = false;
    let generationAttempted = false;
    try {
      response = await fetchImpl(`${GEMINI_API_BASE_URL}/models/${config.modelId}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': options.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(envelope),
        signal: AbortSignal.timeout(config.timeoutMs),
      });
      raw = await response.text();
      if (!response.ok) {
        failureCode = `http_${response.status}`;
        failureDetail = raw.slice(0, 4000);
        retryable = retryableStatus(response.status);
      } else {
        generationAttempted = true;
        payload = JSON.parse(raw) as GeminiTeacherProviderResponse;
        if (payload.modelVersion && !payload.modelVersion.includes(config.modelId)) {
          throw new Error(`Gemini model identity mismatch: ${payload.modelVersion}.`);
        }
        const content = payload.candidates?.[0]?.content?.parts
          ?.filter(part => !part.thought)
          .map(part => part.text ?? '')
          .join('')
          .trim();
        if (!content) throw new Error('Gemini returned no Teacher message content.');
        const output = validateGenerationResponse(request, JSON.parse(content));
        const log: GeminiTeacherAttemptLog = {
          provider: 'google', modelId: config.modelId, attempt: requestAttempt,
          generationAttempt: generationAttempts + 1, seed: attemptSeed, requestSha256,
          responseSha256: sha256CanonicalJson(payload), promptSha256: config.promptSha256,
          responseSchemaSha256: config.responseSchemaSha256,
          httpStatus: response.status, latencyMs: Date.now() - started,
          usage: usageFrom(payload), providerRequestId: payload.responseId ?? null,
          modelVersion: payload.modelVersion ?? null,
          finishReason: payload.candidates?.[0]?.finishReason ?? null,
          failureCode: null, failureDetail: null, retryable: false,
        };
        attempts.push(log);
        options.onAttempt?.(log);
        return { provider: 'google', modelId: config.modelId, output, attempts, providerResponse: payload };
      }
    } catch (error) {
      generationAttempted = response?.ok === true;
      failureDetail = error instanceof Error ? error.message : String(error);
      failureCode = error instanceof SyntaxError
        ? 'invalid_json'
        : error instanceof Error && error.name === 'ZodError'
          ? 'schema_validation_failure'
          : error instanceof Error && error.name === 'TimeoutError'
            ? 'timeout'
            : /model identity mismatch/iu.test(failureDetail)
              ? 'model_identity_mismatch'
              : 'protocol_or_runtime_failure';
      retryable = !/model identity mismatch/iu.test(failureDetail);
    }

    if (generationAttempted) generationAttempts += 1;
    else transientFailures += 1;
    const log: GeminiTeacherAttemptLog = {
      provider: 'google', modelId: config.modelId, attempt: requestAttempt,
      generationAttempt: generationAttempted ? generationAttempts : null,
      seed: attemptSeed, requestSha256,
      responseSha256: raw ? crypto.createHash('sha256').update(raw).digest('hex') : null,
      promptSha256: config.promptSha256, responseSchemaSha256: config.responseSchemaSha256,
      httpStatus: response?.status ?? null, latencyMs: Date.now() - started,
      usage: usageFrom(payload), providerRequestId: payload.responseId ?? null,
      modelVersion: payload.modelVersion ?? null,
      finishReason: payload.candidates?.[0]?.finishReason ?? null,
      failureCode, failureDetail, retryable,
    };
    attempts.push(log);
    options.onAttempt?.(log);
    if (!retryable || generationAttempts >= config.maxAttempts ||
        transientFailures > config.maxTransientRetries) {
      throw new Error(
        `Gemini Teacher stopped without fallback after request ${requestAttempt} and ` +
        `generation ${generationAttempts}/${config.maxAttempts}: ${failureCode} (${failureDetail}).`
      );
    }
    await sleep(retryDelayMs(requestAttempt, response?.headers.get('retry-after') ?? null));
  }
  throw new Error('Gemini Teacher exhausted attempts without a result.');
}
