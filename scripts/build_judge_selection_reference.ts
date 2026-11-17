import fs from 'node:fs';
import path from 'node:path';
import { loadCorpus, parseCsv } from '../lib/research/e5-distillation/corpus';
import {
  validateJudgeSelectionSet,
  type JudgeSelectionPair,
} from '../lib/research/e5-distillation/judge-selection';
import type { RelevanceScore } from '../lib/research/e5-distillation/types';

const ROOT = path.resolve('benchmark/distillation/human_reference');
const V2_PATH = path.join(ROOT, 'human_reference_v2.csv');
const QUERY_MANIFEST_PATH = path.join(ROOT, 'query_manifest_v2.csv');
const SONGS_PATH = path.resolve('benchmark/data/songs.csv');
const OUTPUT_PATH = path.join(ROOT, 'judge_selection_reference_v2.json');

function score(value: string, field: string, pairId: string): RelevanceScore {
  const parsed = Number(value);
  if (![0, 1, 2, 3].includes(parsed)) throw new Error(`${pairId}: invalid ${field}.`);
  return parsed as RelevanceScore;
}

function quotes(value: string, field: string, pairId: string): string[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.some(item => typeof item !== 'string')) {
    throw new Error(`${pairId}: ${field} must be a JSON string array.`);
  }
  return parsed as string[];
}

const rows = parseCsv(fs.readFileSync(V2_PATH, 'utf8').replace(/^\uFEFF/u, ''));
const queryRows = parseCsv(fs.readFileSync(QUERY_MANIFEST_PATH, 'utf8').replace(/^\uFEFF/u, ''));
const developmentQueries = new Map(queryRows.map(row => [row.reference_query_id, {
  topicId: row.source_topic_id || null,
  queryText: row.query_text,
}]));
const corpus = loadCorpus(SONGS_PATH);
const corpusSections = new Map(corpus.songs.flatMap(song => song.sections.map(section => [
  section.sectionId,
  { sectionType: section.sectionType, lyrics: section.lyrics },
] as const)));

const pairs: JudgeSelectionPair[] = rows.map((row, index) => {
  const firstScore = score(row.reviewer_1_score, 'reviewer_1_score', row.pair_id);
  const secondScore = score(row.reviewer_2_score, 'reviewer_2_score', row.pair_id);
  const disagreement = firstScore !== secondScore;
  return {
    pairId: row.pair_id,
    sourceQueryId: row.reference_query_id,
    originalSourceQueryId: row.original_source_query_id,
    sourceTopicId: row.source_topic_id || null,
    split: 'development_only',
    languageStratum: row.evaluation_language_stratum as JudgeSelectionPair['languageStratum'],
    difficultTheologicalDistinction: row.difficult_theological_distinction,
    distinctionTag: row.distinction_tag,
    queryText: row.query,
    candidate: {
      sourceSectionId: row.source_section_id,
      candidateAlias: `CANDIDATE_${String(index + 1).padStart(3, '0')}`,
      sectionType: row.section_type,
      lyrics: row.section_lyrics,
      textProvenance: row.candidate_text_provenance as
        JudgeSelectionPair['candidate']['textProvenance'],
    },
    humanReference: {
      initialReviews: [
        {
          reviewerId: row.reviewer_1_id,
          relevanceScore: firstScore,
          evidenceQuotes: quotes(row.reviewer_1_evidence_quotes,
            'reviewer_1_evidence_quotes', row.pair_id),
          rationale: row.reviewer_1_rationale,
        },
        {
          reviewerId: row.reviewer_2_id,
          relevanceScore: secondScore,
          evidenceQuotes: quotes(row.reviewer_2_evidence_quotes,
            'reviewer_2_evidence_quotes', row.pair_id),
          rationale: row.reviewer_2_rationale,
        },
      ],
      adjudication: disagreement ? {
        reviewerId: row.adjudicator_id,
        relevanceScore: score(row.adjudicator_final_grade,
          'adjudicator_final_grade', row.pair_id),
        evidenceQuotes: quotes(row.adjudicator_evidence_quotes,
          'adjudicator_evidence_quotes', row.pair_id),
        rationale: row.adjudicator_rationale,
      } : null,
      evidenceContextNotes: row.theological_metadata_reviewer_notes || null,
    },
  };
});

const validated = validateJudgeSelectionSet(pairs, { developmentQueries, corpusSections });
const serialized = `${JSON.stringify(validated, null, 2)}\n`;
if (fs.existsSync(OUTPUT_PATH)) {
  const current = fs.readFileSync(OUTPUT_PATH, 'utf8');
  if (current !== serialized) throw new Error(`Refusing to overwrite non-matching artifact: ${OUTPUT_PATH}`);
} else {
  fs.writeFileSync(OUTPUT_PATH, serialized, { encoding: 'utf8', flag: 'wx' });
}
console.log(JSON.stringify({
  output: path.relative(process.cwd(), OUTPUT_PATH).replaceAll('\\', '/'),
  pairs: validated.length,
  languageStrata: Object.fromEntries([...new Set(validated.map(pair => pair.languageStratum))]
    .map(stratum => [stratum, validated.filter(pair => pair.languageStratum === stratum).length])),
  distinctionTags: new Set(validated.map(pair => pair.distinctionTag)).size,
}, null, 2));
