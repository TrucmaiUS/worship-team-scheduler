import fs from 'fs';
import path from 'path';
import {
  auditQueryLeakage,
  buildConsensusRecord,
  parsePinnedProviderConfig,
  validateEvidence,
} from '../lib/research/e5-distillation';
import type { RelevanceJudgment } from '../lib/research/e5-distillation';

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function toRecords(rows: string[][]): Array<Record<string, string>> {
  const [headers, ...data] = rows;
  if (!headers) return [];
  return data.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? '']))
  );
}

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, observed ${actual}`);
  }
}

function syntheticJudgment(
  role: RelevanceJudgment['role'],
  modelId: string
): RelevanceJudgment {
  return {
    judgmentId: role === 'gemini_teacher' ? 'teacher-self-check' : 'judge-self-check',
    queryId: 'SYN-CHECK-1',
    candidateSongId: 'song-check',
    candidateSectionId: 'section-check',
    role,
    provider: role === 'gemini_teacher' ? 'google' : 'openai',
    modelId,
    promptVersion: 'self-check-v1',
    relevanceScore: 3,
    evidenceQuotes: ['Ngài dẫn con qua đêm tối'],
    reasoningSummary: 'Synthetic offline protocol check.',
    schemaValid: true,
    evidenceStatus: 'valid',
  };
}

function main(): void {
  const projectRoot = path.resolve(__dirname, '..');
  const queries = toRecords(
    parseCsv(fs.readFileSync(path.join(projectRoot, 'benchmark/data/queries.csv'), 'utf8'))
  );
  const topics = toRecords(
    parseCsv(fs.readFileSync(path.join(projectRoot, 'benchmark/data/topics.csv'), 'utf8'))
  );

  const groupCounts = Object.fromEntries(
    ['G1', 'G2', 'G3', 'G4'].map((group) => [
      group,
      queries.filter((query) => query.group === group).length,
    ])
  );
  const diagnosticCount = queries.filter((query) =>
    /^T(11|12|13|14|15|16)$/u.test(query.topic_id)
  ).length;

  assertEqual(queries.length, 90, 'query count');
  assertEqual(groupCounts.G1, 12, 'G1 count');
  assertEqual(groupCounts.G2, 42, 'G2 count');
  assertEqual(groupCounts.G3, 24, 'G3 count');
  assertEqual(groupCounts.G4, 12, 'G4 count');
  assertEqual(topics.length, 16, 'topic count');
  assertEqual(diagnosticCount, 14, 'T11-T16 diagnostic query count');

  const evidence = validateEvidence(
    'Giữa đêm tối Ngài dẫn con qua đêm tối và ban hy vọng',
    ['Ngài dẫn con qua đêm tối'],
    3
  );
  assertEqual(evidence.status, 'valid', 'evidence self-check');

  const consensus = buildConsensusRecord(
    syntheticJudgment('gemini_teacher', 'gemini-self-check'),
    syntheticJudgment('gpt_independent_judge', 'gpt-self-check')
  );
  assertEqual(consensus.automaticTrainingEligible, true, 'consensus self-check');

  const leakage = auditQueryLeakage({
    queryText: 'Khúc ca về niềm hy vọng trong một ngày mới',
    references: [
      {
        id: 'DEV-CHECK',
        text: 'Tìm bài hát nói về tình yêu thương trong cộng đồng',
        scope: 'development',
      },
    ],
    frozenE5CosineByReferenceId: { 'DEV-CHECK': 0.2 },
  });
  assertEqual(leakage.decision, 'passed', 'leakage self-check');

  parsePinnedProviderConfig({
    role: 'gemini_teacher',
    provider: 'google',
    modelId: 'offline-self-check-model',
    promptVersion: 'offline-self-check-v1',
    promptSha256: 'a'.repeat(64),
    allowFallback: false,
    maxAttempts: 1,
    temperature: 0,
  });

  console.log(
    JSON.stringify(
      {
        status: 'PASS',
        network_calls: 0,
        database_writes: 0,
        queries: queries.length,
        groups: groupCounts,
        topics: topics.length,
        diagnostic_queries_t11_t16: diagnosticCount,
        controls: {
          evidence: evidence.status,
          consensus: consensus.confidenceTier,
          leakage: leakage.decision,
          fail_closed_config: 'valid',
        },
      },
      null,
      2
    )
  );
}

main();
