import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildSourceManifest,
  loadCorpus,
  loadProtectedQueries,
  loadTrainTopics,
} from '../lib/research/e5-distillation/corpus';
import {
  callGeminiTeacher,
  GEMINI_API_BASE_URL,
  GEMINI_TEACHER_MODEL_ID,
  geminiTeacherResponseSchemaSha256,
  type GeminiTeacherAttemptLog,
} from '../lib/research/e5-distillation/gemini-teacher';
import {
  callGroqJudge,
  GROQ_OPENAI_BASE_URL,
  groqJudgeResponseSchemaSha256,
  type GroqJudgeAttemptLog,
} from '../lib/research/e5-distillation/groq-judge';
import { inspectHeldOutIntent } from '../lib/research/e5-distillation/held-out-intent';
import { auditQueryLeakage } from '../lib/research/e5-distillation/leakage';
import { normalizeForComparison } from '../lib/research/e5-distillation/normalization';
import { GenerationRequestSchema } from '../lib/research/e5-distillation/request-contracts';
import { assertGenerationSourceEligible } from '../lib/research/e5-distillation/split-integrity';
import {
  auditGeneratedDuplicates,
  hasTitleOrArtistLeak,
  queryLyricWordOverlap,
  selectPilotSources,
  sharedLyricSpan,
} from '../lib/research/e5-distillation/teacher-pilot';
import type { ReferenceText } from '../lib/research/e5-distillation/types';

const ROOT = path.resolve(__dirname, '..');
const geminiApiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
const groqApiKey = process.env.GROQ_API_KEY?.trim();
if (!geminiApiKey) throw new Error('GEMINI_API_KEY or GOOGLE_API_KEY is not configured.');
if (!groqApiKey) throw new Error('GROQ_API_KEY is not configured.');
const requiredGeminiApiKey: string = geminiApiKey;
const requiredGroqApiKey: string = groqApiKey;

const createdAtUtc = new Date().toISOString();
const preflight = process.argv.includes('--preflight');
const resumeIndex = process.argv.indexOf('--resume');
const resumeRunId = resumeIndex >= 0 ? process.argv[resumeIndex + 1] : null;
if (resumeIndex >= 0 && !resumeRunId) throw new Error('Missing --resume <run-id>.');
const runId = resumeRunId ??
  `teacher-judge-pilot-v1${preflight ? '-preflight' : ''}-${createdAtUtc.replace(/[:.]/gu, '-')}`;
const outputDirectory = path.join(ROOT, 'benchmark/distillation/teacher_judge_pilot_runs', runId);
if (resumeRunId) {
  if (!fs.existsSync(outputDirectory)) throw new Error(`Resume run does not exist: ${outputDirectory}`);
} else {
  if (fs.existsSync(outputDirectory)) throw new Error(`Run directory already exists: ${outputDirectory}`);
  fs.mkdirSync(outputDirectory, { recursive: true });
}

const corpusPath = path.join(ROOT, 'benchmark/data/songs.csv');
const topicsPath = path.join(ROOT, 'benchmark/data/topics.csv');
const protectedQueriesPath = path.join(ROOT, 'benchmark/data/queries.csv');
const humanReferencePath = path.join(ROOT,
  'benchmark/distillation/human_reference/judge_selection_reference_v2.json');
const teacherPromptPath = path.join(ROOT,
  'docs/research/e5_distillation/prompts/gemini-query-generation-teacher-pilot-v1.txt');
const frozenJudgePath = path.join(ROOT,
  'benchmark/distillation/judge_selection_runs/judge-selection-v5-2026-11-18T04-26-20-960Z/frozen_judge_config.json');

function readNormalized(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/gu, '\n').trimEnd();
}

function sha256(value: string | Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function fileSha256(filePath: string): string {
  return sha256(fs.readFileSync(filePath));
}

function writeJson(fileName: string, value: unknown): void {
  fs.writeFileSync(path.join(outputDirectory, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(fileName: string, headers: readonly string[], rows: readonly Record<string, unknown>[]): void {
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map(header => csvEscape(row[header])).join(','));
  fs.writeFileSync(path.join(outputDirectory, fileName), `${lines.join('\n')}\n`, 'utf8');
}

function writeJsonl(fileName: string, rows: readonly unknown[]): void {
  fs.writeFileSync(path.join(outputDirectory, fileName),
    `${rows.map(row => JSON.stringify(row)).join('\n')}\n`, 'utf8');
}

function sum(values: readonly (number | null)[]): number {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

function mean(values: readonly number[]): number | null {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

function percentile(values: readonly number[], probability: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(probability * sorted.length) - 1)];
}

function frequency(values: readonly (string | number)[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const value of values) result[String(value)] = (result[String(value)] ?? 0) + 1;
  return result;
}

async function pause(milliseconds: number): Promise<void> {
  await new Promise<void>(resolve => setTimeout(resolve, milliseconds));
}

async function fetchInventories(frozenConfig: any): Promise<Record<string, unknown>> {
  const [geminiResponse, groqResponse] = await Promise.all([
    fetch(`${GEMINI_API_BASE_URL}/models/${GEMINI_TEACHER_MODEL_ID}`, {
      headers: { 'x-goog-api-key': requiredGeminiApiKey, Accept: 'application/json' },
    }),
    fetch(`${GROQ_OPENAI_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${requiredGroqApiKey}`, Accept: 'application/json' },
    }),
  ]);
  if (!geminiResponse.ok) throw new Error(`Gemini inventory failed: HTTP ${geminiResponse.status}.`);
  if (!groqResponse.ok) throw new Error(`Groq inventory failed: HTTP ${groqResponse.status}.`);
  const gemini = await geminiResponse.json() as any;
  const groq = await groqResponse.json() as any;
  if (gemini.name !== `models/${GEMINI_TEACHER_MODEL_ID}` ||
      !gemini.supportedGenerationMethods?.includes('generateContent')) {
    throw new Error('Pinned Gemini Teacher identity or generateContent support is unavailable.');
  }
  const judge = groq.data?.find((model: any) => model.id === frozenConfig.selectedModel.modelId);
  if (!judge?.active) throw new Error('Frozen Qwen Judge is not active in the Groq inventory.');
  if (judge.context_window !== frozenConfig.selectedModel.observedContextWindow) {
    throw new Error(
      `Frozen Qwen inventory drift: context window ${judge.context_window} != ` +
      `${frozenConfig.selectedModel.observedContextWindow}.`
    );
  }
  return { geminiTeacher: gemini, frozenQwenJudge: judge };
}

async function main(): Promise<void> {
  const corpus = loadCorpus(corpusPath);
  const trainTopics = loadTrainTopics(topicsPath);
  const protectedQueries = loadProtectedQueries(protectedQueriesPath);
  const humanReferences = JSON.parse(fs.readFileSync(humanReferencePath, 'utf8')) as any[];
  if (humanReferences.length !== 50) throw new Error('Expected exactly 50 Human Reference pairs.');
  const humanReferenceSectionIds = new Set<string>(
    humanReferences.map(pair => pair.candidate.sourceSectionId)
  );
  const humanReferenceQueryTexts: ReferenceText[] = humanReferences.map(pair => ({
    id: `human-reference:${pair.pairId}`,
    text: pair.queryText,
    scope: 'development',
  }));
  const protectedReferences: ReferenceText[] = [
    ...protectedQueries.map(query => ({ id: `benchmark:${query.id}`, text: query.text, scope: query.scope })),
    ...humanReferenceQueryTexts,
  ];
  const protectedQueryIds = new Set(protectedQueries.map(query => query.id));
  const sourcePlan = selectPilotSources(corpus, trainTopics, humanReferenceSectionIds);
  const executionPlan = preflight ? sourcePlan.slice(0, 3) : sourcePlan;
  if (!preflight && executionPlan.length !== 50) throw new Error('Pilot plan must contain 50 sources.');
  for (const source of executionPlan) {
    assertGenerationSourceEligible({
      topicIds: [source.topic.topicId],
      songIds: [source.songId],
      sectionIds: [source.sectionId],
      referencedQueryIds: [],
    }, {
      anchorSongIds: new Set(corpus.anchorSongIds),
      protectedQueryIds,
    });
    if (humanReferenceSectionIds.has(source.sectionId)) {
      throw new Error(`Human Reference source section leaked into pilot: ${source.sectionId}.`);
    }
  }

  const teacherPrompt = readNormalized(teacherPromptPath);
  const judgePromptPath = path.join(ROOT,
    'docs/research/e5_distillation/prompts/groq-independent-judge-v4.3.txt');
  const judgePrompt = readNormalized(judgePromptPath);
  const frozenConfig = JSON.parse(fs.readFileSync(frozenJudgePath, 'utf8')) as any;
  if (frozenConfig.selectedModel.modelId !== 'qwen/qwen3.8-27b') {
    throw new Error('Frozen Judge model ID changed unexpectedly.');
  }
  if (sha256(judgePrompt) !== frozenConfig.prompt.sha256) {
    throw new Error('Frozen Judge prompt hash mismatch.');
  }
  if (groqJudgeResponseSchemaSha256() !== frozenConfig.responseSchema.sha256) {
    throw new Error('Frozen Judge response schema hash mismatch.');
  }
  const inventories = await fetchInventories(frozenConfig);
  const teacherConfig = {
    role: 'gemini_teacher' as const,
    task: 'generation' as const,
    provider: 'google' as const,
    modelId: GEMINI_TEACHER_MODEL_ID,
    promptVersion: 'gemini-query-generation-teacher-pilot-v1',
    promptSha256: sha256(teacherPrompt),
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
  const judgeConfig = frozenConfig.decoding;
  const codeCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const sourceManifest = {
    ...buildSourceManifest(corpus, trainTopics, protectedQueries.length),
    humanReferencePairsExcluded: humanReferences.length,
    humanReferenceSectionsExcluded: humanReferenceSectionIds.size,
    selectedSourceSongs: new Set(executionPlan.map(item => item.songId)).size,
    selectedSourceSections: executionPlan.length,
    externalHeldOutSetPresent: false,
    externalHeldOutSetNote: 'No frozen external held-out query artifact exists in the repository at pilot time.',
  };
  writeJson('source_manifest.json', sourceManifest);
  writeJson('model_configs.json', {
    teacher: teacherConfig,
    frozenJudge: frozenConfig,
  });
  const initialManifest = {
    schemaVersion: 'teacher-judge-pilot-run-v1',
    status: 'running',
    runId,
    mode: preflight ? 'three_pair_preflight' : 'fifty_pair_teacher_judge_pilot',
    createdAtUtc,
    codeCommit,
    teacherPrompt: {
      path: path.relative(ROOT, teacherPromptPath).replaceAll('\\', '/'),
      sha256: teacherConfig.promptSha256,
    },
    frozenJudgeConfig: {
      path: path.relative(ROOT, frozenJudgePath).replaceAll('\\', '/'),
      sha256: fileSha256(frozenJudgePath),
    },
    sourceFiles: {
      corpus: { path: path.relative(ROOT, corpusPath).replaceAll('\\', '/'), sha256: fileSha256(corpusPath) },
      topics: { path: path.relative(ROOT, topicsPath).replaceAll('\\', '/'), sha256: fileSha256(topicsPath) },
      protectedQueries: {
        path: path.relative(ROOT, protectedQueriesPath).replaceAll('\\', '/'),
        sha256: fileSha256(protectedQueriesPath),
      },
      humanReference: {
        path: path.relative(ROOT, humanReferencePath).replaceAll('\\', '/'),
        sha256: fileSha256(humanReferencePath),
      },
    },
    inventories,
    sourceManifest,
    requestedPairs: executionPlan.length,
    noFallback: true,
    humanReferenceUsedForTraining: false,
    diagnosticQueriesUsedForGeneration: false,
    heldOutQueriesSentToTeacher: false,
    trainingStarted: false,
  };
  let completedManifestBase: Record<string, unknown> = initialManifest;
  if (resumeRunId) {
    const prior = JSON.parse(fs.readFileSync(path.join(outputDirectory, 'run_manifest.json'), 'utf8'));
    if (prior.teacherPrompt?.sha256 !== initialManifest.teacherPrompt.sha256 ||
        prior.frozenJudgeConfig?.sha256 !== initialManifest.frozenJudgeConfig.sha256 ||
        prior.sourceFiles?.corpus?.sha256 !== initialManifest.sourceFiles.corpus.sha256) {
      throw new Error('Resume blocked by prompt, Judge config, or corpus hash drift.');
    }
    completedManifestBase = {
      ...initialManifest,
      createdAtUtc: prior.createdAtUtc,
      initialCodeCommit: prior.initialCodeCommit ?? prior.codeCommit,
      resumedAtUtc: createdAtUtc,
      codeCommit,
    };
    writeJson('run_manifest.json', { ...prior, status: 'resuming', resumedAtUtc: createdAtUtc, codeCommit });
  } else {
    writeJson('run_manifest.json', initialManifest);
  }

  const teacherPartialPath = path.join(outputDirectory, 'teacher.partial.json');
  const teacherRecords = resumeRunId && fs.existsSync(teacherPartialPath)
    ? JSON.parse(fs.readFileSync(teacherPartialPath, 'utf8')) as any[]
    : [];
  for (let index = teacherRecords.length; index < executionPlan.length; index += 1) {
    const source = executionPlan[index];
    const sourceAlias = `SOURCE_${String(index + 1).padStart(3, '0')}`;
    const request = GenerationRequestSchema.parse({
      allowed_topic: {
        topic_id: source.topic.topicId,
        title: source.topic.title,
        description: source.topic.description,
      },
      source_sections: [{ section_alias: sourceAlias, lyrics: source.lyrics }],
      target_language: source.targetLanguage,
      query_style: source.queryStyle,
      requested_count: 1,
    });
    const attempts: GeminiTeacherAttemptLog[] = [];
    const result = await callGeminiTeacher({
      apiKey: requiredGeminiApiKey,
      config: { ...teacherConfig, seed: teacherConfig.seed + index * 10 },
      systemPrompt: teacherPrompt,
      request,
      onAttempt: log => attempts.push(log),
    });
    if (result.output.queries.length !== 1 ||
        result.output.queries[0].source_section_aliases.length !== 1 ||
        result.output.queries[0].source_section_aliases[0] !== sourceAlias) {
      throw new Error(`Teacher source coverage mismatch for ${source.queryId}.`);
    }
    teacherRecords.push({
      queryId: source.queryId,
      source,
      request,
      output: result.output.queries[0],
      attempts,
      providerResponse: result.providerResponse,
    });
    writeJson('teacher.partial.json', teacherRecords);
    console.log(`Teacher ${index + 1}/${executionPlan.length} ${source.queryId}`);
    if (index + 1 < executionPlan.length) await pause(500);
  }
  writeJson('gemini_teacher_raw.json', teacherRecords);

  const generatedDuplicateAudit = auditGeneratedDuplicates(teacherRecords.map(record => ({
    queryId: record.queryId,
    queryText: record.output.query_text,
  })));
  const generatedAudits = teacherRecords.map(record => {
    const heldOut = inspectHeldOutIntent(record.output.query_text);
    const leakage = auditQueryLeakage({
      queryText: record.output.query_text,
      references: protectedReferences,
      heldOutIntentFlag: heldOut.explicit,
      requiresHumanReview: heldOut.requiresHumanReview,
      requireSemanticCheck: false,
    });
    const duplicate = generatedDuplicateAudit.get(record.queryId)!;
    const copiedSpan = sharedLyricSpan(record.output.query_text, record.source.lyrics);
    const titleOrArtistLeak = hasTitleOrArtistLeak(
      record.output.query_text, record.source.songTitle, record.source.artist
    );
    const lexicalOverlap = queryLyricWordOverlap(record.output.query_text, record.source.lyrics);
    const validationReasons = [
      ...(leakage.decision === 'rejected' ? leakage.reasons.map(reason => `protected:${reason}`) : []),
      ...(duplicate.duplicateOfQueryId ? [`generated_duplicate:${duplicate.duplicateOfQueryId}`] : []),
      ...(copiedSpan ? ['source_lyric_verbatim_span'] : []),
      ...(titleOrArtistLeak ? ['source_title_or_artist_leak'] : []),
    ];
    return {
      queryId: record.queryId,
      leakage,
      duplicate,
      copiedSpan,
      titleOrArtistLeak,
      lexicalOverlap,
      mechanicalGenerationPass: validationReasons.length === 0,
      validationReasons,
    };
  });
  writeJson('generation_validation.json', generatedAudits);

  const judgePartialPath = path.join(outputDirectory, 'qwen_judge.partial.json');
  const judgeRecords = resumeRunId && fs.existsSync(judgePartialPath)
    ? JSON.parse(fs.readFileSync(judgePartialPath, 'utf8')) as any[]
    : [];
  for (let index = judgeRecords.length; index < teacherRecords.length; index += 1) {
    const record = teacherRecords[index];
    const attempts: GroqJudgeAttemptLog[] = [];
    try {
      const result = await callGroqJudge({
        apiKey: requiredGroqApiKey,
        config: judgeConfig,
        systemPrompt: judgePrompt,
        request: {
          query_text: record.output.query_text,
          candidate: {
            candidate_alias: `CANDIDATE_${String(index + 1).padStart(3, '0')}`,
            section_type: record.source.sectionType,
            lyrics: record.source.lyrics,
          },
        },
        onAttempt: log => attempts.push(log),
      });
      judgeRecords.push({
        queryId: record.queryId,
        output: result.output,
        evidenceVerbatim: result.evidenceVerbatim,
        attempts,
        schemaPass: true,
        failureCode: null,
        failureMessage: null,
      });
    } catch (error) {
      const lastAttempt = attempts.at(-1);
      const recordable = Boolean(lastAttempt && [
        'schema_validation_failure',
        'invalid_json',
        'protocol_validation_failure',
      ].includes(lastAttempt.failureCode ?? ''));
      if (!recordable) throw error;
      judgeRecords.push({
        queryId: record.queryId,
        output: null,
        evidenceVerbatim: null,
        attempts,
        schemaPass: false,
        failureCode: lastAttempt?.failureCode ?? 'judge_output_invalid',
        failureMessage: error instanceof Error ? error.message : String(error),
      });
    }
    writeJson('qwen_judge.partial.json', judgeRecords);
    console.log(`Judge ${index + 1}/${teacherRecords.length} ${record.queryId}`);
    if (index + 1 < teacherRecords.length) await pause(1_000);
  }
  writeJson('qwen_judge_raw.json', judgeRecords);

  const pairRecords = teacherRecords.map((record, index) => {
    const generationAudit = generatedAudits[index];
    const judgment = judgeRecords[index];
    const score = judgment.output?.relevance_score ?? null;
    const judgeBucket = score === null
      ? 'invalid_judge_output'
      : score >= 2
        ? 'positive_candidate'
        : score === 1
          ? 'uncertain_review'
          : 'rejected_candidate';
    const bucket = score === null
      ? 'invalid_judge_output'
      : generationAudit.mechanicalGenerationPass
        ? judgeBucket
        : 'rejected_validation';
    const falseAcceptanceRisk = score !== null && score >= 2 && (
      judgment.output?.is_lexical_overlap_only ||
      generationAudit.lexicalOverlap > 0.35 ||
      judgment.output?.evidence_quotes.length === 0
    );
    const falseRejectionRisk = score !== null && score <= 1 && generationAudit.mechanicalGenerationPass;
    return {
      queryId: record.queryId,
      topicId: record.source.topic.topicId,
      topicTitle: record.source.topic.title,
      targetLanguage: record.source.targetLanguage,
      queryStyle: record.source.queryStyle,
      coverageCategory: record.source.coverageCategory,
      queryText: record.output.query_text,
      sourceSongId: record.source.songId,
      sourceSongTitle: record.source.songTitle,
      sourceArtist: record.source.artist,
      sourceSectionId: record.source.sectionId,
      sourceSectionType: record.source.sectionType,
      sourceSectionLabel: record.source.sectionLabel,
      sourceLyrics: record.source.lyrics,
      selectionScore: record.source.selectionScore,
      judgeModelId: frozenConfig.selectedModel.modelId,
      judgeScore: score,
      judgeLabel: judgment.output?.relevance_label ?? null,
      evidenceQuotes: judgment.output?.evidence_quotes ?? [],
      reasoningSummary: judgment.output?.reasoning_summary ?? null,
      lexicalOverlapOnly: judgment.output?.is_lexical_overlap_only ?? null,
      judgeSchemaPass: judgment.schemaPass ?? judgment.output !== null,
      judgeFailureCode: judgment.failureCode ?? null,
      judgeFailureMessage: judgment.failureMessage ?? null,
      evidenceVerbatimStatus: judgment.evidenceVerbatim?.status ?? 'invalid_judge_output',
      evidenceContextStatus: score !== null && score >= 2
        ? 'pending_human_audit'
        : 'not_required_for_filter',
      theologicalConsistencyStatus: 'pending_human_audit',
      leakageDecision: generationAudit.leakage.decision,
      leakageReasons: generationAudit.leakage.reasons,
      closestProtectedReferenceId: generationAudit.leakage.closestReferenceId,
      protectedMaximumWordJaccard: generationAudit.leakage.maxWordJaccard,
      generatedDuplicateOf: generationAudit.duplicate.duplicateOfQueryId,
      generatedMaximumWordJaccard: generationAudit.duplicate.maximumWordJaccard,
      queryLyricWordOverlap: generationAudit.lexicalOverlap,
      copiedLyricSpan: generationAudit.copiedSpan,
      titleOrArtistLeak: generationAudit.titleOrArtistLeak,
      mechanicalGenerationPass: generationAudit.mechanicalGenerationPass,
      validationReasons: generationAudit.validationReasons,
      judgeBucket,
      pilotBucket: bucket,
      falseAcceptanceRisk,
      falseRejectionRisk,
      trainingEligible: false,
      hardNegativeEligible: false,
    };
  });
  writeJsonl('pilot_pairs.jsonl', pairRecords);

  const teacherAttempts = teacherRecords.flatMap(record => record.attempts);
  const judgeAttempts = judgeRecords.flatMap(record => record.attempts);
  const successfulTeacherAttempts = teacherAttempts.filter((attempt: any) => !attempt.failureCode);
  const successfulJudgeAttempts = judgeAttempts.filter((attempt: any) => !attempt.failureCode);
  const positiveCandidates = pairRecords.filter(record => record.pilotBucket === 'positive_candidate');
  const uncertain = pairRecords.filter(record => record.pilotBucket === 'uncertain_review');
  const rejected = pairRecords.filter(record =>
    record.pilotBucket === 'rejected_candidate' || record.pilotBucket === 'rejected_validation');
  const invalidJudgeOutputs = pairRecords.filter(record => record.pilotBucket === 'invalid_judge_output');
  const pairwiseSimilarities: number[] = [];
  for (let left = 0; left < pairRecords.length; left += 1) {
    for (let right = 0; right < left; right += 1) {
      const audit = auditGeneratedDuplicates([
        { queryId: pairRecords[right].queryId, queryText: pairRecords[right].queryText },
        { queryId: pairRecords[left].queryId, queryText: pairRecords[left].queryText },
      ]).get(pairRecords[left].queryId)!;
      pairwiseSimilarities.push(audit.maximumWordJaccard);
    }
  }
  const metrics = {
    totalPairs: pairRecords.length,
    acceptance: {
      positiveCandidates: positiveCandidates.length,
      acceptanceRate: positiveCandidates.length / pairRecords.length,
      uncertainReview: uncertain.length,
      uncertainRate: uncertain.length / pairRecords.length,
      rejected: rejected.length,
      rejectedRate: rejected.length / pairRecords.length,
      invalidJudgeOutputs: invalidJudgeOutputs.length,
      invalidJudgeOutputRate: invalidJudgeOutputs.length / pairRecords.length,
      note: 'Positive candidates remain ineligible for training until human contextual and theological audit.',
    },
    scoreDistribution: frequency(pairRecords.map(record =>
      record.judgeScore === null ? 'schema_failure' : record.judgeScore)),
    queryDiversity: {
      uniqueNormalizedQueries: new Set(pairRecords.map(record => normalizeForComparison(record.queryText))).size,
      duplicateCount: pairRecords.filter(record => record.generatedDuplicateOf).length,
      meanPairwiseWordJaccard: mean(pairwiseSimilarities),
      p95PairwiseWordJaccard: percentile(pairwiseSimilarities, 0.95),
      languageDistribution: frequency(pairRecords.map(record => record.targetLanguage)),
      styleDistribution: frequency(pairRecords.map(record => record.queryStyle)),
      coverageCategoryDistribution: frequency(pairRecords.map(record => record.coverageCategory)),
    },
    semanticCoverage: {
      topicsCovered: new Set(pairRecords.map(record => record.topicId)).size,
      topicDistribution: frequency(pairRecords.map(record => record.topicId)),
      sourceSongsCovered: new Set(pairRecords.map(record => record.sourceSongId)).size,
      sourceSectionsCovered: new Set(pairRecords.map(record => record.sourceSectionId)).size,
    },
    validation: {
      mechanicalGenerationPass: pairRecords.filter(record => record.mechanicalGenerationPass).length,
      judgeSchemaPass: pairRecords.filter(record => record.judgeSchemaPass).length,
      judgeSchemaFailure: invalidJudgeOutputs.length,
      leakageRejected: pairRecords.filter(record => record.leakageDecision === 'rejected').length,
      leakageHumanReview: pairRecords.filter(record => record.leakageDecision === 'human_review').length,
      copiedLyricSpan: pairRecords.filter(record => record.copiedLyricSpan).length,
      titleOrArtistLeak: pairRecords.filter(record => record.titleOrArtistLeak).length,
      highQueryLyricOverlap: pairRecords.filter(record => record.queryLyricWordOverlap > 0.35).length,
      evidenceVerbatimValid: pairRecords.filter(record => record.evidenceVerbatimStatus === 'valid').length,
      evidenceContextPending: pairRecords.filter(record => record.evidenceContextStatus === 'pending_human_audit').length,
      theologicalConsistencyPending: pairRecords.length,
    },
    riskIndicators: {
      automatedFalseAcceptanceFlags: pairRecords.filter(record => record.falseAcceptanceRisk).length,
      positiveCandidatesPendingHumanContextAndTheologyAudit: positiveCandidates.length,
      falseRejectionRisk: pairRecords.filter(record => record.falseRejectionRisk).length,
      validationRejectedQueriesRequiringHumanAudit: pairRecords.filter(record =>
        record.pilotBucket === 'rejected_validation').length,
      rejectedPairsPromotedToHardNegatives: 0,
    },
    latencyAndTokens: {
      teacher: {
        inputTokens: sum(successfulTeacherAttempts.map((attempt: any) => attempt.usage.inputTokens)),
        visibleOutputTokens: sum(successfulTeacherAttempts.map((attempt: any) => attempt.usage.visibleOutputTokens)),
        thoughtTokens: sum(successfulTeacherAttempts.map((attempt: any) => attempt.usage.thoughtTokens)),
        totalTokens: sum(successfulTeacherAttempts.map((attempt: any) => attempt.usage.totalTokens)),
        meanLatencyMs: mean(successfulTeacherAttempts.map((attempt: any) => attempt.latencyMs)),
        p95LatencyMs: percentile(successfulTeacherAttempts.map((attempt: any) => attempt.latencyMs), 0.95),
      },
      judge: {
        inputTokens: sum(successfulJudgeAttempts.map((attempt: any) => attempt.usage.inputTokens)),
        outputTokens: sum(successfulJudgeAttempts.map((attempt: any) => attempt.usage.outputTokens)),
        totalTokens: sum(successfulJudgeAttempts.map((attempt: any) => attempt.usage.totalTokens)),
        meanLatencyMs: mean(successfulJudgeAttempts.map((attempt: any) => attempt.latencyMs)),
        p95LatencyMs: percentile(successfulJudgeAttempts.map((attempt: any) => attempt.latencyMs), 0.95),
      },
    },
  };
  writeJson('pilot_metrics.json', metrics);
  writeJsonl('execution_log.jsonl', [
    ...teacherAttempts.map((attempt: any) => ({ stage: 'teacher_generation', ...attempt })),
    ...judgeAttempts.map((attempt: any) => ({ stage: 'frozen_qwen_judge', ...attempt })),
  ]);

  const auditHeaders = [
    'query_id', 'pilot_bucket', 'topic_id', 'language', 'coverage_category', 'query_style',
    'query_text', 'source_song_id', 'source_section_id', 'section_type', 'source_lyrics',
    'judge_score', 'judge_label', 'evidence_quotes', 'judge_reasoning',
    'judge_schema_pass', 'judge_failure_code', 'evidence_verbatim_status',
    'evidence_context_supported', 'theological_consistency',
    'human_decision', 'reviewer_notes', 'leakage_decision', 'leakage_reasons',
    'duplicate_of', 'query_lyric_word_overlap', 'copied_lyric_span',
    'false_acceptance_risk', 'false_rejection_risk', 'hard_negative_eligible',
  ];
  const auditRows = pairRecords.map(record => ({
    query_id: record.queryId,
    pilot_bucket: record.pilotBucket,
    topic_id: record.topicId,
    language: record.targetLanguage,
    coverage_category: record.coverageCategory,
    query_style: record.queryStyle,
    query_text: record.queryText,
    source_song_id: record.sourceSongId,
    source_section_id: record.sourceSectionId,
    section_type: record.sourceSectionType,
    source_lyrics: record.sourceLyrics,
    judge_score: record.judgeScore,
    judge_label: record.judgeLabel,
    evidence_quotes: JSON.stringify(record.evidenceQuotes),
    judge_reasoning: record.reasoningSummary,
    judge_schema_pass: record.judgeSchemaPass,
    judge_failure_code: record.judgeFailureCode ?? '',
    evidence_verbatim_status: record.evidenceVerbatimStatus,
    evidence_context_supported: '',
    theological_consistency: '',
    human_decision: '',
    reviewer_notes: '',
    leakage_decision: record.leakageDecision,
    leakage_reasons: record.leakageReasons.join(';'),
    duplicate_of: record.generatedDuplicateOf ?? '',
    query_lyric_word_overlap: record.queryLyricWordOverlap,
    copied_lyric_span: record.copiedLyricSpan ?? '',
    false_acceptance_risk: record.falseAcceptanceRisk,
    false_rejection_risk: record.falseRejectionRisk,
    hard_negative_eligible: false,
  }));
  writeCsv('human_audit.csv', auditHeaders, auditRows);

  const report = `# Teacher–Judge Pilot Report\n\n` +
    `**Run:** \`${runId}\`  \n` +
    `**Teacher:** \`${GEMINI_TEACHER_MODEL_ID}\`  \n` +
    `**Frozen Judge:** \`${frozenConfig.selectedModel.modelId}\`  \n` +
    `**Pairs:** ${pairRecords.length}\n\n` +
    `## Checkpoint result\n\n` +
    `- Positive candidates (Grade ≥ 2 after mechanical generation filters): ` +
    `${positiveCandidates.length}/${pairRecords.length} (${(metrics.acceptance.acceptanceRate * 100).toFixed(1)}%).\n` +
    `- Grade 1 uncertain/review: ${uncertain.length}.\n` +
    `- Rejected candidates or validation failures: ${rejected.length}.\n` +
    `- Invalid Judge outputs excluded without inferred grades: ${invalidJudgeOutputs.length}.\n` +
    `- Frozen Judge score distribution: ${JSON.stringify(metrics.scoreDistribution)}.\n` +
    `- No rejected pair was promoted to a hard negative. No training was started.\n\n` +
    `## Diversity and coverage\n\n` +
    `- Languages: ${JSON.stringify(metrics.queryDiversity.languageDistribution)}.\n` +
    `- Coverage categories: ${JSON.stringify(metrics.queryDiversity.coverageCategoryDistribution)}.\n` +
    `- Topics: ${metrics.semanticCoverage.topicsCovered}/10; source songs: ` +
    `${metrics.semanticCoverage.sourceSongsCovered}; source sections: ${metrics.semanticCoverage.sourceSectionsCovered}.\n` +
    `- Exact/near generated duplicates: ${metrics.queryDiversity.duplicateCount}; ` +
    `mean pairwise word Jaccard: ${metrics.queryDiversity.meanPairwiseWordJaccard?.toFixed(4)}.\n\n` +
    `## Validation and risk\n\n` +
    `- Mechanical generation pass: ${metrics.validation.mechanicalGenerationPass}/${pairRecords.length}.\n` +
    `- Judge schema pass: ${metrics.validation.judgeSchemaPass}/${pairRecords.length}; ` +
    `invalid outputs: ${metrics.validation.judgeSchemaFailure}.\n` +
    `- Protected-query leakage rejected: ${metrics.validation.leakageRejected}; ` +
    `held-out vocabulary requiring human review: ${metrics.validation.leakageHumanReview}.\n` +
    `- Copied lyric spans (4+ normalized words): ${metrics.validation.copiedLyricSpan}; ` +
    `title/artist leakage: ${metrics.validation.titleOrArtistLeak}.\n` +
    `- Evidence verbatim valid where supplied: ${metrics.validation.evidenceVerbatimValid}.\n` +
    `- Automated false-acceptance flags: ${metrics.riskIndicators.automatedFalseAcceptanceFlags}; ` +
    `${metrics.riskIndicators.positiveCandidatesPendingHumanContextAndTheologyAudit} positive candidates ` +
    `remain exposed to unmeasured contextual/theological false-acceptance risk until human audit.\n` +
    `- False-rejection screening flags: ${metrics.riskIndicators.falseRejectionRisk}; ` +
    `validation rejects requiring human review: ` +
    `${metrics.riskIndicators.validationRejectedQueriesRequiringHumanAudit}.\n` +
    `- Contextual evidence support and theological consistency remain pending human audit for the ` +
    `checkpoint workbook. Positive candidates are not training-ready until those fields are reviewed.\n\n` +
    `## Leakage and provenance\n\n` +
    `- All six anchor songs and all 42 Human Reference source sections were excluded.\n` +
    `- The Teacher received no development, Human Reference, diagnostic T11–T16, or held-out query text.\n` +
    `- The local leakage audit compared generated queries against 90 benchmark queries plus 50 Human Reference queries.\n` +
    `- No frozen external held-out query artifact was present; no replacement data was invented.\n\n` +
    `## Limitations\n\n` +
    `This pilot contains 50 source-linked pairs, not an independently sampled gold test set. Judge score is ` +
    `a filtering signal, not human ground truth. Risk counts are screening indicators. They do not estimate ` +
    `population-level error rates. Human review is required before expansion or fine-tuning.\n`;
  fs.writeFileSync(path.join(outputDirectory, 'teacher_judge_pilot_report.md'), report, 'utf8');

  fs.rmSync(teacherPartialPath, { force: true });
  fs.rmSync(judgePartialPath, { force: true });
  fs.rmSync(path.join(outputDirectory, 'failure.json'), { force: true });
  writeJson('run_manifest.json', {
    ...completedManifestBase,
    status: 'checkpoint_complete_pending_human_audit',
    completedAtUtc: new Date().toISOString(),
    completedPairs: pairRecords.length,
    outputs: {
      teacherRaw: 'gemini_teacher_raw.json',
      judgeRaw: 'qwen_judge_raw.json',
      pairs: 'pilot_pairs.jsonl',
      metrics: 'pilot_metrics.json',
      executionLog: 'execution_log.jsonl',
      humanAuditCsv: 'human_audit.csv',
      report: 'teacher_judge_pilot_report.md',
    },
    trainingStarted: false,
  });
  console.log(JSON.stringify({ status: 'CHECKPOINT_COMPLETE', runId, outputDirectory, metrics }, null, 2));
}

main().catch((error: unknown) => {
  if (fs.existsSync(outputDirectory)) {
    writeJson('failure.json', {
      status: 'FAILED',
      failedAtUtc: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
    });
  }
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
