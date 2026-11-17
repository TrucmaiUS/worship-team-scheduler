import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseCsv } from '../lib/research/e5-distillation/corpus';
import { validateEvidence } from '../lib/research/e5-distillation/evidence';
import type { RelevanceScore } from '../lib/research/e5-distillation/types';

const EXPECTED_COUNTS = [17, 9, 8, 16] as const;
const SOURCE_LABELS = ['Not Relevant', 'Slightly Relevant', 'Relevant', 'Highly Relevant'] as const;
const REQUIRED_PROVENANCE_COLUMNS = [
  'reviewer_1_id',
  'reviewer_2_id',
  'adjudicator_id',
  'source_section_id',
  'language_bucket',
  'difficult_theological_distinction',
  'distinction_tag',
] as const;

function option(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? path.resolve(process.argv[index + 1]) : null;
}

function parseScore(value: string, field: string, pairId: string): RelevanceScore {
  const score = Number(value);
  if (![0, 1, 2, 3].includes(score)) throw new Error(`${pairId}: invalid ${field}.`);
  return score as RelevanceScore;
}

function parseQuotes(value: string, field: string, pairId: string): string[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.some(item => typeof item !== 'string')) {
    throw new Error(`${pairId}: ${field} must be a JSON string array.`);
  }
  return parsed as string[];
}

const inputPath = option('--input') ?? path.resolve(
  'benchmark/distillation/human_reference/human_reference_v1.csv'
);
const outputPath = option('--out');
const bytes = fs.readFileSync(inputPath);
const rows = parseCsv(bytes.toString('utf8').replace(/^\uFEFF/u, ''));
const headers = rows[0] ? Object.keys(rows[0]) : [];
const errors: string[] = [];
const warnings: string[] = [];
const pairIds = new Set<string>();
const gradeCounts = [0, 0, 0, 0];

for (const row of rows) {
  const pairId = row.pair_id || '<missing-pair-id>';
  if (pairIds.has(pairId)) errors.push(`${pairId}: duplicate pair_id.`);
  pairIds.add(pairId);
  try {
    const finalScore = parseScore(row.relevance_score, 'relevance_score', pairId);
    gradeCounts[finalScore] += 1;
    if (row.relevance_label !== SOURCE_LABELS[finalScore]) {
      errors.push(`${pairId}: relevance_label does not match the frozen source vocabulary.`);
    }
    const finalQuotes = parseQuotes(row.evidence_quotes, 'evidence_quotes', pairId);
    const finalEvidence = validateEvidence(row.section_lyrics, finalQuotes, finalScore);
    if (finalEvidence.status === 'invalid') {
      errors.push(`${pairId}: invalid final evidence (${finalEvidence.reasons.join(',')}).`);
    }

    const firstScore = parseScore(row.reviewer_1_score, 'reviewer_1_score', pairId);
    const secondScore = parseScore(row.reviewer_2_score, 'reviewer_2_score', pairId);
    const firstEvidence = validateEvidence(row.section_lyrics,
      parseQuotes(row.reviewer_1_evidence_quotes, 'reviewer_1_evidence_quotes', pairId), firstScore);
    const secondEvidence = validateEvidence(row.section_lyrics,
      parseQuotes(row.reviewer_2_evidence_quotes, 'reviewer_2_evidence_quotes', pairId), secondScore);
    if (firstEvidence.status === 'invalid') {
      errors.push(`${pairId}: invalid reviewer 1 evidence (${firstEvidence.reasons.join(',')}).`);
    }
    if (secondEvidence.status === 'invalid') {
      errors.push(`${pairId}: invalid reviewer 2 evidence (${secondEvidence.reasons.join(',')}).`);
    }
    const difference = Math.abs(firstScore - secondScore);
    if (Number(row.absolute_reviewer_grade_difference) !== difference) {
      errors.push(`${pairId}: absolute reviewer grade difference mismatch.`);
    }
    if (difference === 0) {
      if (row.label_source !== 'reviewer_agreement' || finalScore !== firstScore) {
        errors.push(`${pairId}: reviewer agreement does not reproduce the final label.`);
      }
    } else {
      if (row.label_source !== 'third_party_adjudication') {
        errors.push(`${pairId}: disagreement must retain third_party_adjudication provenance.`);
      }
      const adjudicatedScore = parseScore(row.adjudicator_final_grade,
        'adjudicator_final_grade', pairId);
      if (adjudicatedScore !== finalScore) {
        errors.push(`${pairId}: adjudicator grade does not reproduce the final label.`);
      }
      const adjudicatorEvidence = validateEvidence(row.section_lyrics,
        parseQuotes(row.adjudicator_evidence_quotes, 'adjudicator_evidence_quotes', pairId),
        adjudicatedScore);
      if (adjudicatorEvidence.status === 'invalid') {
        errors.push(`${pairId}: invalid adjudicator evidence (${adjudicatorEvidence.reasons.join(',')}).`);
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : `${pairId}: unknown validation failure.`);
  }
}

if (rows.length !== 50) errors.push(`Expected exactly 50 pairs; found ${rows.length}.`);
if (pairIds.size !== rows.length) errors.push('Pair IDs are not unique.');
if (gradeCounts.some((count, grade) => count !== EXPECTED_COUNTS[grade])) {
  errors.push(`Grade distribution must remain ${EXPECTED_COUNTS.join('/')}; found ${gradeCounts.join('/')}.`);
}
const missingProvenanceColumns = REQUIRED_PROVENANCE_COLUMNS.filter(column => !headers.includes(column));
if (missingProvenanceColumns.length > 0) {
  warnings.push(`Missing provenance columns (not inferred): ${missingProvenanceColumns.join(', ')}.`);
}
warnings.push('Human grade 1 uses source label "Slightly Relevant"; model output rubric uses "Partially Relevant".');

const report = {
  schemaVersion: 'human-reference-validation-v1',
  status: errors.length === 0 && missingProvenanceColumns.length === 0 ? 'PASS' : 'BLOCKED',
  source: {
    path: path.relative(process.cwd(), inputPath).replaceAll('\\', '/'),
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    rows: rows.length,
  },
  frozenHumanLabels: true,
  gradeDistribution: gradeCounts,
  expectedGradeDistribution: EXPECTED_COUNTS,
  minimumPerGrade: 8,
  uniquePairIds: pairIds.size,
  missingProvenanceColumns,
  errors,
  warnings,
};

const serialized = `${JSON.stringify(report, null, 2)}\n`;
if (outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, serialized, { encoding: 'utf8', flag: 'wx' });
}
console.log(serialized.trimEnd());
if (report.status !== 'PASS') process.exitCode = 2;
