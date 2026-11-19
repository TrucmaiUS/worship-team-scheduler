import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  callGeminiJudge,
  GEMINI_API_BASE_URL,
  GEMINI_SUPPLEMENTAL_MODEL_ID,
  type GeminiJudgeAttemptLog,
} from '../lib/research/e5-distillation/gemini-judge';
import { groqJudgeResponseSchemaSha256 } from '../lib/research/e5-distillation/groq-judge';
import {
  validateJudgeSelectionSet,
  type JudgeSelectionOutput,
} from '../lib/research/e5-distillation/judge-selection';

const ROOT = path.resolve(__dirname, '..');
const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
if (!apiKey) throw new Error('GEMINI_API_KEY or GOOGLE_API_KEY is not configured.');
const requiredApiKey: string = apiKey;
const referencePath = path.join(ROOT,
  'benchmark/distillation/human_reference/judge_selection_reference_v2.json');
const promptPath = path.join(ROOT,
  'docs/research/e5_distillation/prompts/groq-independent-judge-v4.3.txt');
const references = validateJudgeSelectionSet(JSON.parse(fs.readFileSync(referencePath, 'utf8')));
const systemPrompt = fs.readFileSync(promptPath, 'utf8').replace(/\r\n/gu, '\n').trimEnd();
const promptSha256 = crypto.createHash('sha256').update(systemPrompt).digest('hex');
const referenceSha256 = crypto.createHash('sha256').update(fs.readFileSync(referencePath)).digest('hex');
const createdAtUtc = new Date().toISOString();
const preflight = process.argv.includes('--preflight');
const resumeIndex = process.argv.indexOf('--resume');
const resumeRunId = resumeIndex >= 0 ? process.argv[resumeIndex + 1] : null;
if (resumeIndex >= 0 && !resumeRunId) throw new Error('Missing --resume <run-id>.');
const runId = resumeRunId ??
  `gemini-judge-supplemental-v1${preflight ? '-preflight' : ''}-${createdAtUtc.replace(/[:.]/gu, '-')}`;
const outputDirectory = path.join(ROOT, 'benchmark/distillation/judge_selection_runs', runId);
if (resumeRunId) {
  if (!fs.existsSync(outputDirectory)) throw new Error(`Resume run does not exist: ${outputDirectory}`);
} else {
  if (fs.existsSync(outputDirectory)) throw new Error(`Run directory already exists: ${outputDirectory}`);
  fs.mkdirSync(outputDirectory, { recursive: true });
}

const config = {
  role: 'supplemental_independent_judge' as const,
  task: 'label' as const,
  provider: 'google' as const,
  modelId: GEMINI_SUPPLEMENTAL_MODEL_ID,
  promptVersion: 'groq-independent-judge-v4.3',
  promptSha256,
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

function writeJson(fileName: string, value: unknown): void {
  fs.writeFileSync(path.join(outputDirectory, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function csvEscape(value: string): string {
  return /[",\r\n]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

async function pause(milliseconds: number): Promise<void> {
  await new Promise<void>(resolve => setTimeout(resolve, milliseconds));
}

async function fetchModelMetadata(): Promise<Record<string, unknown>> {
  const response = await fetch(`${GEMINI_API_BASE_URL}/models/${GEMINI_SUPPLEMENTAL_MODEL_ID}`, {
    headers: { 'x-goog-api-key': requiredApiKey, Accept: 'application/json' },
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`Gemini model inventory failed: HTTP ${response.status} ${raw.slice(0, 500)}`);
  const model = JSON.parse(raw) as Record<string, unknown>;
  if (model.name !== `models/${GEMINI_SUPPLEMENTAL_MODEL_ID}`) {
    throw new Error(`Gemini inventory identity mismatch: ${String(model.name)}.`);
  }
  const methods = Array.isArray(model.supportedGenerationMethods)
    ? model.supportedGenerationMethods : [];
  if (!methods.includes('generateContent')) throw new Error('Gemini model does not support generateContent.');
  return model;
}

async function main(): Promise<void> {
  const modelMetadata = await fetchModelMetadata();
  const codeCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: ROOT, encoding: 'utf8',
  }).trim();
  const manifest = {
    schemaVersion: 'gemini-judge-supplemental-execution-v1',
    status: 'running',
    runId,
    mode: preflight ? 'three_pair_schema_preflight' : 'full_50_pair_supplemental_comparison',
    createdAtUtc,
    provider: 'google',
    supplementalOnly: true,
    selectedJudgeConfigurationChanged: false,
    protectedHeldOutDataUsed: false,
    model: modelMetadata,
    referencePath: path.relative(ROOT, referencePath).replaceAll('\\', '/'),
    referenceSha256,
    promptPath: path.relative(ROOT, promptPath).replaceAll('\\', '/'),
    promptSha256,
    responseSchemaSha256: groqJudgeResponseSchemaSha256(),
    config,
    codeCommit,
    providerEndpoint: 'v1beta models.generateContent',
    responseFormatRationale: 'Gemini responseMimeType=application/json with the same six-field JSON Schema and identical local validation used for the Groq candidates.',
    comparabilityNote: 'Temperature, topP, base seed and max output token cap match Judge v5; provider-specific sampling and low-reasoning semantics cannot be made identical across APIs.',
    fallbackAllowed: false,
  };
  if (resumeRunId) {
    const prior = JSON.parse(fs.readFileSync(path.join(outputDirectory, 'run_manifest.json'), 'utf8')) as {
      referenceSha256?: string; promptSha256?: string; responseSchemaSha256?: string;
    };
    if (prior.referenceSha256 !== referenceSha256 || prior.promptSha256 !== promptSha256 ||
        prior.responseSchemaSha256 !== groqJudgeResponseSchemaSha256()) {
      throw new Error('Resume run reference/prompt/schema hash mismatch.');
    }
    writeJson('run_manifest.json', {
      ...prior, status: 'resuming', resumedAtUtc: createdAtUtc, resumeCodeCommit: codeCommit,
    });
  } else {
    writeJson('run_manifest.json', manifest);
  }

  const preflightPairIds = new Set(['P001', 'P032', 'P047']);
  const executionPairs = preflight
    ? references.filter(pair => preflightPairIds.has(pair.pairId))
    : references;
  const partialPath = path.join(outputDirectory, 'gemini-3.1-flash-lite.partial.json');
  const partial = resumeRunId && fs.existsSync(partialPath)
    ? JSON.parse(fs.readFileSync(partialPath, 'utf8')) as {
        rawRecords: unknown[]; evaluationOutputs: JudgeSelectionOutput[];
      }
    : { rawRecords: [], evaluationOutputs: [] };
  const rawRecords = partial.rawRecords;
  const evaluationOutputs = partial.evaluationOutputs;

  for (let index = evaluationOutputs.length; index < executionPairs.length; index += 1) {
    const pair = executionPairs[index];
    const attempts: GeminiJudgeAttemptLog[] = [];
    try {
      const result = await callGeminiJudge({
        apiKey: requiredApiKey,
        config,
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
      rawRecords.push({
        pairId: pair.pairId,
        output: result.output,
        evidenceVerbatim: result.evidenceVerbatim,
        attempts,
        providerResponse: result.providerResponse,
      });
      evaluationOutputs.push({
        pairId: pair.pairId,
        provider: 'google',
        modelId: GEMINI_SUPPLEMENTAL_MODEL_ID,
        schemaPass: true,
        relevanceScore: result.output.relevance_score,
        evidenceQuotes: result.output.evidence_quotes,
        evidenceContextSupported: null,
        inputTokens,
        outputTokens,
        latencyMs,
        failureCode: null,
      });
    } catch (error) {
      const lastAttempt = attempts.at(-1);
      const recordable = Boolean(lastAttempt && [
        'invalid_json', 'schema_validation_failure', 'evidence_validation_failure',
        'protocol_or_runtime_failure',
      ].includes(lastAttempt.failureCode ?? ''));
      if (!recordable) {
        writeJson('failure.json', {
          pairId: pair.pairId, pairIndex: index, attempts,
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
      rawRecords.push({
        pairId: pair.pairId, output: null, attempts,
        failureCode: lastAttempt?.failureCode ?? 'schema_failure',
      });
      evaluationOutputs.push({
        pairId: pair.pairId,
        provider: 'google',
        modelId: GEMINI_SUPPLEMENTAL_MODEL_ID,
        schemaPass: false,
        relevanceScore: null,
        evidenceQuotes: [],
        evidenceContextSupported: null,
        inputTokens: attempts.reduce((sum, attempt) => sum + (attempt.usage.inputTokens ?? 0), 0) || null,
        outputTokens: attempts.reduce((sum, attempt) => sum + (attempt.usage.outputTokens ?? 0), 0) || null,
        latencyMs: attempts.reduce((sum, attempt) => sum + attempt.latencyMs, 0),
        failureCode: lastAttempt?.failureCode ?? 'schema_failure',
      });
    }
    writeJson(path.basename(partialPath), {
      modelId: GEMINI_SUPPLEMENTAL_MODEL_ID,
      completedPairs: index + 1,
      rawRecords,
      evaluationOutputs,
    });
    console.log(`${GEMINI_SUPPLEMENTAL_MODEL_ID}: ${index + 1}/${executionPairs.length} ${pair.pairId}`);
    if (index + 1 < executionPairs.length) await pause(1_000);
  }

  writeJson('gemini-3.1-flash-lite_raw.json', rawRecords);
  writeJson('gemini-3.1-flash-lite_evaluation.json', evaluationOutputs);
  fs.rmSync(partialPath, { force: true });
  fs.rmSync(path.join(outputDirectory, 'failure.json'), { force: true });

  const auditRows: string[][] = [[
    'model_id', 'pair_id', 'query_text', 'candidate_lyrics', 'relevance_score',
    'evidence_quotes', 'evidence_context_supported', 'auditor_notes',
  ]];
  for (const output of evaluationOutputs.filter(item => (item.relevanceScore ?? -1) >= 2)) {
    const pair = references.find(item => item.pairId === output.pairId)!;
    auditRows.push([
      GEMINI_SUPPLEMENTAL_MODEL_ID, pair.pairId, pair.queryText, pair.candidate.lyrics,
      String(output.relevanceScore), JSON.stringify(output.evidenceQuotes), '', '',
    ]);
  }
  fs.writeFileSync(path.join(outputDirectory, 'evidence_context_audit.csv'),
    `${auditRows.map(row => row.map(csvEscape).join(',')).join('\n')}\n`, 'utf8');
  const currentManifest = JSON.parse(fs.readFileSync(path.join(outputDirectory, 'run_manifest.json'), 'utf8'));
  writeJson('run_manifest.json', {
    ...currentManifest,
    status: 'raw_outputs_complete',
    completedAtUtc: new Date().toISOString(),
    completedPairs: evaluationOutputs.length,
    evidenceContextAuditRequired: true,
  });
  console.log(JSON.stringify({
    status: 'RAW_OUTPUTS_COMPLETE', runId, outputDirectory,
    evidenceContextAuditRows: auditRows.length - 1,
  }, null, 2));
}

main().catch((error: unknown) => {
  if (fs.existsSync(outputDirectory)) {
    writeJson('failure.json', {
      status: 'FAILED', failedAtUtc: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
    });
  }
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
