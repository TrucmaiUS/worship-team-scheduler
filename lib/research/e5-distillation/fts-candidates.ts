import type { PoolClient } from 'pg';
import type { CorpusSnapshot } from './corpus';

export interface FtsRow { song_id: string; section_id: string | null }

// The rank expression, best-section selection, eligibility filter and ordering
// mirror lib/search/keyword-search.ts. Unlike that function, errors propagate.
export const STRICT_FTS_SQL = `
WITH matching_sections AS (
  SELECT sv.song_id, ss.id AS section_id,
    ts_rank_cd(to_tsvector('simple', immutable_unaccent(ss.lyrics_text)),
      websearch_to_tsquery('simple', immutable_unaccent($1))) AS section_score
  FROM song_sections ss
  JOIN song_versions sv ON ss.version_id = sv.id
  WHERE to_tsvector('simple', immutable_unaccent(ss.lyrics_text))
    @@ websearch_to_tsquery('simple', immutable_unaccent($1))
), best_sections AS (
  SELECT DISTINCT ON (song_id) song_id, section_id, section_score
  FROM matching_sections ORDER BY song_id, section_score DESC
)
SELECT s.id AS song_id, bs.section_id
FROM songs s LEFT JOIN best_sections bs ON s.id = bs.song_id
WHERE (bs.section_score > 0 OR
  to_tsvector('simple', immutable_unaccent(s.display_title || ' ' || COALESCE(s.ministry_or_artist, '')))
    @@ websearch_to_tsquery('simple', immutable_unaccent($1)))
  AND s.approval_status = 'approved'
ORDER BY COALESCE(bs.section_score, 0) +
  (ts_rank_cd(to_tsvector('simple', immutable_unaccent(s.display_title || ' ' || COALESCE(s.ministry_or_artist, ''))),
    websearch_to_tsquery('simple', immutable_unaccent($1))) * 2.0) DESC
LIMIT $2`;

export interface FtsCandidateResult {
  sectionIds: string[];
  anchorHits: number;
  titleOnlyHits: number;
}

export function mapFtsRows(snapshot: CorpusSnapshot, rows: readonly FtsRow[]): FtsCandidateResult {
  const anchors = new Set(snapshot.anchorSongIds);
  const songs = new Map(snapshot.eligibleSongs.map(song => [song.songId, song]));
  const sectionIds: string[] = [];
  let anchorHits = 0;
  let titleOnlyHits = 0;
  for (const row of rows) {
    if (anchors.has(row.song_id)) { anchorHits += 1; continue; }
    if (!row.section_id) { titleOnlyHits += 1; continue; }
    const song = songs.get(row.song_id);
    if (!song?.sections.some(section => section.sectionId === row.section_id)) {
      throw new Error(`FTS section ${row.section_id} is absent from the frozen eligible corpus.`);
    }
    if (!sectionIds.includes(row.section_id)) sectionIds.push(row.section_id);
  }
  return { sectionIds, anchorHits, titleOnlyHits };
}

export async function readFtsCandidates(
  client: Pick<PoolClient, 'query'>,
  snapshot: CorpusSnapshot,
  queryText: string,
  topSongLimit: number
): Promise<FtsCandidateResult> {
  if (!queryText.trim() || !Number.isInteger(topSongLimit) || topSongLimit < 1 || topSongLimit > 100) {
    throw new Error('Invalid strict FTS request.');
  }
  const rows = (await client.query<FtsRow>(STRICT_FTS_SQL, [queryText.trim(), topSongLimit])).rows;
  return mapFtsRows(snapshot, rows);
}
