import { z } from 'zod';

const ExactModelIdSchema = z.string().min(3).superRefine((value, context) => {
  const normalized = value.toLowerCase();
  if (
    normalized.includes('pending') ||
    normalized.includes('model-id') ||
    normalized.includes('placeholder') ||
    value.includes('<') ||
    value.includes('>')
  ) {
    context.addIssue({
      code: 'custom',
      message: 'A concrete provider model ID is required.',
    });
  }
});

export const PinnedProviderConfigSchema = z
  .object({
    role: z.enum(['gemini_teacher', 'independent_judge', 'gpt_independent_judge']),
    task: z.enum(['generation', 'label']),
    provider: z.enum(['google', 'groq', 'openai']),
    modelId: ExactModelIdSchema,
    promptVersion: z.string().min(1),
    promptSha256: z.string().regex(/^[a-f0-9]{64}$/iu),
    allowFallback: z.literal(false),
    maxAttempts: z.number().int().min(1).max(5),
    maxOutputTokens: z.number().int().min(1).max(65536),
    timeoutMs: z.number().int().min(1000).max(300000),
    responseSchemaSha256: z.string().regex(/^[a-f0-9]{64}$/iu),
    responseFormat: z.enum(['json_schema', 'json_object']).optional(),
    temperature: z.number().min(0).max(2).optional(),
    topP: z.number().min(0).max(1).optional(),
    seed: z.number().int().optional(),
    reasoningEffort: z.enum(['none', 'low', 'medium', 'high']).optional(),
  })
  .strict()
  .superRefine((config, context) => {
    const providerAllowed = config.role === 'gemini_teacher'
      ? config.provider === 'google'
      : config.role === 'independent_judge'
        ? config.provider === 'groq'
        : config.provider === 'openai';
    if (!providerAllowed) {
      context.addIssue({
        code: 'custom',
        path: ['provider'],
        message: `${config.role} is not compatible with provider ${config.provider}.`,
      });
    }
    if (config.role !== 'gemini_teacher' && config.task !== 'label') {
      context.addIssue({ code: 'custom', path: ['task'],
        message: 'The independent Judge may label only.' });
    }
  });

export type PinnedProviderConfig = z.infer<typeof PinnedProviderConfigSchema>;

export class ResearchProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResearchProtocolError';
  }
}

export function parsePinnedProviderConfig(input: unknown): PinnedProviderConfig {
  const result = PinnedProviderConfigSchema.safeParse(input);
  if (!result.success) {
    throw new ResearchProtocolError(
      `Invalid fail-closed provider configuration: ${result.error.message}`
    );
  }
  return result.data;
}

export interface ObservedProviderIdentity {
  provider: 'google' | 'groq' | 'openai';
  modelId: string;
}

export function assertPinnedProviderIdentity(
  config: PinnedProviderConfig,
  observed: ObservedProviderIdentity
): void {
  if (observed.provider !== config.provider) {
    throw new ResearchProtocolError(
      `Provider mismatch: expected ${config.provider}, observed ${observed.provider}.`
    );
  }
  if (observed.modelId !== config.modelId) {
    throw new ResearchProtocolError(
      `Model mismatch: expected ${config.modelId}, observed ${observed.modelId}.`
    );
  }
}

export function failClosed(reason: string): never {
  throw new ResearchProtocolError(`Research run stopped without fallback: ${reason}`);
}
