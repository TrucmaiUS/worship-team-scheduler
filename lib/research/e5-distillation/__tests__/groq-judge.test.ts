import { describe, expect, it } from 'vitest';
import {
  buildGroqJudgeEnvelope,
  callGroqJudge,
  groqJudgeResponseSchemaSha256,
} from '../groq-judge';
import {
  evaluateJudgeCandidate,
  passesJudgeSelectionGates,
  validateJudgeSelectionSet,
} from '../judge-selection';

const baseConfig = {
  role: 'independent_judge' as const,
  task: 'label' as const,
  provider: 'groq' as const,
  modelId: 'openai/gpt-oss-120b' as const,
  promptVersion: 'groq-independent-judge-v4.1',
  promptSha256: 'a'.repeat(64),
  allowFallback: false as const,
  maxAttempts: 3,
  maxOutputTokens: 512,
  timeoutMs: 30_000,
  responseSchemaSha256: groqJudgeResponseSchemaSha256(),
  temperature: 0.2,
  topP: 0.95,
  seed: 20261113,
  reasoningEffort: 'low' as const,
};

const blindRequest = {
  query_text: 'Tìm bài hát về sự tin cậy Chúa trong đêm tối',
  candidate: {
    candidate_alias: 'CANDIDATE_01',
    section_type: 'verse',
    lyrics: 'Giữa đêm tối con vẫn tin cậy nơi Ngài',
  },
};

describe('Groq independent Judge adapter', () => {
  it('keeps the candidate envelopes identical except for exact model ID', () => {
    const first = buildGroqJudgeEnvelope(baseConfig, 'same rubric', blindRequest);
    const second = buildGroqJudgeEnvelope({ ...baseConfig, modelId: 'qwen/qwen3.8-27b' },
      'same rubric', blindRequest);
    expect({ ...first, model: undefined }).toEqual({ ...second, model: undefined });
    expect(first.model).toBe('openai/gpt-oss-120b');
    expect(second.model).toBe('qwen/qwen3.8-27b');
  });

  it('validates strict JSON, observed model identity and verbatim evidence', async () => {
    const payload = {
      id: 'fixture-request',
      model: 'openai/gpt-oss-120b',
      system_fingerprint: 'fixture',
      choices: [{ message: { content: JSON.stringify({
        candidate_alias: 'CANDIDATE_01', relevance_score: 3,
        relevance_label: 'Highly Relevant',
        evidence_quotes: ['con vẫn tin cậy nơi Ngài'],
        reasoning_summary: 'The lyrics directly express trust in God.',
        is_lexical_overlap_only: false,
      }) } }],
      usage: { prompt_tokens: 100, completion_tokens: 40, total_tokens: 140 },
    };
    const result = await callGroqJudge({
      apiKey: 'fixture-key', config: baseConfig, systemPrompt: 'same rubric', request: blindRequest,
      fetchImpl: async () => new Response(JSON.stringify(payload), { status: 200 }),
    });
    expect(result.output.relevance_score).toBe(3);
    expect(result.evidenceVerbatim.status).toBe('valid');
    expect(result.attempts[0].usage.totalTokens).toBe(140);
    expect(JSON.stringify(result.attempts)).not.toContain('fixture-key');
  });

  it('retries only transient failures and never changes model', async () => {
    let calls = 0;
    const models: string[] = [];
    const result = await callGroqJudge({
      apiKey: 'fixture-key', config: { ...baseConfig, maxAttempts: 2 },
      systemPrompt: 'same rubric', request: blindRequest, sleep: async () => undefined,
      fetchImpl: async (_url, init) => {
        calls += 1;
        models.push(JSON.parse(String(init?.body)).model);
        if (calls === 1) return new Response('{"error":"busy"}', { status: 429 });
        return new Response(JSON.stringify({
          id: 'fixture-request', model: 'openai/gpt-oss-120b',
          choices: [{ message: { content: JSON.stringify({
            candidate_alias: 'CANDIDATE_01', relevance_score: 0,
            relevance_label: 'Not Relevant', evidence_quotes: [],
            reasoning_summary: 'The candidate does not express the requested intent.',
            is_lexical_overlap_only: false,
          }) } }],
        }), { status: 200 });
      },
    });
    expect(result.attempts).toHaveLength(2);
    expect(models).toEqual(['openai/gpt-oss-120b', 'openai/gpt-oss-120b']);
  });
});

function referencePairs() {
  const scores = [
    ...Array<0>(17).fill(0),
    ...Array<1>(9).fill(1),
    ...Array<2>(8).fill(2),
    ...Array<3>(16).fill(3),
  ] as Array<0 | 1 | 2 | 3>;
  return scores.map((score, index) => {
    return {
      pairId: `DEV-PAIR-${String(index + 1).padStart(2, '0')}`,
      sourceQueryId: `G2-Q${String(index + 1).padStart(3, '0')}`,
      originalSourceQueryId: `G2-Q${String(index + 1).padStart(3, '0')}`,
      sourceTopicId: `T${String((index % 10) + 1).padStart(2, '0')}`,
      split: 'development_only',
      languageStratum: (['en_query_vi_lyrics', 'vi_query_vi_lyrics'] as const)[index % 2],
      difficultTheologicalDistinction: `Human-reviewed distinction ${index % 15}.`,
      distinctionTag: `distinction_${index % 15}`,
      queryText: `Fixture query ${index}`,
      candidate: {
        sourceSectionId: `SECTION-${index}`,
        candidateAlias: `CANDIDATE_${String(index + 1).padStart(2, '0')}`,
        sectionType: 'verse', lyrics: `Fixture lyrics ${index}`,
        textProvenance: 'exact_corpus_section' as const,
      },
      humanReference: {
        initialReviews: [
          { reviewerId: 'reviewer-a', relevanceScore: score,
            evidenceQuotes: score >= 2 ? [`Fixture lyrics ${index}`] : [],
            rationale: 'Independent fixture rationale A.' },
          { reviewerId: 'reviewer-b', relevanceScore: score,
            evidenceQuotes: score >= 2 ? [`Fixture lyrics ${index}`] : [],
            rationale: 'Independent fixture rationale B.' },
        ],
        adjudication: null,
        evidenceContextNotes: null,
      },
    };
  });
}

describe('Judge selection metrics and contamination controls', () => {
  it('computes the preregistered metrics against independent human references', () => {
    const pairs = referencePairs();
    const outputs = pairs.map((pair, index) => ({
      pairId: pair.pairId, provider: 'groq' as const,
      modelId: 'openai/gpt-oss-120b' as const, schemaPass: true,
      relevanceScore: pair.humanReference.initialReviews[0].relevanceScore,
      evidenceQuotes: pair.humanReference.initialReviews[0].evidenceQuotes,
      evidenceContextSupported: pair.humanReference.initialReviews[0].relevanceScore >= 2 ? true : null,
      inputTokens: 100, outputTokens: 30, latencyMs: 10 + index, failureCode: null,
    }));
    const metrics = evaluateJudgeCandidate(pairs, outputs);
    expect(metrics.exactAgreement).toBe(1);
    expect(metrics.meanAbsoluteError).toBe(0);
    expect(metrics.quadraticWeightedKappa).toBe(1);
    expect(metrics.macroF1).toBe(1);
    expect(metrics.schemaPassRate).toBe(1);
    expect(metrics.evidenceVerbatimMatchRate).toBe(1);
    expect(metrics.evidenceContextSupportRate).toBe(1);
    expect(passesJudgeSelectionGates(metrics)).toBe(true);
  });

  it('rejects T11–T16 and external contamination', () => {
    const pairs = referencePairs();
    expect(() => validateJudgeSelectionSet([
      { ...pairs[0], sourceTopicId: 'T11' }, ...pairs.slice(1),
    ])).toThrow(/T11/);
    expect(() => validateJudgeSelectionSet([
      { ...pairs[0], sourceQueryId: 'EXT-Q001' }, ...pairs.slice(1),
    ])).toThrow(/External/);
    const sourceIndex = {
      developmentQueries: new Map(pairs.map(pair => [pair.sourceQueryId, {
        topicId: pair.sourceTopicId, queryText: pair.queryText,
      }])),
      corpusSections: new Map(pairs.map(pair => [pair.candidate.sourceSectionId, {
        sectionType: pair.candidate.sectionType, lyrics: pair.candidate.lyrics,
      }])),
    };
    expect(validateJudgeSelectionSet(pairs, sourceIndex)).toHaveLength(50);
    expect(() => validateJudgeSelectionSet([
      { ...pairs[0], sourceQueryId: 'G2-UNKNOWN' }, ...pairs.slice(1),
    ], sourceIndex)).toThrow(/Unknown or non-development/);
  });
});
