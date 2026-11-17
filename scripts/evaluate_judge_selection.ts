import fs from 'node:fs';
import path from 'node:path';
import {
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
function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const referencesPath = argument('--references');
const gptOssPath = argument('--gpt-oss');
const qwenPath = argument('--qwen');
const outputPath = argument('--out');
if (fs.existsSync(outputPath)) throw new Error(`Refusing to overwrite existing report: ${outputPath}`);

const root = path.resolve(__dirname, '..');
const queryRows = parseCsv(fs.readFileSync(path.join(root, 'benchmark/data/queries.csv'), 'utf8'));
const developmentQueries = new Map(queryRows.map(row => [row.query_id, {
  topicId: row.topic_id || null,
  queryText: row.query_text,
}]));
const corpus = loadCorpus(path.join(root, 'benchmark/data/songs.csv'));
const corpusSections = new Map(corpus.songs.flatMap(song => song.sections.map(section => [
  section.sectionId,
  { sectionType: section.sectionType, lyrics: section.lyrics },
] as const)));
const sourceIndex = { developmentQueries, corpusSections };
const references = readJson(referencesPath);
const gptOss = evaluateJudgeCandidate(references, readJson(gptOssPath), sourceIndex);
const qwen = evaluateJudgeCandidate(references, readJson(qwenPath), sourceIndex);
const comparison = compareJudgeCandidates(gptOss, qwen);
const report = {
  schemaVersion: 'judge-selection-report-v1',
  createdAtUtc: new Date().toISOString(),
  criteria: JUDGE_SELECTION_CRITERIA,
  referencesPath,
  candidates: [gptOss, qwen],
  comparison,
};
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
console.log(JSON.stringify(report, null, 2));
