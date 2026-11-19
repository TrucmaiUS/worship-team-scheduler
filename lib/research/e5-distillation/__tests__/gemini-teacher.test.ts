import { describe, expect, it } from 'vitest';
import {
  buildGeminiTeacherEnvelope,
  GEMINI_TEACHER_MODEL_ID,
  geminiTeacherResponseSchemaSha256,
  parseGeminiTeacherConfig,
} from '../gemini-teacher';

const config = {
  role: 'gemini_teacher' as const,
  task: 'generation' as const,
  provider: 'google' as const,
  modelId: GEMINI_TEACHER_MODEL_ID,
  promptVersion: 'teacher-pilot-v1',
  promptSha256: 'a'.repeat(64),
  responseSchemaSha256: geminiTeacherResponseSchemaSha256(),
  responseFormat: 'json_schema' as const,
  allowFallback: false as const,
  maxAttempts: 3,
  maxTransientRetries: 6,
  maxOutputTokens: 700,
  timeoutMs: 30_000,
  temperature: 0.7,
  topP: 0.9,
  seed: 20261119,
  thinkingLevel: 'low' as const,
};

const request = {
  allowed_topic: { topic_id: 'T04', title: 'Love in action', description: '' },
  source_sections: [{ section_alias: 'SOURCE_001', lyrics: 'Tình yêu Ngài nâng đỡ con' }],
  target_language: 'vi' as const,
  query_style: 'lyric_paraphrase' as const,
  requested_count: 1,
};

describe('Gemini Teacher adapter', () => {
  it('pins the exact Teacher model and response schema', () => {
    expect(parseGeminiTeacherConfig(config).modelId).toBe('gemini-3.1-flash-lite');
    expect(() => parseGeminiTeacherConfig({
      ...config,
      modelId: 'gemini-flash-latest',
    })).toThrow();
    expect(() => parseGeminiTeacherConfig({
      ...config,
      responseSchemaSha256: 'b'.repeat(64),
    })).toThrow(/schema hash mismatch/i);
  });

  it('builds a structured, seeded generation request without fallback fields', () => {
    const envelope = buildGeminiTeacherEnvelope(config, 'system prompt', request) as any;
    expect(envelope.generationConfig.seed).toBe(20261119);
    expect(envelope.generationConfig.responseMimeType).toBe('application/json');
    expect(envelope.generationConfig.responseJsonSchema.required).toEqual(['queries']);
    expect(JSON.stringify(envelope.contents)).not.toContain('fallback');
  });
});
