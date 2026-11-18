import crypto from 'node:crypto';
import { BlindLabelResponseSchema, validateBlindLabelResponse } from './request-contracts';
import { validateEvidence, type EvidenceValidationResult } from './evidence';
import {
  assertPinnedProviderIdentity,
  parsePinnedProviderConfig,
  ResearchProtocolError,
  type PinnedProviderConfig,
} from './research-config';

export const GROQ_OPENAI_BASE_URL = 'https://api.groq.com/openai/v1';
export const JUDGE_CANDIDATE_MODEL_IDS = [
  'openai/gpt-oss-120b',
  'qwen/qwen3.8-27b',
] as const;

export const GROQ_JUDGE_RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    candidate_alias: { type: 'string', pattern: '^[A-Z][A-Z0-9_]*$' },
    relevance_score: { type: 'integer', enum: [0, 1, 2, 3] },
    relevance_label: {
      type: 'string',
      enum: ['Not Relevant', 'Partially Relevant', 'Relevant', 'Highly Relevant'],
    },
    evidence_quotes: { type: 'array', items: { type: 'string', minLength: 1 } },
    reasoning_summary: { type: 'string', minLength: 10 },
    is_lexical_overlap_only: { type: 'boolean' },
  },
  required: [
    'candidate_alias',
    'relevance_score',
    'relevance_label',
    'evidence_quotes',
    'reasoning_summary',
    'is_lexical_overlap_only',
  ],
  additionalProperties: false,
} as const;

type BlindLabelRequest = Parameters<typeof validateBlindLabelResponse>[0];
type BlindLabelResponse = ReturnType<typeof BlindLabelResponseSchema.parse>;

type GroqFetch = typeof fetch;

interface GroqUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface GroqChatResponse {
  id?: string;
  model?: string;
  system_fingerprint?: string;
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: GroqUsage;
}

export interface GroqJudgeAttemptLog {
  provider: 'groq';
  modelId: string;
  attempt: number;
  generationAttempt: number | null;
  seed: number | null;
  requestSha256: string;
  responseSha256: string | null;
  promptSha256: string;
  responseSchemaSha256: string;
  httpStatus: number | null;
  latencyMs: number;
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  };
  providerRequestId: string | null;
  systemFingerprint: string | null;
  rateLimit: {
    requestLimit: string | null;
    remainingRequests: string | null;
    tokenLimit: string | null;
    remainingTokens: string | null;
    requestReset: string | null;
    tokenReset: string | null;
  };
  failureCode: string | null;
  failureDetail: string | null;
  retryable: boolean;
}

export interface GroqJudgeResult {
  provider: 'groq';
  modelId: string;
  output: BlindLabelResponse;
  evidenceVerbatim: EvidenceValidationResult;
  attempts: GroqJudgeAttemptLog[];
}

export interface GroqJudgeOptions {
  apiKey: string;
  config: unknown;
  systemPrompt: string;
  request: BlindLabelRequest;
  fetchImpl?: GroqFetch;
  sleep?: (milliseconds: number) => Promise<void>;
  onAttempt?: (log: GroqJudgeAttemptLog) => void;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sha256CanonicalJson(value: unknown): string {
  return crypto.createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export function groqJudgeResponseSchemaSha256(): string {
  return sha256CanonicalJson(GROQ_JUDGE_RESPONSE_JSON_SCHEMA);
}

export function assertGroqJudgeConfig(input: unknown): PinnedProviderConfig {
  const config = parsePinnedProviderConfig(input);
  if (config.role !== 'independent_judge' || config.provider !== 'groq' || config.task !== 'label') {
    throw new ResearchProtocolError('Groq Judge requires role=independent_judge, provider=groq, task=label.');
  }
  if (!JUDGE_CANDIDATE_MODEL_IDS.includes(config.modelId as typeof JUDGE_CANDIDATE_MODEL_IDS[number])) {
    throw new ResearchProtocolError(`Unapproved Judge candidate model: ${config.modelId}.`);
  }
  const schemaHash = groqJudgeResponseSchemaSha256();
  if (config.responseSchemaSha256 !== schemaHash) {
    throw new ResearchProtocolError(
      `Judge response schema hash mismatch: expected ${schemaHash}, configured ${config.responseSchemaSha256}.`
    );
  }
  return config;
}

export function buildGroqJudgeEnvelope(
  configInput: unknown,
  systemPrompt: string,
  request: BlindLabelRequest
): Record<string, unknown> {
  const config = assertGroqJudgeConfig(configInput);
  const envelope: Record<string, unknown> = {
    model: config.modelId,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(request) },
    ],
    response_format: config.responseFormat === 'json_object'
      ? { type: 'json_object' }
      : {
          type: 'json_schema',
          json_schema: {
            name: 'blind_relevance_judgment',
            strict: true,
            schema: GROQ_JUDGE_RESPONSE_JSON_SCHEMA,
          },
        },
    max_completion_tokens: config.maxOutputTokens,
    stream: false,
  };
  if (config.temperature !== undefined) envelope.temperature = config.temperature;
  if (config.topP !== undefined) envelope.top_p = config.topP;
  if (config.seed !== undefined) envelope.seed = config.seed;
  if (config.reasoningEffort !== undefined) envelope.reasoning_effort = config.reasoningEffort;
  if (config.reasoningEffort !== undefined) envelope.reasoning_format = 'hidden';
  return envelope;
}

function retryableStatus(status: number): boolean {
  return [408, 409, 429, 500, 502, 503, 504].includes(status);
}

function retryableJsonGenerationFailure(
  status: number,
  providerErrorCode: string | null,
  failureDetail: string | null
): boolean {
  return status === 400 && (
    providerErrorCode === 'json_validate_failed' ||
    /generate JSON|validate JSON|max completion tokens reached/iu.test(failureDetail ?? '')
  );
}

function durationMs(value: string | null): number {
  if (!value) return Number.NaN;
  const numericSeconds = Number(value);
  if (Number.isFinite(numericSeconds) && numericSeconds >= 0) return numericSeconds * 1000;
  let total = 0;
  let matched = false;
  for (const match of value.matchAll(/([0-9]+(?:\.[0-9]+)?)(ms|s|m|h)/gu)) {
    matched = true;
    const amount = Number(match[1]);
    total += amount * ({ ms: 1, s: 1000, m: 60_000, h: 3_600_000 }[match[2]] ?? 0);
  }
  return matched ? total : Number.NaN;
}

function retryDelayMs(
  attempt: number,
  retryAfter: string | null,
  tokenReset: string | null,
  failureDetail: string | null
): number {
  const retryAfterSeconds = retryAfter === null ? Number.NaN : Number(retryAfter);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return Math.min(60_000, Math.ceil(retryAfterSeconds * 1000) + 250);
  }
  const resetMilliseconds = durationMs(tokenReset);
  if (Number.isFinite(resetMilliseconds) && resetMilliseconds >= 0) {
    return Math.min(60_000, Math.ceil(resetMilliseconds) + 250);
  }
  const providerHint = failureDetail?.match(/try again in ([0-9]+(?:\.[0-9]+)?(?:ms|s|m|h))/iu)?.[1] ?? null;
  const providerHintMilliseconds = durationMs(providerHint);
  if (Number.isFinite(providerHintMilliseconds) && providerHintMilliseconds >= 0) {
    return Math.min(60_000, Math.ceil(providerHintMilliseconds) + 500);
  }
  return Math.min(8_000, 500 * 2 ** (attempt - 1));
}

function rateLimitHeaders(headers: Headers | undefined): GroqJudgeAttemptLog['rateLimit'] {
  return {
    requestLimit: headers?.get('x-ratelimit-limit-requests') ?? null,
    remainingRequests: headers?.get('x-ratelimit-remaining-requests') ?? null,
    tokenLimit: headers?.get('x-ratelimit-limit-tokens') ?? null,
    remainingTokens: headers?.get('x-ratelimit-remaining-tokens') ?? null,
    requestReset: headers?.get('x-ratelimit-reset-requests') ?? null,
    tokenReset: headers?.get('x-ratelimit-reset-tokens') ?? null,
  };
}

function redactProviderIdentifiers(value: string | null): string | null {
  return value?.replace(/\borg_[a-z0-9_]+\b/giu, '[REDACTED_ORGANIZATION]') ?? null;
}

export async function callGroqJudge(options: GroqJudgeOptions): Promise<GroqJudgeResult> {
  if (!options.apiKey.trim()) throw new ResearchProtocolError('GROQ_API_KEY is missing.');
  const config = assertGroqJudgeConfig(options.config);
  const request = options.request;
  const attempts: GroqJudgeAttemptLog[] = [];
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((milliseconds: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));

  let requestAttempt = 0;
  let generationAttempts = 0;
  let transientFailures = 0;
  while (generationAttempts < config.maxAttempts) {
    requestAttempt += 1;
    const attemptSeed = config.seed === undefined ? undefined : config.seed + generationAttempts;
    const envelope = buildGroqJudgeEnvelope(
      { ...config, seed: attemptSeed }, options.systemPrompt, request
    );
    const requestSha256 = sha256CanonicalJson(envelope);
    const started = Date.now();
    let response: Response | null = null;
    let raw = '';
    let failureCode: string | null = null;
    let failureDetail: string | null = null;
    let providerErrorCode: string | null = null;
    let retryable = false;
    let generationAttempted = false;
    try {
      response = await fetchImpl(`${GROQ_OPENAI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(envelope),
        signal: AbortSignal.timeout(config.timeoutMs),
      });
      raw = await response.text();
      if (!response.ok) {
        failureCode = `http_${response.status}`;
        try {
          const payload = JSON.parse(raw) as {
            error?: { message?: string; code?: string; failed_generation?: string };
          };
          providerErrorCode = payload.error?.code ?? null;
          failureDetail = payload.error
            ? JSON.stringify(payload.error).slice(0, 4000)
            : raw.slice(0, 4000);
        } catch {
          failureDetail = raw.slice(0, 4000);
        }
        generationAttempted = retryableJsonGenerationFailure(
          response.status, providerErrorCode, failureDetail
        );
        retryable = retryableStatus(response.status) || generationAttempted;
      } else {
        generationAttempted = true;
        const payload = JSON.parse(raw) as GroqChatResponse;
        assertPinnedProviderIdentity(config, {
          provider: 'groq',
          modelId: payload.model ?? '',
        });
        const content = payload.choices?.[0]?.message?.content;
        if (!content) throw new ResearchProtocolError('Groq returned no Judge message content.');
        const output = validateBlindLabelResponse(request, JSON.parse(content));
        const evidenceVerbatim = validateEvidence(
          (request as { candidate: { lyrics: string } }).candidate.lyrics,
          output.evidence_quotes,
          output.relevance_score
        );
        if (output.relevance_score >= 2 && evidenceVerbatim.status !== 'valid') {
          throw new ResearchProtocolError(
            `Required evidence failed verbatim validation: ${evidenceVerbatim.reasons.join(',')}.`
          );
        }
        const log: GroqJudgeAttemptLog = {
          provider: 'groq', modelId: config.modelId, attempt: requestAttempt,
          generationAttempt: generationAttempts + 1, seed: attemptSeed ?? null, requestSha256,
          responseSha256: sha256CanonicalJson(payload), promptSha256: config.promptSha256,
          responseSchemaSha256: config.responseSchemaSha256,
          httpStatus: response.status, latencyMs: Date.now() - started,
          usage: {
            inputTokens: payload.usage?.prompt_tokens ?? null,
            outputTokens: payload.usage?.completion_tokens ?? null,
            totalTokens: payload.usage?.total_tokens ?? null,
          },
          providerRequestId: payload.id ?? null,
          systemFingerprint: payload.system_fingerprint ?? null,
          rateLimit: rateLimitHeaders(response.headers),
          failureCode: null, failureDetail: null, retryable: false,
        };
        attempts.push(log);
        options.onAttempt?.(log);
        return { provider: 'groq', modelId: config.modelId, output, evidenceVerbatim, attempts };
      }
    } catch (error) {
      failureDetail = error instanceof Error ? error.message : String(error);
      failureCode = error instanceof ResearchProtocolError
        ? 'protocol_validation_failure'
        : error instanceof SyntaxError
          ? 'invalid_json'
          : error instanceof Error && error.name === 'ZodError'
            ? 'schema_validation_failure'
          : error instanceof Error && error.name === 'TimeoutError'
            ? 'timeout'
            : 'network_or_runtime_failure';
      retryable = !(
        error instanceof ResearchProtocolError && /mismatch|Unapproved|schema hash/i.test(error.message)
      );
    }

    if (generationAttempted) generationAttempts += 1;
    else transientFailures += 1;
    failureDetail = redactProviderIdentifiers(failureDetail);
    const log: GroqJudgeAttemptLog = {
      provider: 'groq', modelId: config.modelId, attempt: requestAttempt,
      generationAttempt: generationAttempted ? generationAttempts : null,
      seed: attemptSeed ?? null, requestSha256,
      responseSha256: raw ? crypto.createHash('sha256').update(raw).digest('hex') : null,
      promptSha256: config.promptSha256, responseSchemaSha256: config.responseSchemaSha256,
      httpStatus: response?.status ?? null, latencyMs: Date.now() - started,
      usage: { inputTokens: null, outputTokens: null, totalTokens: null },
      providerRequestId: response?.headers.get('x-request-id') ?? null,
      systemFingerprint: null, rateLimit: rateLimitHeaders(response?.headers),
      failureCode, failureDetail, retryable,
    };
    attempts.push(log);
    options.onAttempt?.(log);
    if (!retryable || generationAttempts >= config.maxAttempts ||
        transientFailures > config.maxTransientRetries) {
      throw new ResearchProtocolError(
        `Groq Judge stopped without fallback after request ${requestAttempt} ` +
        `and generation ${generationAttempts}/${config.maxAttempts}: ` +
        `${failureCode} (${failureDetail}).`
      );
    }
    await sleep(retryDelayMs(
      requestAttempt,
      response?.headers.get('retry-after') ?? null,
      response?.headers.get('x-ratelimit-reset-tokens') ?? null,
      failureDetail
    ));
  }
  throw new ResearchProtocolError('Groq Judge exhausted attempts without a result.');
}
