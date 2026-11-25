import { describe, expect, it } from 'vitest';
import { buildCandidatePool } from '../candidate-pool';
import { mapFtsRows } from '../fts-candidates';
import { buildBlindLabelRequest, validateBlindLabelResponse, validateGenerationResponse } from '../request-contracts';
import type { CorpusSnapshot } from '../corpus';

const snapshot: CorpusSnapshot = {
  sha256: 'fixture', anchorSongIds: ['ANCHOR'], songs: [],
  eligibleSongs: [
    { songId: 'A', title: 'A', artist: '', sections: [
      { sectionId: 'A1', songId: 'A', sectionType: 'verse', sectionLabel: 'Verse',
        lyrics: 'Grace', passageText: 'Song: A\nSection: [Verse]\nGrace' },
    ] },
    { songId: 'B', title: 'B', artist: '', sections: [
      { sectionId: 'B1', songId: 'B', sectionType: 'chorus', sectionLabel: 'Chorus',
        lyrics: 'Hope', passageText: 'Song: B\nSection: [Chorus]\nHope' },
    ] },
  ],
};

describe('Phase 2 FTS mapping', () => {
  it('drops anchors and title-only hits and passes strict section IDs into the pool', () => {
    const mapped = mapFtsRows(snapshot, [
      { song_id: 'ANCHOR', section_id: 'X1' },
      { song_id: 'A', section_id: null },
      { song_id: 'B', section_id: 'B1' },
    ]);
    expect(mapped).toEqual({ sectionIds: ['B1'], anchorHits: 1, titleOnlyHits: 1 });
    const pool = buildCandidatePool(snapshot, {
      queryId: 'Q', queryText: 'Hope', sourceSectionId: 'A1', lexicalDepth: 0,
      ftsSectionIds: mapped.sectionIds, e5Depth: 0, controlCount: 0,
      e5Scores: new Map([['A1', 0.1], ['B1', 0.2]]), seed: 'fixed',
    });
    expect(pool).toHaveLength(2);
    expect(pool.find(candidate => candidate.sectionId === 'B1')?.sources).toEqual(['fts']);
  });

  it('fails on a database section absent from the frozen corpus', () => {
    expect(() => mapFtsRows(snapshot, [{ song_id: 'B', section_id: 'MISSING' }]))
      .toThrow(/absent from the frozen eligible corpus/);
  });
});

describe('Phase 2 provider payload contracts', () => {
  const generationRequest = {
    allowed_topic: { topic_id: 'T01', title: 'Spirit power', description: '' },
    source_sections: [{ section_alias: 'SOURCE_A', lyrics: 'Grace and hope' }],
    target_language: 'vi', query_style: 'natural_thematic_request', requested_count: 1,
  };
  const generationResponse = {
    queries: [{ query_text: 'Bài ca về niềm hy vọng', language: 'vi',
      query_type: 'thematic', source_section_aliases: ['SOURCE_A'],
      brief_intent_summary: 'Hope', contains_title_or_artist: false,
      contains_verbatim_lyric_span: false, possible_held_out_intent: false }],
  };

  it('rejects held-out source topics, unknown aliases and self-flagged leakage', () => {
    expect(validateGenerationResponse(generationRequest, generationResponse).queries).toHaveLength(1);
    expect(() => validateGenerationResponse({ ...generationRequest,
      allowed_topic: { ...generationRequest.allowed_topic, topic_id: 'T11' } },
    generationResponse)).toThrow();
    expect(() => validateGenerationResponse(generationRequest, { queries: [{
      ...generationResponse.queries[0], source_section_aliases: ['UNKNOWN'],
    }] })).toThrow(/boundary/);
    expect(() => validateGenerationResponse(generationRequest, { queries: [{
      ...generationResponse.queries[0], possible_held_out_intent: true,
    }] })).toThrow(/boundary/);
  });

  it('requires blind label alias, rubric label and evidence', () => {
    const candidate = { alias: 'CANDIDATE_001', songId: 'A', sectionId: 'A1',
      sectionType: 'verse', lyrics: 'Grace and hope', sources: ['source'] as const };
    const request = buildBlindLabelRequest('Hope', { ...candidate, sources: ['source'] });
    expect(JSON.stringify(request)).not.toContain('songId');
    const response = { candidate_alias: 'CANDIDATE_001', relevance_score: 3,
      relevance_label: 'Highly Relevant', evidence_quotes: ['Grace and hope'],
      reasoning_summary: 'Directly addresses hope.', is_lexical_overlap_only: false };
    expect(validateBlindLabelResponse(request, response).relevance_score).toBe(3);
    expect(() => validateBlindLabelResponse(request, {
      ...response, candidate_alias: 'CANDIDATE_002',
    })).toThrow(/alias mismatch/);
    expect(() => validateBlindLabelResponse(request, {
      ...response, evidence_quotes: [],
    })).toThrow();
    expect(validateBlindLabelResponse(request, {
      ...response, evidence_quotes: ['Grace', 'hope'],
    }).evidence_quotes).toEqual(['Grace', 'hope']);
    expect(() => validateBlindLabelResponse(request, {
      ...response, evidence_quotes: ['Grace...hope'],
    })).toThrow(/ellipsis or slash/);
    expect(() => validateBlindLabelResponse(request, {
      ...response, evidence_quotes: ['Grace / hope'],
    })).toThrow(/ellipsis or slash/);
    expect(() => validateBlindLabelResponse(request, {
      ...response, relevance_score: 0, relevance_label: 'Not Relevant',
    })).toThrow(/empty evidence array/);
  });
});
