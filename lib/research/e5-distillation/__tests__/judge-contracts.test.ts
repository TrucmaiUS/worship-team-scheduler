import { describe, expect, it } from 'vitest';
import { buildBlindLabelRequest, validateBlindLabelResponse } from '../request-contracts';

describe('Judge evidence response contract', () => {
  const candidate = {
    alias: 'CANDIDATE_001',
    songId: 'song-a',
    sectionId: 'section-a',
    sectionType: 'verse',
    lyrics: 'Grace and hope remain',
    sources: ['source'] as Array<'source'>,
  };
  const request = buildBlindLabelRequest('Hope', candidate);
  const response = {
    candidate_alias: 'CANDIDATE_001',
    relevance_score: 3 as const,
    relevance_label: 'Highly Relevant' as const,
    evidence_quotes: ['Grace and hope remain'],
    reasoning_summary: 'The section directly expresses enduring hope.',
    is_lexical_overlap_only: false,
  };

  it('keeps internal identifiers out of the blind request', () => {
    expect(JSON.stringify(request)).not.toContain('song-a');
    expect(JSON.stringify(request)).not.toContain('section-a');
  });

  it('accepts multiple separately quoted contiguous spans', () => {
    expect(validateBlindLabelResponse(request, {
      ...response,
      evidence_quotes: ['Grace and hope', 'remain'],
    }).evidence_quotes).toEqual(['Grace and hope', 'remain']);
  });

  it('rejects ellipsis, slash delimiters and non-empty grade 0 evidence', () => {
    expect(() => validateBlindLabelResponse(request, {
      ...response,
      evidence_quotes: ['Grace...hope'],
    })).toThrow(/ellipsis or slash/);
    expect(() => validateBlindLabelResponse(request, {
      ...response,
      evidence_quotes: ['Grace / hope'],
    })).toThrow(/ellipsis or slash/);
    expect(() => validateBlindLabelResponse(request, {
      ...response,
      relevance_score: 0,
      relevance_label: 'Not Relevant',
    })).toThrow(/empty evidence array/);
  });

  it('requires evidence for grades 2 and 3', () => {
    expect(() => validateBlindLabelResponse(request, {
      ...response,
      evidence_quotes: [],
    })).toThrow(/require evidence/);
  });
});
