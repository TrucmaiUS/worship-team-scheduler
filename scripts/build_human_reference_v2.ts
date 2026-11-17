import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseCsv } from '../lib/research/e5-distillation/corpus';

const ROOT = path.resolve('benchmark/distillation/human_reference');
const V1_PATH = path.join(ROOT, 'human_reference_v1.csv');
const V2_PATH = path.join(ROOT, 'human_reference_v2.csv');
const QUERY_MANIFEST_PATH = path.join(ROOT, 'query_manifest_v2.csv');
const REVIEW_PATH = path.join(ROOT, 'difficult_distinction_review_v1.csv');
const REVIEWER_MANIFEST_PATH = path.join(ROOT, 'reviewer_manifest_v1.json');
const V2_MANIFEST_PATH = path.join(ROOT, 'human_reference_v2_manifest.json');
const QUERY_PATH = path.resolve('benchmark/data/queries.csv');
const SONG_PATH = path.resolve('benchmark/data/songs.csv');
const P006_SECTION_ID = 'd0cfa7d0-e895-4834-b7b5-adf4ef350c3d';

type CsvRow = Record<string, string>;

interface CorpusSection {
  section_id: string;
  lyrics_text: string;
}

function sha256(bytes: Buffer | string): string {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function normalizeSerializedText(value: string): string {
  return value.replace(/\r\n?/gu, '\n').replace(/[\t ]+$/gmu, '');
}

function csvEscape(value: string): string {
  const normalized = normalizeSerializedText(value);
  return /[",\n]/u.test(normalized) ? `"${normalized.replaceAll('"', '""')}"` : normalized;
}

function serializeCsv(rows: readonly CsvRow[], headers: readonly string[]): string {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) lines.push(headers.map(header => csvEscape(row[header] ?? '')).join(','));
  return `${lines.join('\n')}\n`;
}

function writeOrVerify(filePath: string, content: string): void {
  if (fs.existsSync(filePath)) {
    const current = fs.readFileSync(filePath, 'utf8');
    if (current !== content) throw new Error(`Refusing to overwrite non-matching artifact: ${filePath}`);
    return;
  }
  fs.writeFileSync(filePath, content, { encoding: 'utf8', flag: 'wx' });
}

function jsonArray(value: string, field: string, pairId: string): string[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.some(item => typeof item !== 'string')) {
    throw new Error(`${pairId}: ${field} must be a JSON string array.`);
  }
  return parsed as string[];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function restoreVerbatimSpan(section: string, quote: string, field: string, pairId: string): string {
  if (section.includes(quote)) return quote;
  const tokens = quote.trim().split(/\s+/u).filter(Boolean);
  if (tokens.length === 0) return quote;
  const expression = new RegExp(tokens.map(escapeRegExp).join('\\s+'), 'gu');
  const matches = [...section.matchAll(expression)].map(match => match[0]);
  if (matches.length !== 1) {
    throw new Error(`${pairId}: cannot restore ${field} uniquely (${matches.length} matches).`);
  }
  return matches[0];
}

function correctEvidence(row: CsvRow, field: string, corrections: string[]): void {
  const quotes = jsonArray(row[field], field, row.pair_id);
  const corrected = quotes.map(quote => restoreVerbatimSpan(
    row.section_lyrics, quote, field, row.pair_id
  ));
  if (corrected.some((quote, index) => quote !== quotes[index])) corrections.push(field);
  row[field] = JSON.stringify(corrected);
}

function workbookRecord(fileName: string, role: string) {
  const filePath = path.join(ROOT, 'source_annotations', fileName);
  const bytes = fs.readFileSync(filePath);
  return {
    role,
    pseudonymousId: role,
    path: path.relative(process.cwd(), filePath).replaceAll('\\', '/'),
    sha256: sha256(bytes),
    bytes: bytes.length,
  };
}

const v1Bytes = fs.readFileSync(V1_PATH);
const v1Rows = parseCsv(v1Bytes.toString('utf8').replace(/^\uFEFF/u, ''));
if (v1Rows.length !== 50) throw new Error(`Expected 50 v1 rows; found ${v1Rows.length}.`);
const originalHeaders = Object.keys(v1Rows[0]);

const queryRows = parseCsv(fs.readFileSync(QUERY_PATH, 'utf8'));
const queriesById = new Map(queryRows.map(row => [row.query_id, row]));

const songRows = parseCsv(fs.readFileSync(SONG_PATH, 'utf8'));
const sections: CorpusSection[] = songRows.flatMap(song => {
  const parsed: unknown = JSON.parse(song.lyrics_sections_json);
  if (!Array.isArray(parsed)) throw new Error(`${song.song_id}: lyrics_sections_json is not an array.`);
  return parsed.map(value => {
    const section = value as Partial<CorpusSection>;
    if (!section.section_id || typeof section.lyrics_text !== 'string') {
      throw new Error(`${song.song_id}: invalid section record.`);
    }
    return { section_id: section.section_id, lyrics_text: section.lyrics_text };
  });
});
const sectionsById = new Map(sections.map(section => [section.section_id, section]));

const queryManifestById = new Map<string, CsvRow>();
const correctionPairs = new Set<string>();
const queryProvenanceCounts: Record<string, number> = {};
const sectionProvenanceCounts: Record<string, number> = {};
const languageStratumCounts: Record<string, number> = {};

const v2Rows = v1Rows.map<CsvRow>(source => {
  const row: CsvRow = { ...source };
  const benchmarkQuery = queriesById.get(row.source_query_id);
  if (!benchmarkQuery) throw new Error(`${row.pair_id}: unknown source_query_id ${row.source_query_id}.`);

  const exactBenchmarkQuery = benchmarkQuery.query_text === row.query;
  const referenceQueryId = exactBenchmarkQuery
    ? row.source_query_id
    : `HRV2-${row.source_query_id}-PARAPHRASE-V1`;
  const queryProvenance = exactBenchmarkQuery
    ? 'exact_benchmark_query'
    : 'human_reference_paraphrase_v1';
  queryProvenanceCounts[queryProvenance] = (queryProvenanceCounts[queryProvenance] ?? 0) + 1;

  const existingQuery = queryManifestById.get(referenceQueryId);
  const queryManifestRow: CsvRow = {
    reference_query_id: referenceQueryId,
    original_source_query_id: row.source_query_id,
    query_text: row.query,
    query_text_provenance: queryProvenance,
    query_group: row.query_group,
    input_language: row.input_language,
    source_topic_id: row.source_topic_id,
  };
  if (existingQuery && JSON.stringify(existingQuery) !== JSON.stringify(queryManifestRow)) {
    throw new Error(`${row.pair_id}: reference query ID maps to inconsistent text.`);
  }
  queryManifestById.set(referenceQueryId, queryManifestRow);

  const exactSectionMatches = sections.filter(section => section.lyrics_text === row.section_lyrics);
  let sourceSectionId: string;
  let candidateProvenance: string;
  if (exactSectionMatches.length === 1) {
    sourceSectionId = exactSectionMatches[0].section_id;
    candidateProvenance = 'exact_corpus_section';
  } else if (row.pair_id === 'P006') {
    const section = sectionsById.get(P006_SECTION_ID);
    if (!section) throw new Error('P006 override section is missing from the corpus.');
    sourceSectionId = P006_SECTION_ID;
    candidateProvenance = 'versioned_text_correction_v1';
  } else {
    throw new Error(`${row.pair_id}: expected one exact corpus section; found ${exactSectionMatches.length}.`);
  }
  sectionProvenanceCounts[candidateProvenance] =
    (sectionProvenanceCounts[candidateProvenance] ?? 0) + 1;

  const languageStratum = row.query_group === 'G2'
    ? 'en_query_vi_lyrics'
    : row.query_group === 'G4'
      ? 'vi_query_vi_lyrics'
      : (() => { throw new Error(`${row.pair_id}: unsupported query group ${row.query_group}.`); })();
  languageStratumCounts[languageStratum] = (languageStratumCounts[languageStratum] ?? 0) + 1;

  row.section_lyrics = normalizeSerializedText(row.section_lyrics);
  const corrections: string[] = [];
  for (const field of [
    'evidence_quotes',
    'reviewer_1_evidence_quotes',
    'reviewer_2_evidence_quotes',
    'adjudicator_evidence_quotes',
  ]) correctEvidence(row, field, corrections);
  if (corrections.length > 0) correctionPairs.add(row.pair_id);

  return {
    schema_version: 'human-reference-v2',
    reviewer_1_id: 'reviewer_1',
    reviewer_2_id: 'reviewer_2',
    adjudicator_id: row.label_source === 'third_party_adjudication' ? 'adjudicator_1' : '',
    original_source_query_id: row.source_query_id,
    reference_query_id: referenceQueryId,
    query_text_provenance: queryProvenance,
    source_section_id: sourceSectionId,
    candidate_text_provenance: candidateProvenance,
    evaluation_language_stratum: languageStratum,
    difficult_theological_distinction: '',
    distinction_tag: '',
    evidence_correction_notes: corrections.length > 0
      ? `Whitespace-only verbatim restoration: ${corrections.join(', ')}`
      : '',
    ...row,
  };
});

const addedHeaders = [
  'schema_version',
  'reviewer_1_id',
  'reviewer_2_id',
  'adjudicator_id',
  'original_source_query_id',
  'reference_query_id',
  'query_text_provenance',
  'source_section_id',
  'candidate_text_provenance',
  'evaluation_language_stratum',
  'difficult_theological_distinction',
  'distinction_tag',
  'evidence_correction_notes',
] as const;
const v2Csv = serializeCsv(v2Rows, [...addedHeaders, ...originalHeaders]);

const queryManifestRows = [...queryManifestById.values()].sort((a, b) =>
  a.reference_query_id.localeCompare(b.reference_query_id)
);
const queryManifestCsv = serializeCsv(queryManifestRows, [
  'reference_query_id',
  'original_source_query_id',
  'query_text',
  'query_text_provenance',
  'query_group',
  'input_language',
  'source_topic_id',
]);

const reviewRows = v2Rows.map(row => ({
  pair_id: row.pair_id,
  query: row.query,
  section_type: row.section_type,
  relevance_score: row.relevance_score,
  query_difficulty: row.query_difficulty,
  difficult_theological_distinction: '',
  distinction_tag: '',
  reviewer_notes: '',
}));
const reviewCsv = serializeCsv(reviewRows, [
  'pair_id',
  'query',
  'section_type',
  'relevance_score',
  'query_difficulty',
  'difficult_theological_distinction',
  'distinction_tag',
  'reviewer_notes',
]);

const reviewerManifest = {
  schemaVersion: 'reviewer-manifest-v1',
  independence: {
    confirmed: true,
    participantCount: 3,
    roles: ['reviewer_1', 'reviewer_2', 'adjudicator_1'],
    confirmationDate: '2026-11-17',
    confirmationSource: 'User confirmation in Codex chat',
    personalIdentitiesStored: false,
  },
  sourceFiles: [
    workbookRecord('reviewer_1.xlsx', 'reviewer_1'),
    workbookRecord('reviewer_2.xlsx', 'reviewer_2'),
    workbookRecord('human_adjudication_21_pairs_v1.xlsx', 'adjudicator_1'),
  ],
};
const reviewerManifestJson = `${JSON.stringify(reviewerManifest, null, 2)}\n`;

const gradeDistribution = [0, 1, 2, 3].map(grade =>
  v2Rows.filter(row => Number(row.relevance_score) === grade).length
);
if (gradeDistribution.join('/') !== '17/9/8/16') {
  throw new Error(`Human labels changed: found ${gradeDistribution.join('/')}.`);
}
for (let index = 0; index < v1Rows.length; index += 1) {
  if (v1Rows[index].pair_id !== v2Rows[index].pair_id ||
      v1Rows[index].relevance_score !== v2Rows[index].relevance_score) {
    throw new Error(`Human label changed at row ${index + 1}.`);
  }
}

const v2Manifest = {
  schemaVersion: 'human-reference-v2-manifest',
  status: 'AWAITING_THEOLOGICAL_METADATA',
  frozenHumanLabels: true,
  source: {
    path: path.relative(process.cwd(), V1_PATH).replaceAll('\\', '/'),
    sha256: sha256(v1Bytes),
  },
  reviewerManifest: {
    path: path.relative(process.cwd(), REVIEWER_MANIFEST_PATH).replaceAll('\\', '/'),
    sha256: sha256(reviewerManifestJson),
  },
  output: {
    path: path.relative(process.cwd(), V2_PATH).replaceAll('\\', '/'),
    sha256: sha256(v2Csv),
    rows: v2Rows.length,
  },
  queryManifest: {
    path: path.relative(process.cwd(), QUERY_MANIFEST_PATH).replaceAll('\\', '/'),
    sha256: sha256(queryManifestCsv),
    uniqueQueries: queryManifestRows.length,
  },
  humanReviewChecklist: {
    path: path.relative(process.cwd(), REVIEW_PATH).replaceAll('\\', '/'),
    sha256: sha256(reviewCsv),
    unresolvedRows: reviewRows.length,
  },
  gradeDistribution,
  evidenceCorrections: {
    method: 'whitespace-only restoration to one unique contiguous span in section_lyrics',
    pairIds: [...correctionPairs].sort(),
  },
  queryTextProvenance: queryProvenanceCounts,
  candidateTextProvenance: sectionProvenanceCounts,
  evaluationLanguageStrata: languageStratumCounts,
  serializationNormalization: 'LF line endings and removal of trailing horizontal whitespace',
  generatedBy: 'scripts/build_human_reference_v2.ts',
};
const v2ManifestJson = `${JSON.stringify(v2Manifest, null, 2)}\n`;

writeOrVerify(V2_PATH, v2Csv);
writeOrVerify(QUERY_MANIFEST_PATH, queryManifestCsv);
writeOrVerify(REVIEW_PATH, reviewCsv);
writeOrVerify(REVIEWER_MANIFEST_PATH, reviewerManifestJson);
writeOrVerify(V2_MANIFEST_PATH, v2ManifestJson);

console.log(JSON.stringify({
  output: path.relative(process.cwd(), V2_PATH).replaceAll('\\', '/'),
  rows: v2Rows.length,
  gradeDistribution,
  evidenceCorrectionPairs: [...correctionPairs].sort(),
  uniqueQueries: queryManifestRows.length,
  status: v2Manifest.status,
}, null, 2));
