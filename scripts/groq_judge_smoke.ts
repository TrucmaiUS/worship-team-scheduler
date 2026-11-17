import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildGroqJudgeEnvelope,
  callGroqJudge,
  groqJudgeResponseSchemaSha256,
  JUDGE_CANDIDATE_MODEL_IDS,
} from '../lib/research/e5-distillation/groq-judge';

const root = path.resolve(__dirname, '..');
const live = process.argv.includes('--live');
const apiKey = process.env.GROQ_API_KEY?.trim();
if (!apiKey) throw new Error('GROQ_API_KEY is not configured.');
const requiredApiKey: string = apiKey;

const systemPromptPath = path.join(root,
  'docs/research/e5_distillation/prompts/groq-independent-judge-v4.1.txt');
const systemPrompt = fs.readFileSync(systemPromptPath, 'utf8').replace(/\r\n/g, '\n').trimEnd();
const promptSha256 = crypto.createHash('sha256').update(systemPrompt).digest('hex');
const request = {
  query_text: 'Tìm bài hát về việc tin cậy Chúa khi tương lai mờ mịt',
  candidate: {
    candidate_alias: 'CANDIDATE_SMOKE',
    section_type: 'bridge',
    lyrics: 'Dù đường xa con chưa nhìn thấy\nCon trao ngày mai trong tay Chúa\nVững lòng đi tiếp chẳng sợ chi',
  },
};

const configFor = (modelId: typeof JUDGE_CANDIDATE_MODEL_IDS[number]) => ({
  role: 'independent_judge' as const,
  task: 'label' as const,
  provider: 'groq' as const,
  modelId,
  promptVersion: 'groq-independent-judge-v4.1',
  promptSha256,
  allowFallback: false as const,
  maxAttempts: 2,
  maxOutputTokens: 512,
  timeoutMs: 30_000,
  responseSchemaSha256: groqJudgeResponseSchemaSha256(),
  temperature: 0.2,
  topP: 0.95,
  seed: 20261113,
  reasoningEffort: 'low' as const,
});

async function main(): Promise<void> {
const modelResponse = await fetch('https://api.groq.com/openai/v1/models', {
  headers: { Authorization: `Bearer ${requiredApiKey}`, Accept: 'application/json' },
});
if (!modelResponse.ok) throw new Error(`Groq model inventory failed: HTTP ${modelResponse.status}.`);
const inventory = await modelResponse.json() as {
  data?: Array<{ id?: string; active?: boolean; context_window?: number; owned_by?: string }>;
};
const models = JUDGE_CANDIDATE_MODEL_IDS.map(modelId => {
  const observed = inventory.data?.find(model => model.id === modelId);
  if (!observed?.active) throw new Error(`Required Groq model is not active: ${modelId}.`);
  return { id: observed.id, active: observed.active,
    contextWindow: observed.context_window ?? null, owner: observed.owned_by ?? null };
});

const envelopes = JUDGE_CANDIDATE_MODEL_IDS.map(modelId =>
  buildGroqJudgeEnvelope(configFor(modelId), systemPrompt, request));
const withoutModel = envelopes.map(envelope => ({ ...envelope, model: undefined }));
if (JSON.stringify(withoutModel[0]) !== JSON.stringify(withoutModel[1])) {
  throw new Error('Candidate envelopes differ beyond the exact model ID.');
}

const results = [];
if (live) {
  for (const modelId of JUDGE_CANDIDATE_MODEL_IDS) {
    const result = await callGroqJudge({
      apiKey: requiredApiKey,
      config: configFor(modelId),
      systemPrompt,
      request,
    });
    results.push({
      provider: result.provider,
      modelId: result.modelId,
      output: result.output,
      evidenceVerbatimStatus: result.evidenceVerbatim.status,
      attempts: result.attempts,
    });
  }
}

const report = {
  schemaVersion: 'groq-judge-smoke-v1',
  createdAtUtc: new Date().toISOString(),
  mode: live ? 'live_two_model_synthetic_demo' : 'dry_run',
  modelInventoryHttpStatus: modelResponse.status,
  models,
  promptVersion: 'groq-independent-judge-v4.1',
  promptSha256,
  responseSchemaSha256: groqJudgeResponseSchemaSha256(),
  identicalEnvelopeExceptModelId: true,
  protectedDataUsed: false,
  fallbackUsed: false,
  results,
};
const outputDirectory = path.join(root, 'benchmark/distillation/logs');
fs.mkdirSync(outputDirectory, { recursive: true });
const timestamp = report.createdAtUtc.replace(/[:.]/g, '-');
const outputPath = path.join(outputDirectory, `groq-judge-smoke-${timestamp}.json`);
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
console.log(JSON.stringify({ status: 'PASS', mode: report.mode, models,
  outputPath, results: results.map(result => ({ modelId: result.modelId,
    relevanceScore: result.output.relevance_score,
    evidenceVerbatimStatus: result.evidenceVerbatimStatus,
    usage: result.attempts.at(-1)?.usage ?? null,
    rateLimit: result.attempts.at(-1)?.rateLimit ?? null })) }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
