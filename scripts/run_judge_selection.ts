import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  callGroqJudge,
  groqJudgeResponseSchemaSha256,
  JUDGE_CANDIDATE_MODEL_IDS,
  type GroqJudgeAttemptLog,
} from '../lib/research/e5-distillation/groq-judge';
import {
  validateJudgeSelectionSet,
  type JudgeSelectionOutput,
} from '../lib/research/e5-distillation/judge-selection';

const ROOT = path.resolve(__dirname, '..');
const apiKey = process.env.GROQ_API_KEY?.trim();
if (!apiKey) throw new Error('GROQ_API_KEY is not configured.');
const requiredApiKey: string = apiKey;
const referencePath = path.join(ROOT,
  'benchmark/distillation/human_reference/judge_selection_reference_v2.json');
const promptPath = path.join(ROOT,
  'docs/research/e5_distillation/prompts/groq-independent-judge-v4.1.txt');
const references = validateJudgeSelectionSet(JSON.parse(fs.readFileSync(referencePath, 'utf8')));
const systemPrompt = fs.readFileSync(promptPath, 'utf8').replace(/\r\n/gu, '\n').trimEnd();
const promptSha256 = crypto.createHash('sha256').update(systemPrompt).digest('hex');
const referenceSha256 = crypto.createHash('sha256').update(fs.readFileSync(referencePath)).digest('hex');
const createdAtUtc = new Date().toISOString();
const runId = `judge-selection-v2-${createdAtUtc.replace(/[:.]/gu, '-')}`;
const outputDirectory = path.join(ROOT, 'benchmark/distillation/judge_selection_runs', runId);
if (fs.existsSync(outputDirectory)) throw new Error(`Run directory already exists: ${outputDirectory}`);
fs.mkdirSync(outputDirectory, { recursive: true });

const configFor = (modelId: typeof JUDGE_CANDIDATE_MODEL_IDS[number]) => ({
  role: 'independent_judge' as const,
  task: 'label' as const,
  provider: 'groq' as const,
  modelId,
  promptVersion: 'groq-independent-judge-v4.1',
  promptSha256,
  allowFallback: false as const,
  maxAttempts: 3,
  maxOutputTokens: 512,
  timeoutMs: 30_000,
  responseSchemaSha256: groqJudgeResponseSchemaSha256(),
  temperature: 0.2,
  topP: 0.95,
  seed: 20261113,
  reasoningEffort: 'low' as const,
});

function writeJson(fileName: string, value: unknown): void {
  fs.writeFileSync(path.join(outputDirectory, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function csvEscape(value: string): string {
  return /[",\r\n]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

async function pause(milliseconds: number): Promise<void> {
  await new Promise<void>(resolve => setTimeout(resolve, milliseconds));
}

async function main(): Promise<void> {
  const inventoryResponse = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${requiredApiKey}`, Accept: 'application/json' },
  });
  if (!inventoryResponse.ok) throw new Error(`Groq model inventory failed: HTTP ${inventoryResponse.status}.`);
  const inventory = await inventoryResponse.json() as {
    data?: Array<{ id?: string; active?: boolean; context_window?: number; owned_by?: string }>;
  };
  const observedModels = JUDGE_CANDIDATE_MODEL_IDS.map(modelId => {
    const observed = inventory.data?.find(model => model.id === modelId);
    if (!observed?.active) throw new Error(`Required Groq model is not active: ${modelId}.`);
    return observed;
  });

  const envelopes = JUDGE_CANDIDATE_MODEL_IDS.map(modelId => configFor(modelId));
  const manifest = {
    schemaVersion: 'judge-selection-execution-v2',
    status: 'running',
    runId,
    createdAtUtc,
    provider: 'groq',
    models: observedModels,
    referencePath: path.relative(ROOT, referencePath).replaceAll('\\', '/'),
    referenceSha256,
    promptPath: path.relative(ROOT, promptPath).replaceAll('\\', '/'),
    promptSha256,
    responseSchemaSha256: groqJudgeResponseSchemaSha256(),
    configs: envelopes,
    codeCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    fallbackAllowed: false,
    protectedHeldOutDataUsed: false,
  };
  writeJson('run_manifest.json', manifest);

  const auditRows: string[][] = [[
    'model_id', 'pair_id', 'query_text', 'candidate_lyrics', 'relevance_score',
    'evidence_quotes', 'evidence_context_supported', 'auditor_notes',
  ]];

  for (const modelId of JUDGE_CANDIDATE_MODEL_IDS) {
    const rawRecords: unknown[] = [];
    const evaluationOutputs: JudgeSelectionOutput[] = [];
    const partialName = `${modelId.replaceAll('/', '__')}.partial.json`;
    for (let index = 0; index < references.length; index += 1) {
      const pair = references[index];
      const attempts: GroqJudgeAttemptLog[] = [];
      const result = await callGroqJudge({
        apiKey: requiredApiKey,
        config: configFor(modelId),
        systemPrompt,
        request: {
          query_text: pair.queryText,
          candidate: {
            candidate_alias: pair.candidate.candidateAlias,
            section_type: pair.candidate.sectionType,
            lyrics: pair.candidate.lyrics,
          },
        },
        onAttempt: log => attempts.push(log),
      });
      const latencyMs = attempts.reduce((sum, attempt) => sum + attempt.latencyMs, 0);
      const inputTokens = attempts.reduce((sum, attempt) => sum + (attempt.usage.inputTokens ?? 0), 0);
      const outputTokens = attempts.reduce((sum, attempt) => sum + (attempt.usage.outputTokens ?? 0), 0);
      rawRecords.push({ pairId: pair.pairId, output: result.output,
        evidenceVerbatim: result.evidenceVerbatim, attempts });
      evaluationOutputs.push({
        pairId: pair.pairId,
        provider: 'groq',
        modelId,
        schemaPass: true,
        relevanceScore: result.output.relevance_score,
        evidenceQuotes: result.output.evidence_quotes,
        evidenceContextSupported: null,
        inputTokens,
        outputTokens,
        latencyMs,
        failureCode: null,
      });
      if (result.output.relevance_score >= 2) {
        auditRows.push([
          modelId, pair.pairId, pair.queryText, pair.candidate.lyrics,
          String(result.output.relevance_score), JSON.stringify(result.output.evidence_quotes), '', '',
        ]);
      }
      writeJson(partialName, { modelId, completedPairs: index + 1, rawRecords, evaluationOutputs });
      if ((index + 1) % 5 === 0) console.log(`${modelId}: ${index + 1}/${references.length}`);
      if (index + 1 < references.length) await pause(6_000);
    }
    writeJson(`${modelId.replaceAll('/', '__')}_raw.json`, rawRecords);
    writeJson(`${modelId.replaceAll('/', '__')}_evaluation.json`, evaluationOutputs);
    fs.rmSync(path.join(outputDirectory, partialName));
  }

  fs.writeFileSync(path.join(outputDirectory, 'evidence_context_audit.csv'),
    `${auditRows.map(row => row.map(csvEscape).join(',')).join('\n')}\n`, 'utf8');
  writeJson('run_manifest.json', { ...manifest, status: 'raw_outputs_complete',
    completedAtUtc: new Date().toISOString(), evidenceContextAuditRequired: true });
  console.log(JSON.stringify({ status: 'RAW_OUTPUTS_COMPLETE', runId, outputDirectory,
    evidenceContextAuditRows: auditRows.length - 1 }, null, 2));
}

main().catch((error: unknown) => {
  writeJson('failure.json', {
    status: 'FAILED',
    failedAtUtc: new Date().toISOString(),
    message: error instanceof Error ? error.message : String(error),
  });
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
