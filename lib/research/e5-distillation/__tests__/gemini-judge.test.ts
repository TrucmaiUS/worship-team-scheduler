import { describe, expect, it } from 'vitest';
import {
  buildGeminiJudgeEnvelope,
  callGeminiJudge,
  GEMINI_SUPPLEMENTAL_MODEL_ID,
} from '../gemini-judge';
import { groqJudgeResponseSchemaSha256 } from '../groq-judge';

const config = {
  role: 'supplemental_independent_judge' as const,
  task: 'label' as const,
  provider: 'google' as const,
  modelId: GEMINI_SUPPLEMENTAL_MODEL_ID,
  promptVersion: 'groq-independent-judge-v4.3',
  promptSha256: 'a'.repeat(64),
  responseSchemaSha256: groqJudgeResponseSchemaSha256(),
  responseFormat: 'json_schema' as const,
  allowFallback: false as const,
  maxAttempts: 3,
  maxTransientRetries: 6,
  maxOutputTokens: 900,
  timeoutMs: 30_000,
  temperature: 0.2,
  topP: 0.95,
  seed: 20261113,
  thinkingLevel: 'low' as const,
};

const request = {
  query_text: 'Tìm bài hát về sự tin cậy Chúa trong đêm tối',
  candidate: {
    candidate_alias: 'CANDIDATE_01',
    section_type: 'verse',
    lyrics: 'Giữa đêm tối con vẫn tin cậy nơi Ngài',
  },
};

describe('Gemini supplemental Judge adapter', () => {
  it('reuses the frozen prompt inputs, decoding values and six-field JSON Schema', () => {
    const envelope = buildGeminiJudgeEnvelope(config, 'same rubric', request) as any;
    expect(envelope.systemInstruction.parts[0].text).toBe('same rubric');
    expect(envelope.contents[0].parts[0].text).toBe(JSON.stringify(request));
    expect(envelope.generationConfig).toMatchObject({
      temperature: 0.2,
      topP: 0.95,
      seed: 20261113,
      maxOutputTokens: 900,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingLevel: 'low' },
    });
    expect(envelope.generationConfig.responseJsonSchema.required).toEqual([
      'candidate_alias', 'relevance_score', 'relevance_label', 'evidence_quotes',
      'reasoning_summary', 'is_lexical_overlap_only',
    ]);
  });

  it('validates model identity, strict JSON, token accounting and verbatim evidence', async () => {
    const payload = {
      candidates: [{
        content: { parts: [{ text: JSON.stringify({
          candidate_alias: 'CANDIDATE_01',
          relevance_score: 3,
          relevance_label: 'Highly Relevant',
          evidence_quotes: ['con vẫn tin cậy nơi Ngài'],
          reasoning_summary: 'The lyrics directly express trust in God.',
          is_lexical_overlap_only: false,
        }) }] },
        finishReason: 'STOP',
      }],
      usageMetadata: {
        promptTokenCount: 100,
        candidatesTokenCount: 40,
        thoughtsTokenCount: 5,
        totalTokenCount: 145,
      },
      modelVersion: GEMINI_SUPPLEMENTAL_MODEL_ID,
      responseId: 'fixture-response',
    };
    const result = await callGeminiJudge({
      apiKey: 'fixture-key', config, systemPrompt: 'same rubric', request,
      fetchImpl: async () => new Response(JSON.stringify(payload), { status: 200 }),
    });
    expect(result.output.relevance_score).toBe(3);
    expect(result.evidenceVerbatim.status).toBe('valid');
    expect(result.attempts[0].usage).toMatchObject({
      inputTokens: 100, visibleOutputTokens: 40, thoughtTokens: 5,
      outputTokens: 45, totalTokens: 145,
    });
    expect(JSON.stringify(result)).not.toContain('fixture-key');
  });
});
