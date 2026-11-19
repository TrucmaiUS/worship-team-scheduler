import crypto from 'node:crypto';
import { z } from 'zod';
import {
  GROQ_JUDGE_RESPONSE_JSON_SCHEMA,
  groqJudgeResponseSchemaSha256,
  sha256CanonicalJson,
} from './groq-judge';
import { validateEvidence, type EvidenceValidationResult } from './evidence';
import { validateBlindLabelResponse } from './request-contracts';

export const GEMINI_SUPPLEMENTAL_MODEL_ID = 'gemini-3.1-flash-lite' as const;
export const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

const GeminiJudgeConfigSchema = z.object({
  role: z.literal('supplemental_independent_judge'),
  task: z.literal('label'),
  provider: z.literal('google'),
  modelId: z.literal(GEMINI_SUPPLEMENTAL_MODEL_ID),
  promptVersion: z.string().min(1),
  promptSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  responseSchemaSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  responseFormat: z.literal('json_schema'),
  allowFallback: z.literal(false),
  maxAttempts: z.number().int().min(1).max(5),
  maxTransientRetries: z.number().int().min(0).max(20),
  maxOutputTokens: z.number().int().min(64),
  timeoutMs: z.number().int().min(1_000),
  temperature: z.number().min(0).max(2),
  topP: z.number().min(0).max(1),
  seed: z.number().int(),
  thinkingLevel: z.enum(['minimal', 'low', 'medium', 'high']),
}).strict();

export type GeminiJudgeConfig = z.infer<typeof GeminiJudgeConfigSchema>;
type BlindLabelRequest = Parameters<typeof validateBlindLabelResponse>[0];
type BlindLabelResponse = ReturnType<typeof validateBlindLabelResponse>;

interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
  cachedContentTokenCount?: number;
}

export interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
    finishReason?: string;
    index?: number;
  }>;
  usageMetadata?: GeminiUsageMetadata;
  modelVersion?: string;
  responseId?: string;
  promptFeedback?: unknown;
}

export interface GeminiJudgeAttemptLog {
  provider: 'google';
  modelId: typeof GEMINI_SUPPLEMENTAL_MODEL_ID;
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
    outputTokens: number | null;
    totalTokens: number | null;
  };
  providerRequestId: string | null;
  modelVersion: string | null;
  finishReason: string | null;
  failureCode: string | null;
  failureDetail: string | null;
  retryable: boolean;
}

export interface GeminiJudgeResult {
  provider: 'google';
  modelId: typeof GEMINI_SUPPLEMENTAL_MODEL_ID;
  output: BlindLabelResponse;
  evidenceVerbatim: EvidenceValidationResult;
  attempts: GeminiJudgeAttemptLog[];
  providerResponse: GeminiGenerateContentResponse;
}

export interface GeminiJudgeOptions {
  apiKey: string;
  config: unknown;
  systemPrompt: string;
  request: BlindLabelRequest;
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  onAttempt?: (log: GeminiJudgeAttemptLog) => void;
}

export function parseGeminiJudgeConfig(input: unknown): GeminiJudgeConfig {
  const config = GeminiJudgeConfigSchema.parse(input);
  const schemaHash = groqJudgeResponseSchemaSha256();
  if (config.responseSchemaSha256 !== schemaHash) {
    throw new Error(`Gemini Judge response schema hash mismatch: expected ${schemaHash}.`);
  }
  return config;
}

export function buildGeminiJudgeEnvelope(
  configInput: unknown,
  systemPrompt: string,
  request: BlindLabelRequest,
  seed?: number
): Record<string, unknown> {
  const config = parseGeminiJudgeConfig(configInput);
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
      responseJsonSchema: GROQ_JUDGE_RESPONSE_JSON_SCHEMA,
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

function usageFrom(payload: GeminiGenerateContentResponse): GeminiJudgeAttemptLog['usage'] {
  const visible = payload.usageMetadata?.candidatesTokenCount ?? null;
  const thoughts = payload.usageMetadata?.thoughtsTokenCount ?? 0;
  return {
    inputTokens: payload.usageMetadata?.promptTokenCount ?? null,
    visibleOutputTokens: visible,
    thoughtTokens: payload.usageMetadata?.thoughtsTokenCount ?? null,
    outputTokens: visible === null ? null : visible + thoughts,
    totalTokens: payload.usageMetadata?.totalTokenCount ?? null,
  };
}

export async function callGeminiJudge(options: GeminiJudgeOptions): Promise<GeminiJudgeResult> {
  if (!options.apiKey.trim()) throw new Error('GEMINI_API_KEY is missing.');
  const config = parseGeminiJudgeConfig(options.config);
  const attempts: GeminiJudgeAttemptLog[] = [];
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((milliseconds: number) =>
    new Promise<void>(resolve => setTimeout(resolve, milliseconds)));
  let requestAttempt = 0;
  let generationAttempts = 0;
  let transientFailures = 0;

  while (generationAttempts < config.maxAttempts) {
    requestAttempt += 1;
    const attemptSeed = config.seed + generationAttempts;
    const envelope = buildGeminiJudgeEnvelope(config, options.systemPrompt, options.request, attemptSeed);
    const requestSha256 = sha256CanonicalJson(envelope);
    const started = Date.now();
    let response: Response | null = null;
    let raw = '';
    let payload: GeminiGenerateContentResponse = {};
    let failureCode: string | null = null;
    let failureDetail: string | null = null;
    let retryable = false;
    let generationAttempted = false;
    try {
      response = await fetchImpl(
        `${GEMINI_API_BASE_URL}/models/${config.modelId}:generateContent`,
        {
          method: 'POST',
          headers: { 'x-goog-api-key': options.apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify(envelope),
          signal: AbortSignal.timeout(config.timeoutMs),
        }
      );
      raw = await response.text();
      if (!response.ok) {
        failureCode = `http_${response.status}`;
        failureDetail = raw.slice(0, 4000);
        retryable = retryableStatus(response.status);
      } else {
        generationAttempted = true;
        payload = JSON.parse(raw) as GeminiGenerateContentResponse;
        if (payload.modelVersion && !payload.modelVersion.includes(config.modelId)) {
          throw new Error(`Gemini model identity mismatch: ${payload.modelVersion}.`);
        }
        const content = payload.candidates?.[0]?.content?.parts
          ?.filter(part => !part.thought)
          .map(part => part.text ?? '')
          .join('')
          .trim();
        if (!content) throw new Error('Gemini returned no Judge message content.');
        const output = validateBlindLabelResponse(options.request, JSON.parse(content));
        const evidenceVerbatim = validateEvidence(
          (options.request as { candidate: { lyrics: string } }).candidate.lyrics,
          output.evidence_quotes,
          output.relevance_score
        );
        if (output.relevance_score >= 2 && evidenceVerbatim.status !== 'valid') {
          throw new Error(
            `Required evidence failed verbatim validation: ${evidenceVerbatim.reasons.join(',')}.`
          );
        }
        const log: GeminiJudgeAttemptLog = {
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
        return {
          provider: 'google', modelId: config.modelId, output, evidenceVerbatim,
          attempts, providerResponse: payload,
        };
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
            : /evidence failed/iu.test(failureDetail)
              ? 'evidence_validation_failure'
              : /model identity mismatch/iu.test(failureDetail)
                ? 'model_identity_mismatch'
                : 'protocol_or_runtime_failure';
      retryable = !/model identity mismatch/iu.test(failureDetail);
    }

    if (generationAttempted) generationAttempts += 1;
    else transientFailures += 1;
    const log: GeminiJudgeAttemptLog = {
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
        `Gemini Judge stopped without fallback after request ${requestAttempt} and ` +
        `generation ${generationAttempts}/${config.maxAttempts}: ${failureCode} (${failureDetail}).`
      );
    }
    await sleep(retryDelayMs(requestAttempt, response?.headers.get('retry-after') ?? null));
  }
  throw new Error('Gemini Judge exhausted attempts without a result.');
}
