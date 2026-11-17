import crypto from 'node:crypto';
import type { CorpusSection, CorpusSnapshot } from './corpus';
import { tokenizeWords } from './normalization';

export type PoolSource = 'source' | 'lexical' | 'fts' | 'e5' | 'control';
export interface PoolCandidate {
  alias: string;
  songId: string;
  sectionId: string;
  sectionType: string;
  lyrics: string;
  sources: PoolSource[];
}
export interface PoolOptions {
  queryId: string;
  queryText: string;
  sourceSectionId: string;
  lexicalDepth: number;
  // Strict read-only PostgreSQL FTS results, already mapped to eligible
  // section IDs. Pilot calls set lexicalDepth=0 and supply this field.
  ftsSectionIds?: readonly string[];
  e5Depth: number;
  controlCount: number;
  // Scores must come from the pinned frozen E5 model. Missing scores cannot
  // be represented as a completed semantic pool.
  e5Scores: ReadonlyMap<string, number>;
  seed: string;
}

function lexicalScore(query: string, lyrics: string): number {
  const terms = new Set(tokenizeWords(query));
  const candidate = new Set(tokenizeWords(lyrics));
  let overlap = 0;
  for (const term of terms) if (candidate.has(term)) overlap += 1;
  return terms.size ? overlap / terms.size : 0;
}

function deterministicRank(seed: string, sectionId: string): string {
  return crypto.createHash('sha256').update(seed + ':' + sectionId).digest('hex');
}

export function buildCandidatePool(snapshot: CorpusSnapshot, options: PoolOptions): PoolCandidate[] {
  const sections = snapshot.eligibleSongs.flatMap(song => song.sections);
  const source = sections.find(item => item.sectionId === options.sourceSectionId);
  if (!source) throw new Error('Source section is not eligible.');
  if (options.e5Scores.size !== sections.length ||
      sections.some(section => !Number.isFinite(options.e5Scores.get(section.sectionId)))) {
    throw new Error('Complete frozen E5 scores are required for all eligible sections.');
  }
  const chosen = new Map<string, { section: CorpusSection; sources: Set<PoolSource> }>();
  function add(section: CorpusSection, sourceName: PoolSource) {
    const existing = chosen.get(section.sectionId);
    if (existing) existing.sources.add(sourceName);
    else chosen.set(section.sectionId, { section, sources: new Set([sourceName]) });
  }
  add(source, 'source');
  [...sections].sort((a, b) =>
    lexicalScore(options.queryText, b.lyrics) - lexicalScore(options.queryText, a.lyrics) ||
    a.sectionId.localeCompare(b.sectionId)
  ).slice(0, options.lexicalDepth).forEach(item => add(item, 'lexical'));
  for (const sectionId of options.ftsSectionIds ?? []) {
    const section = sections.find(item => item.sectionId === sectionId);
    if (!section) throw new Error('FTS candidate is absent from the eligible corpus.');
    add(section, 'fts');
  }
  [...sections].sort((a, b) =>
    options.e5Scores.get(b.sectionId)! - options.e5Scores.get(a.sectionId)! ||
    a.sectionId.localeCompare(b.sectionId)
  ).slice(0, options.e5Depth).forEach(item => add(item, 'e5'));
  [...sections].sort((a, b) =>
    deterministicRank(options.seed + ':control', a.sectionId)
      .localeCompare(deterministicRank(options.seed + ':control', b.sectionId))
  ).slice(0, options.controlCount).forEach(item => add(item, 'control'));

  return [...chosen.values()]
    .sort((a, b) => deterministicRank(options.seed + ':' + options.queryId, a.section.sectionId)
      .localeCompare(deterministicRank(options.seed + ':' + options.queryId, b.section.sectionId)))
    .map((item, i) => ({
      alias: 'CANDIDATE_' + String(i + 1).padStart(3, '0'),
      songId: item.section.songId,
      sectionId: item.section.sectionId,
      sectionType: item.section.sectionType,
      lyrics: item.section.lyrics,
      sources: [...item.sources].sort(),
    }));
}

export function blindPayload(queryText: string, candidate: PoolCandidate) {
  return {
    query_text: queryText,
    candidate: {
      candidate_alias: candidate.alias,
      section_type: candidate.sectionType,
      lyrics: candidate.lyrics,
    },
  };
}
