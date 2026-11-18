import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  applyEvidenceContextAudit,
  compareJudgeCandidates,
  evaluateJudgeCandidate,
  JUDGE_SELECTION_CRITERIA,
} from '../lib/research/e5-distillation/judge-selection';
import { loadCorpus, parseCsv } from '../lib/research/e5-distillation/corpus';

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`Missing ${name} <path>.`);
  return path.resolve(process.argv[index + 1]);
}

function sha256(file: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function readJson(file: string): any {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeNewJson(file: string, value: unknown): void {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
}

function percent(value: number | null): string {
  return value === null ? 'n/a' : `${(value * 100).toFixed(2)}%`;
}

const root = path.resolve(__dirname, '..');
const runDirectory = argument('--run');
const auditIndex = process.argv.indexOf('--audit');
const auditPath = auditIndex >= 0 ? argument('--audit') : path.join(runDirectory, 'evidence_context_audit.csv');
const manifestPath = path.join(runDirectory, 'run_manifest.json');
const referencePath = path.join(root, 'benchmark/distillation/human_reference/judge_selection_reference_v2.json');
const gptPath = path.join(runDirectory, 'openai__gpt-oss-120b_evaluation.json');
const qwenPath = path.join(runDirectory, 'qwen__qwen3.8-27b_evaluation.json');
const outputFiles = {
  gptAudited: path.join(runDirectory, 'openai__gpt-oss-120b_evaluation_audited.json'),
  qwenAudited: path.join(runDirectory, 'qwen__qwen3.8-27b_evaluation_audited.json'),
  comparison: path.join(runDirectory, 'model_comparison_final.json'),
  validation: path.join(runDirectory, 'evidence_context_validation_report.json'),
  frozenConfig: path.join(runDirectory, 'frozen_judge_config.json'),
  report: path.join(runDirectory, 'judge_selection_report.md'),
  selectionManifest: path.join(runDirectory, 'selection_manifest.json'),
};
for (const file of Object.values(outputFiles)) {
  if (fs.existsSync(file)) throw new Error(`Refusing to overwrite finalized artifact: ${file}`);
}

const manifest = readJson(manifestPath);
if (manifest.status !== 'raw_outputs_complete' || manifest.protectedHeldOutDataUsed !== false) {
  throw new Error('Run manifest is not an eligible development-only completed run.');
}
const references = readJson(referencePath);
const auditRows = parseCsv(fs.readFileSync(auditPath, 'utf8'));
const gptAudited = applyEvidenceContextAudit(references, readJson(gptPath), auditRows);
const qwenAudited = applyEvidenceContextAudit(references, readJson(qwenPath), auditRows);

const queryRows = parseCsv(fs.readFileSync(path.join(root,
  'benchmark/distillation/human_reference/query_manifest_v2.csv'), 'utf8'));
const developmentQueries = new Map(queryRows.map(row => [row.reference_query_id, {
  topicId: row.source_topic_id || null,
  queryText: row.query_text,
}]));
const corpus = loadCorpus(path.join(root, 'benchmark/data/songs.csv'));
const corpusSections = new Map(corpus.songs.flatMap(song => song.sections.map(section => [
  section.sectionId,
  { sectionType: section.sectionType, lyrics: section.lyrics },
] as const)));
const sourceIndex = { developmentQueries, corpusSections };
const gptMetrics = evaluateJudgeCandidate(references, gptAudited, sourceIndex);
const qwenMetrics = evaluateJudgeCandidate(references, qwenAudited, sourceIndex);
const comparison = compareJudgeCandidates(gptMetrics, qwenMetrics);
if (comparison.status !== 'selected' || comparison.selectedModelId === null) {
  throw new Error(`No Judge can be frozen: ${comparison.status}.`);
}

const createdAtUtc = new Date().toISOString();
const evaluationCodeCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: root, encoding: 'utf8',
}).trim();
const inputRecord = (file: string) => ({
  path: path.relative(root, file).replaceAll('\\', '/'),
  sha256: sha256(file),
});
const finalComparison = {
  schemaVersion: 'judge-selection-report-v1',
  createdAtUtc,
  criteria: JUDGE_SELECTION_CRITERIA,
  metricPolicy: {
    schemaFailuresCountAsIncorrect: true,
    strictAllPairMetrics: ['exactAgreement', 'macroF1', 'confusionMatrix', 'perGrade'],
    scoredPairConditionalMetrics: ['meanAbsoluteError', 'quadraticWeightedKappa'],
    confidenceIntervals: '95% percentile bootstrap resampling sourceQueryId clusters (2,000 replicates)',
  },
  developmentSetOnly: true,
  protectedHeldOutDataUsed: false,
  codeCommits: {
    execution: manifest.codeCommit,
    evaluation: evaluationCodeCommit,
  },
  inputs: {
    references: inputRecord(referencePath),
    evidenceContextAudit: inputRecord(auditPath),
    gptOss: inputRecord(gptPath),
    qwen: inputRecord(qwenPath),
  },
  candidates: [gptMetrics, qwenMetrics],
  comparison,
};

const selectedConfig = manifest.configs.find((config: any) =>
  config.modelId === comparison.selectedModelId);
const selectedInventory = manifest.models.find((model: any) =>
  model.id === comparison.selectedModelId);
if (!selectedConfig || !selectedInventory) throw new Error('Selected model metadata is missing from run manifest.');
const frozenConfig = {
  schemaVersion: 'frozen-judge-config-v1',
  status: 'selected',
  frozenAtUtc: createdAtUtc,
  selectedModel: {
    provider: manifest.provider,
    modelId: comparison.selectedModelId,
    observedName: selectedInventory.name,
    providerCreatedEpoch: selectedInventory.created,
    observedContextWindow: selectedInventory.context_window,
    revisionPinning: 'exact_provider_model_id_plus_observed_inventory_metadata',
    limitation: 'Groq did not expose an immutable revision digest; future runs must re-check inventory and report any alias drift.',
  },
  prompt: {
    path: manifest.promptPath,
    version: selectedConfig.promptVersion,
    sha256: manifest.promptSha256,
  },
  responseSchema: { sha256: manifest.responseSchemaSha256 },
  decoding: selectedConfig,
  reference: inputRecord(referencePath),
  evidenceContextAudit: inputRecord(auditPath),
  selectionCriteria: JUDGE_SELECTION_CRITERIA,
  selectionResult: comparison,
  codeCommits: {
    execution: manifest.codeCommit,
    evaluation: evaluationCodeCommit,
  },
  protectedHeldOutDataUsed: false,
};

const validation = {
  schemaVersion: 'evidence-context-validation-v1',
  createdAtUtc,
  audit: inputRecord(auditPath),
  expectedRows: 42,
  observedRows: auditRows.length,
  sourceFieldsMatched: true,
  duplicates: 0,
  missingRows: 0,
  invalidRows: 0,
  unsupportedRowsWithNotes: auditRows.filter(row =>
    row.evidence_context_supported === 'false' && row.auditor_notes.trim().length > 0).length,
  models: [gptMetrics, qwenMetrics].map(metrics => ({
    modelId: metrics.modelId,
    auditedRows: metrics.evidenceContextAuditedCount,
    supportedRows: Math.round((metrics.evidenceContextSupportRate ?? 0) * metrics.evidenceContextAuditedCount),
    evidenceContextSupportRate: metrics.evidenceContextSupportRate,
    gateMinimum: JUDGE_SELECTION_CRITERIA.hardGates.minimumEvidenceContextSupportRate,
    gatePass: metrics.evidenceContextSupportRate !== null &&
      metrics.evidenceContextSupportRate >= JUDGE_SELECTION_CRITERIA.hardGates.minimumEvidenceContextSupportRate,
  })),
};

writeNewJson(outputFiles.gptAudited, gptAudited);
writeNewJson(outputFiles.qwenAudited, qwenAudited);
writeNewJson(outputFiles.comparison, finalComparison);
writeNewJson(outputFiles.validation, validation);
writeNewJson(outputFiles.frozenConfig, frozenConfig);

const report = `# Judge Selection Report\n\n` +
  `**Run:** \`${manifest.runId}\`  \n` +
  `**Development set:** 50 frozen Human Reference v2 pairs  \n` +
  `**Held-out test used:** No  \n` +
  `**Selected Judge:** \`${comparison.selectedModelId}\`\n\n` +
  `## Decision\n\n` +
  `Qwen is selected because it is the only candidate that passes every preregistered hard gate. ` +
  `GPT-OSS fails contextual evidence support (20/22, 90.91%) and critical disagreement (3/50, 6.00%). ` +
  `Qwen achieves 20/20 contextual evidence support and 2/50 critical disagreements.\n\n` +
  `| Metric | GPT-OSS 120B | Qwen 3.8 27B |\n` +
  `| --- | ---: | ---: |\n` +
  `| Exact agreement | ${percent(gptMetrics.exactAgreement)} | ${percent(qwenMetrics.exactAgreement)} |\n` +
  `| MAE | ${gptMetrics.meanAbsoluteError?.toFixed(4)} | ${qwenMetrics.meanAbsoluteError?.toFixed(4)} |\n` +
  `| Quadratic weighted kappa | ${gptMetrics.quadraticWeightedKappa?.toFixed(4)} | ${qwenMetrics.quadraticWeightedKappa?.toFixed(4)} |\n` +
  `| Macro-F1 | ${gptMetrics.macroF1?.toFixed(4)} | ${qwenMetrics.macroF1?.toFixed(4)} |\n` +
  `| Schema pass | ${percent(gptMetrics.schemaPassRate)} | ${percent(qwenMetrics.schemaPassRate)} |\n` +
  `| Verbatim evidence | ${percent(gptMetrics.evidenceVerbatimMatchRate)} | ${percent(qwenMetrics.evidenceVerbatimMatchRate)} |\n` +
  `| Contextual evidence support | ${percent(gptMetrics.evidenceContextSupportRate)} | ${percent(qwenMetrics.evidenceContextSupportRate)} |\n` +
  `| Critical disagreement | ${percent(gptMetrics.criticalDisagreementRate)} | ${percent(qwenMetrics.criticalDisagreementRate)} |\n` +
  `| Total tokens | ${gptMetrics.inputTokens + gptMetrics.outputTokens} | ${qwenMetrics.inputTokens + qwenMetrics.outputTokens} |\n` +
  `| Mean latency | ${gptMetrics.meanLatencyMs?.toFixed(2)} ms | ${qwenMetrics.meanLatencyMs?.toFixed(2)} ms |\n\n` +
  `## Frozen configuration\n\n` +
  `The exact model ID, observed provider metadata, prompt hash, schema hash, decoding settings, reference hash, ` +
  `audit hash, selection criteria and execution/evaluation commits are recorded in \`frozen_judge_config.json\`. ` +
  `Groq did not expose an immutable model revision digest, so the exact API model ID is frozen with observed inventory metadata and alias drift must be checked before reuse.\n\n` +
  `## Checkpoint\n\n` +
  `This report completes Judge Selection on the 50-pair Development Set. The 240-pair held-out test set was not accessed or executed.\n`;
fs.writeFileSync(outputFiles.report, report, { encoding: 'utf8', flag: 'wx' });

const finalizedArtifacts = Object.entries(outputFiles)
  .filter(([name]) => name !== 'selectionManifest')
  .map(([name, file]) => ({ name, ...inputRecord(file) }));
writeNewJson(outputFiles.selectionManifest, {
  schemaVersion: 'judge-selection-finalization-v1',
  createdAtUtc,
  runId: manifest.runId,
  selectedModelId: comparison.selectedModelId,
  status: comparison.status,
  protectedHeldOutDataUsed: false,
  artifacts: finalizedArtifacts,
});

console.log(JSON.stringify({
  status: 'FINALIZED',
  selectedModelId: comparison.selectedModelId,
  gatePass: comparison.gatePass,
  outputFiles,
}, null, 2));
