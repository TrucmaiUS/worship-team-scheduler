import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCsv } from '../corpus';
import { validateEvidence } from '../evidence';
import type { RelevanceScore } from '../types';

const ROOT = path.resolve('benchmark/distillation/human_reference');

function rows(fileName: string) {
  return parseCsv(fs.readFileSync(path.join(ROOT, fileName), 'utf8').replace(/^\uFEFF/u, ''));
}

describe('Human Reference v2 artifact', () => {
  const v1 = rows('human_reference_v1.csv');
  const v2 = rows('human_reference_v2.csv');

  it('preserves all 50 human labels and the frozen grade distribution', () => {
    expect(v2).toHaveLength(50);
    expect(v2.map(row => [row.pair_id, row.relevance_score]))
      .toEqual(v1.map(row => [row.pair_id, row.relevance_score]));
    expect([0, 1, 2, 3].map(grade =>
      v2.filter(row => Number(row.relevance_score) === grade).length
    )).toEqual([17, 9, 8, 16]);
  });

  it('records reviewer, query, section, and language provenance', () => {
    for (const row of v2) {
      expect(row.schema_version).toBe('human-reference-v2');
      expect(row.reviewer_1_id).toBe('reviewer_1');
      expect(row.reviewer_2_id).toBe('reviewer_2');
      expect(row.reference_query_id).not.toBe('');
      expect(row.source_section_id).not.toBe('');
      expect(['en_query_vi_lyrics', 'vi_query_vi_lyrics'])
        .toContain(row.evaluation_language_stratum);
    }
  });

  it('uses valid contiguous verbatim evidence arrays', () => {
    for (const row of v2) {
      const fields: Array<readonly [string, string]> = [
        ['evidence_quotes', 'relevance_score'],
        ['reviewer_1_evidence_quotes', 'reviewer_1_score'],
        ['reviewer_2_evidence_quotes', 'reviewer_2_score'],
      ];
      if (row.label_source === 'third_party_adjudication') {
        fields.push(['adjudicator_evidence_quotes', 'adjudicator_final_grade']);
      }
      for (const [quoteField, scoreField] of fields) {
        const result = validateEvidence(
          row.section_lyrics,
          JSON.parse(row[quoteField]) as string[],
          Number(row[scoreField]) as RelevanceScore
        );
        expect(result.status, `${row.pair_id}:${quoteField}`).not.toBe('invalid');
      }
    }
  });

  it('leaves theological-difficulty metadata for human review', () => {
    expect(v2.every(row =>
      row.difficult_theological_distinction === '' && row.distinction_tag === ''
    )).toBe(true);
  });
});
