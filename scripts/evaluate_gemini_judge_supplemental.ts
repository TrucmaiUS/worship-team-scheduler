import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  applyEvidenceContextAudit,
  evaluateJudgeCandidate,
  finalHumanScore,
  JUDGE_SELECTION_CRITERIA,
  type JudgeMetrics,
  type JudgeSelectionOutput,
  type JudgeSelectionPair,
} from '../lib/research/e5-distillation/judge-selection';
import { loadCorpus, parseCsv } from '../lib/research/e5-distillation/corpus';

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`Missing ${name} <path>.`);
  return path.resolve(process.argv[index + 1]);
}

function readJson(file: string): any {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256(file: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function percentile(values: number[], probability: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

interface PositiveMetrics {
  threshold: 'grade >= 2';
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  trueNegative: number;
  precision: number;
  recall: number;
  f1: number;
}

function positiveMetrics(
  pairs: JudgeSelectionPair[],
  outputs: JudgeSelectionOutput[]
): PositiveMetrics {
  const byPair = new Map(outputs.map(output => [output.pairId, output]));
  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  let trueNegative = 0;
  for (const pair of pairs) {
    const humanPositive = finalHumanScore(pair) >= 2;
    const output = byPair.get(pair.pairId)!;
    const predictedPositive = output.schemaPass && (output.relevanceScore ?? -1) >= 2;
    if (humanPositive && predictedPositive) truePositive += 1;
    else if (!humanPositive && predictedPositive) falsePositive += 1;
    else if (humanPositive) falseNegative += 1;
    else trueNegative += 1;
  }
  const precision = truePositive + falsePositive === 0 ? 0 :
    truePositive / (truePositive + falsePositive);
  const recall = truePositive + falseNegative === 0 ? 0 :
    truePositive / (truePositive + falseNegative);
  return {
    threshold: 'grade >= 2', truePositive, falsePositive, falseNegative, trueNegative,
    precision, recall,
    f1: precision + recall === 0 ? 0 : 2 * precision * recall / (precision + recall),
  };
}

function exactCorrect(pair: JudgeSelectionPair, output: JudgeSelectionOutput): boolean {
  return output.schemaPass && output.relevanceScore === finalHumanScore(pair);
}

function pairedExactBootstrap(
  pairs: JudgeSelectionPair[],
  gemini: JudgeSelectionOutput[],
  qwen: JudgeSelectionOutput[]
) {
  const geminiByPair = new Map(gemini.map(output => [output.pairId, output]));
  const qwenByPair = new Map(qwen.map(output => [output.pairId, output]));
  const clusters = [...Map.groupBy(pairs, pair => pair.sourceQueryId).values()];
  const random = seededRandom(20261113);
  const replicates = 2000;
  const deltas = Array.from({ length: replicates }, () => {
    const sample = Array.from({ length: clusters.length }, () =>
      clusters[Math.floor(random() * clusters.length)]).flat();
    const geminiExact = sample.filter(pair => exactCorrect(pair, geminiByPair.get(pair.pairId)!)).length /
      sample.length;
    const qwenExact = sample.filter(pair => exactCorrect(pair, qwenByPair.get(pair.pairId)!)).length /
      sample.length;
    return geminiExact - qwenExact;
  });
  return {
    clusterField: 'sourceQueryId', clusterCount: clusters.length, replicates,
    seed: 20261113, confidenceLevel: 0.95,
    deltaDefinition: 'Gemini exact agreement minus Qwen exact agreement',
    interval: { lower: percentile(deltas, 0.025), upper: percentile(deltas, 0.975) },
  };
}

function combination(n: number, k: number): number {
  let value = 1;
  for (let index = 1; index <= k; index += 1) value = value * (n - index + 1) / index;
  return value;
}

function mcnemarExact(discordantA: number, discordantB: number): number {
  const total = discordantA + discordantB;
  if (total === 0) return 1;
  const smaller = Math.min(discordantA, discordantB);
  let cumulative = 0;
  for (let index = 0; index <= smaller; index += 1) cumulative += combination(total, index);
  return Math.min(1, 2 * cumulative / 2 ** total);
}

function metricRow(metrics: JudgeMetrics, positives: PositiveMetrics) {
  return {
    ...metrics,
    positiveGradeAtLeast2: positives,
    totalTokens: metrics.inputTokens + metrics.outputTokens,
  };
}

function percent(value: number | null): string {
  return value === null ? 'pending' : `${(value * 100).toFixed(2)}%`;
}

const root = path.resolve(__dirname, '..');
const runDirectory = argument('--run');
const auditIndex = process.argv.indexOf('--audit');
const auditPath = auditIndex >= 0 ? argument('--audit') : null;
const manifestPath = path.join(runDirectory, 'run_manifest.json');
const geminiEvaluationPath = path.join(runDirectory, 'gemini-3.1-flash-lite_evaluation.json');
const geminiRawPath = path.join(runDirectory, 'gemini-3.1-flash-lite_raw.json');
const outputJson = path.join(runDirectory, auditPath
  ? 'supplemental_model_comparison_final.json' : 'supplemental_model_comparison.json');
const outputMarkdown = path.join(runDirectory, auditPath
  ? 'gemini_judge_supplemental_final_report.md' : 'gemini_judge_supplemental_report.md');
const auditedEvaluationPath = path.join(runDirectory,
  'gemini-3.1-flash-lite_evaluation_audited.json');
const validationPath = path.join(runDirectory, 'evidence_context_validation_report.json');
if (fs.existsSync(outputJson) || fs.existsSync(outputMarkdown) ||
    (auditPath && (fs.existsSync(auditedEvaluationPath) || fs.existsSync(validationPath)))) {
  throw new Error('Refusing to overwrite supplemental evaluation report.');
}

const referencePath = path.join(root,
  'benchmark/distillation/human_reference/judge_selection_reference_v2.json');
const frozenRun = path.join(root,
  'benchmark/distillation/judge_selection_runs/judge-selection-v5-2026-11-18T04-26-20-960Z');
const frozenComparisonPath = path.join(frozenRun, 'model_comparison_final.json');
const qwenEvaluationPath = path.join(frozenRun, 'qwen__qwen3.8-27b_evaluation_audited.json');
const gptEvaluationPath = path.join(frozenRun, 'openai__gpt-oss-120b_evaluation_audited.json');
const frozenConfigPath = path.join(frozenRun, 'frozen_judge_config.json');
const references = readJson(referencePath) as JudgeSelectionPair[];
const baseGeminiOutputs = readJson(geminiEvaluationPath) as JudgeSelectionOutput[];
const auditRows = auditPath ? parseCsv(fs.readFileSync(auditPath, 'utf8')) : null;
const geminiOutputs = auditRows
  ? applyEvidenceContextAudit(references, baseGeminiOutputs, auditRows)
  : baseGeminiOutputs;
const qwenOutputs = readJson(qwenEvaluationPath) as JudgeSelectionOutput[];
const gptOutputs = readJson(gptEvaluationPath) as JudgeSelectionOutput[];

const queryRows = parseCsv(fs.readFileSync(path.join(root,
  'benchmark/distillation/human_reference/query_manifest_v2.csv'), 'utf8'));
const developmentQueries = new Map(queryRows.map(row => [row.reference_query_id, {
  topicId: row.source_topic_id || null,
  queryText: row.query_text,
}]));
const corpus = loadCorpus(path.join(root, 'benchmark/data/songs.csv'));
const corpusSections = new Map(corpus.songs.flatMap(song => song.sections.map(section => [
  section.sectionId, { sectionType: section.sectionType, lyrics: section.lyrics },
] as const)));
const geminiMetrics = evaluateJudgeCandidate(references, geminiOutputs, {
  developmentQueries, corpusSections,
});
const frozenComparison = readJson(frozenComparisonPath);
const qwenMetrics = frozenComparison.candidates.find((candidate: JudgeMetrics) =>
  candidate.modelId === 'qwen/qwen3.8-27b') as JudgeMetrics;
const gptMetrics = frozenComparison.candidates.find((candidate: JudgeMetrics) =>
  candidate.modelId === 'openai/gpt-oss-120b') as JudgeMetrics;
const geminiPositive = positiveMetrics(references, geminiOutputs);
const qwenPositive = positiveMetrics(references, qwenOutputs);
const gptPositive = positiveMetrics(references, gptOutputs);
const geminiByPair = new Map(geminiOutputs.map(output => [output.pairId, output]));
const qwenByPair = new Map(qwenOutputs.map(output => [output.pairId, output]));
const mismatches = references.flatMap(pair => {
  const output = geminiByPair.get(pair.pairId)!;
  const human = finalHumanScore(pair);
  if (output.schemaPass && output.relevanceScore === human) return [];
  return [{
    pairId: pair.pairId,
    sourceQueryId: pair.sourceQueryId,
    queryText: pair.queryText,
    candidateLyrics: pair.candidate.lyrics,
    humanScore: human,
    geminiScore: output.relevanceScore,
    qwenScore: qwenByPair.get(pair.pairId)?.relevanceScore ?? null,
    absoluteDifference: output.relevanceScore === null ? null : Math.abs(output.relevanceScore - human),
    evidenceQuotes: output.evidenceQuotes,
    schemaPass: output.schemaPass,
  }];
});
const geminiCorrectQwenWrong = references.filter(pair =>
  exactCorrect(pair, geminiByPair.get(pair.pairId)!) &&
  !exactCorrect(pair, qwenByPair.get(pair.pairId)!)).length;
const qwenCorrectGeminiWrong = references.filter(pair =>
  exactCorrect(pair, qwenByPair.get(pair.pairId)!) &&
  !exactCorrect(pair, geminiByPair.get(pair.pairId)!)).length;
const rawRecords = readJson(geminiRawPath) as Array<{ attempts?: Array<{ usage?: {
  visibleOutputTokens?: number | null; thoughtTokens?: number | null;
} }> }>;
const visibleOutputTokens = rawRecords.reduce((sum, record) => sum +
  (record.attempts ?? []).reduce((attemptSum, attempt) =>
    attemptSum + (attempt.usage?.visibleOutputTokens ?? 0), 0), 0);
const thoughtTokens = rawRecords.reduce((sum, record) => sum +
  (record.attempts ?? []).reduce((attemptSum, attempt) =>
    attemptSum + (attempt.usage?.thoughtTokens ?? 0), 0), 0);

const hardGateStatus = {
  schemaPassRate: {
    value: geminiMetrics.schemaPassRate,
    threshold: JUDGE_SELECTION_CRITERIA.hardGates.schemaPassRate,
    status: geminiMetrics.schemaPassRate === 1 ? 'pass' : 'fail',
  },
  evidenceVerbatimMatchRate: {
    value: geminiMetrics.evidenceVerbatimMatchRate,
    threshold: JUDGE_SELECTION_CRITERIA.hardGates.evidenceVerbatimMatchRate,
    status: geminiMetrics.evidenceVerbatimMatchRate === 1 ? 'pass' : 'fail',
  },
  evidenceContextSupportRate: {
    value: geminiMetrics.evidenceContextSupportRate,
    threshold: JUDGE_SELECTION_CRITERIA.hardGates.minimumEvidenceContextSupportRate,
    status: geminiMetrics.evidenceContextSupportRate === null
      ? 'pending_human_audit'
      : geminiMetrics.evidenceContextSupportRate >=
        JUDGE_SELECTION_CRITERIA.hardGates.minimumEvidenceContextSupportRate
        ? 'pass' : 'fail',
  },
  criticalDisagreementRate: {
    value: geminiMetrics.criticalDisagreementRate,
    threshold: JUDGE_SELECTION_CRITERIA.hardGates.maximumCriticalDisagreementRate,
    status: geminiMetrics.criticalDisagreementRate <= 0.05 ? 'pass' : 'fail',
  },
};
const pairedBootstrap = pairedExactBootstrap(references, geminiOutputs, qwenOutputs);
const observedMetricLeader = geminiMetrics.quadraticWeightedKappa !== null &&
  qwenMetrics.quadraticWeightedKappa !== null &&
  geminiMetrics.quadraticWeightedKappa > qwenMetrics.quadraticWeightedKappa
  ? 'gemini-3.1-flash-lite' : 'qwen/qwen3.8-27b';
const report = {
  schemaVersion: 'gemini-judge-supplemental-report-v1',
  createdAtUtc: new Date().toISOString(),
  supplementalOnly: true,
  selectedJudgeConfigurationChanged: false,
  protectedHeldOutDataUsed: false,
  inputs: {
    runManifest: { path: path.relative(root, manifestPath).replaceAll('\\', '/'), sha256: sha256(manifestPath) },
    humanReference: { path: path.relative(root, referencePath).replaceAll('\\', '/'), sha256: sha256(referencePath) },
    geminiEvaluation: { path: path.relative(root, geminiEvaluationPath).replaceAll('\\', '/'), sha256: sha256(geminiEvaluationPath) },
    ...(auditPath ? {
      evidenceContextAudit: {
        path: path.relative(root, auditPath).replaceAll('\\', '/'), sha256: sha256(auditPath),
      },
    } : {}),
    frozenComparison: { path: path.relative(root, frozenComparisonPath).replaceAll('\\', '/'), sha256: sha256(frozenComparisonPath) },
    frozenQwenConfig: { path: path.relative(root, frozenConfigPath).replaceAll('\\', '/'), sha256: sha256(frozenConfigPath) },
  },
  criteria: JUDGE_SELECTION_CRITERIA,
  candidates: [
    metricRow(gptMetrics, gptPositive),
    metricRow(qwenMetrics, qwenPositive),
    {
      ...metricRow(geminiMetrics, geminiPositive),
      visibleOutputTokens,
      thoughtTokens,
      hardGateStatus,
    },
  ],
  directGeminiVsQwen: {
    observedMetricLeader,
    exactAgreementDelta: geminiMetrics.exactAgreement - qwenMetrics.exactAgreement,
    qwkDelta: (geminiMetrics.quadraticWeightedKappa ?? 0) - (qwenMetrics.quadraticWeightedKappa ?? 0),
    macroF1Delta: (geminiMetrics.macroF1 ?? 0) - (qwenMetrics.macroF1 ?? 0),
    maeDelta: (geminiMetrics.meanAbsoluteError ?? 0) - (qwenMetrics.meanAbsoluteError ?? 0),
    positivePrecisionDelta: geminiPositive.precision - qwenPositive.precision,
    positiveRecallDelta: geminiPositive.recall - qwenPositive.recall,
    pairedCorrectness: {
      geminiCorrectQwenWrong,
      qwenCorrectGeminiWrong,
      mcnemarExactTwoSidedP: mcnemarExact(geminiCorrectQwenWrong, qwenCorrectGeminiWrong),
    },
    queryClusterBootstrapExactAgreementDelta: pairedBootstrap,
    conclusionPolicy: 'Gemini cannot replace or unfreeze Qwen; contextual evidence remains pending and this supplemental run was not preregistered as a new selection round.',
  },
  errorAnalysis: {
    mismatchCount: mismatches.length,
    criticalDisagreements: mismatches.filter(item => (item.absoluteDifference ?? 0) >= 2),
    humanZeroToJudgeOne: mismatches.filter(item => item.humanScore === 0 && item.geminiScore === 1),
    focusPairs: mismatches.filter(item => ['P032', 'P047'].includes(item.pairId)),
    allMismatches: mismatches,
  },
  limitations: [
    'Only 50 development pairs and 15 sourceQueryId clusters are available; confidence intervals are wide.',
    'The grade distribution is fixed at 17/9/8/16, so per-grade estimates have small denominators.',
    'At 50 pairs, one error changes a rate by two percentage points and the 5% critical-disagreement gate effectively permits at most two errors.',
    'This is one seeded API run; provider nondeterminism and future model alias drift are not measured.',
    auditPath
      ? 'Gemini contextual evidence support is based on one completed human audit of the 24 grade 2–3 outputs.'
      : 'Gemini contextual evidence support requires a separate human audit before all hard gates can be evaluated.',
    'Sampling and low-reasoning controls are matched by value where supported, but provider semantics and token accounting are not identical.',
  ],
};
fs.writeFileSync(outputJson, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
if (auditPath) {
  fs.writeFileSync(auditedEvaluationPath, `${JSON.stringify(geminiOutputs, null, 2)}\n`, {
    encoding: 'utf8', flag: 'wx',
  });
  const supportedRows = auditRows!.filter(row => row.evidence_context_supported === 'true').length;
  fs.writeFileSync(validationPath, `${JSON.stringify({
    schemaVersion: 'gemini-evidence-context-validation-v1',
    createdAtUtc: new Date().toISOString(),
    source: {
      path: path.relative(root, auditPath).replaceAll('\\', '/'),
      sha256: sha256(auditPath),
    },
    expectedRows: geminiMetrics.evidenceRequiredCount,
    observedRows: auditRows!.length,
    sourceFieldsMatched: true,
    duplicates: 0,
    missingRows: 0,
    invalidRows: 0,
    supportedRows,
    unsupportedRows: auditRows!.length - supportedRows,
    evidenceContextSupportRate: geminiMetrics.evidenceContextSupportRate,
    gateMinimum: JUDGE_SELECTION_CRITERIA.hardGates.minimumEvidenceContextSupportRate,
    gatePass: geminiMetrics.evidenceContextSupportRate !== null &&
      geminiMetrics.evidenceContextSupportRate >=
        JUDGE_SELECTION_CRITERIA.hardGates.minimumEvidenceContextSupportRate,
  }, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
}

const reportMarkdown = `# Gemini 3.1 Flash-Lite Supplemental Judge Report\n\n` +
  `This is a supplemental development-set experiment. It does not change the frozen Qwen Judge and does not use the held-out test set.\n\n` +
  `| Metric | GPT-OSS 120B | Qwen 3.8 27B | Gemini 3.1 Flash-Lite |\n` +
  `| --- | ---: | ---: | ---: |\n` +
  `| Exact agreement | ${percent(gptMetrics.exactAgreement)} | ${percent(qwenMetrics.exactAgreement)} | ${percent(geminiMetrics.exactAgreement)} |\n` +
  `| MAE | ${gptMetrics.meanAbsoluteError?.toFixed(4)} | ${qwenMetrics.meanAbsoluteError?.toFixed(4)} | ${geminiMetrics.meanAbsoluteError?.toFixed(4)} |\n` +
  `| QWK | ${gptMetrics.quadraticWeightedKappa?.toFixed(4)} | ${qwenMetrics.quadraticWeightedKappa?.toFixed(4)} | ${geminiMetrics.quadraticWeightedKappa?.toFixed(4)} |\n` +
  `| Macro-F1 | ${gptMetrics.macroF1?.toFixed(4)} | ${qwenMetrics.macroF1?.toFixed(4)} | ${geminiMetrics.macroF1?.toFixed(4)} |\n` +
  `| Positive precision (grade >= 2) | ${percent(gptPositive.precision)} | ${percent(qwenPositive.precision)} | ${percent(geminiPositive.precision)} |\n` +
  `| Positive recall (grade >= 2) | ${percent(gptPositive.recall)} | ${percent(qwenPositive.recall)} | ${percent(geminiPositive.recall)} |\n` +
  `| Evidence verbatim validity | ${percent(gptMetrics.evidenceVerbatimMatchRate)} | ${percent(qwenMetrics.evidenceVerbatimMatchRate)} | ${percent(geminiMetrics.evidenceVerbatimMatchRate)} |\n` +
  `| Evidence contextual support | ${percent(gptMetrics.evidenceContextSupportRate)} | ${percent(qwenMetrics.evidenceContextSupportRate)} | ${percent(geminiMetrics.evidenceContextSupportRate)} |\n` +
  `| Critical disagreement | ${percent(gptMetrics.criticalDisagreementRate)} | ${percent(qwenMetrics.criticalDisagreementRate)} | ${percent(geminiMetrics.criticalDisagreementRate)} |\n` +
  `| Schema pass | ${percent(gptMetrics.schemaPassRate)} | ${percent(qwenMetrics.schemaPassRate)} | ${percent(geminiMetrics.schemaPassRate)} |\n` +
  `| Total tokens | ${gptMetrics.inputTokens + gptMetrics.outputTokens} | ${qwenMetrics.inputTokens + qwenMetrics.outputTokens} | ${geminiMetrics.inputTokens + geminiMetrics.outputTokens} |\n` +
  `| Mean latency | ${gptMetrics.meanLatencyMs?.toFixed(2)} ms | ${qwenMetrics.meanLatencyMs?.toFixed(2)} ms | ${geminiMetrics.meanLatencyMs?.toFixed(2)} ms |\n\n` +
  `## Confusion matrix\n\n` +
  `Rows are Human grades 0–3; columns are Gemini grades 0–3 plus schema failure.\n\n` +
  geminiMetrics.confusionMatrix.map((row, grade) => `- Human ${grade}: ${row.join(', ')}`).join('\n') +
  `\n\n## Direct comparison with Qwen\n\n` +
  `Observed exact-agreement delta (Gemini - Qwen): ${(geminiMetrics.exactAgreement - qwenMetrics.exactAgreement).toFixed(4)}. ` +
  `The query-cluster bootstrap 95% interval is [${pairedBootstrap.interval.lower.toFixed(4)}, ${pairedBootstrap.interval.upper.toFixed(4)}]. ` +
  `McNemar exact p=${mcnemarExact(geminiCorrectQwenWrong, qwenCorrectGeminiWrong).toFixed(4)} ` +
  `(${geminiCorrectQwenWrong} Gemini-only correct vs ${qwenCorrectGeminiWrong} Qwen-only correct).\n\n` +
  `## Evidence and decision boundary\n\n` +
  (auditPath
    ? `Verbatim evidence is code-validated and contextual evidence support is based on the completed human audit. `
    : `Verbatim evidence is code-validated. Contextual evidence support is not inferred by the model and remains pending an independent human audit. `) +
  `This experiment cannot change the frozen Qwen Judge configuration.\n\n` +
  `## Statistical limitations\n\n` +
  report.limitations.map(item => `- ${item}`).join('\n') + '\n';
fs.writeFileSync(outputMarkdown, reportMarkdown, { encoding: 'utf8', flag: 'wx' });
console.log(JSON.stringify({
  status: 'EVALUATED', outputJson, outputMarkdown,
  ...(auditPath ? { auditedEvaluationPath, validationPath } : {}),
  geminiMetrics: metricRow(geminiMetrics, geminiPositive),
  hardGateStatus, directGeminiVsQwen: report.directGeminiVsQwen,
}, null, 2));
