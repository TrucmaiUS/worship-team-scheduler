import fs from 'node:fs';
import crypto from 'node:crypto';
import { z } from 'zod';
import { normalizeForComparison } from './normalization';
import { TRAIN_TOPIC_IDS } from './split-integrity';

export const ANCHOR_TITLES = [
  'Way Maker', 'Build My Life', 'Raise A Hallelujah',
  'Who You Say I Am', 'Do It Again', 'I Surrender',
] as const;

const SectionSchema = z.object({
  section_id: z.string().uuid(),
  section_type: z.string(),
  section_label: z.string(),
  section_order: z.number(),
  lyrics_text: z.string(),
});
const SongRowSchema = z.object({
  song_id: z.string().uuid(),
  canonical_title: z.string(),
  display_title: z.string(),
  ministry_or_artist: z.string(),
  approval_status: z.string(),
  lyrics_sections_json: z.string(),
});

export interface CorpusSection {
  sectionId: string;
  songId: string;
  sectionType: string;
  sectionLabel: string;
  lyrics: string;
  passageText: string;
}
export interface CorpusSong {
  songId: string;
  title: string;
  artist: string;
  sections: CorpusSection[];
}
export interface CorpusSnapshot {
  songs: CorpusSong[];
  anchorSongIds: string[];
  eligibleSongs: CorpusSong[];
  sha256: string;
}

export interface SourceManifest {
  schemaVersion: 'source-manifest-v1';
  corpusSha256: string;
  approvedSongs: number;
  eligibleSongs: number;
  eligibleSections: number;
  anchorSongIds: string[];
  trainTopicIds: string[];
  protectedQueryCount: number;
  eligibleSourceSha256: string;
}

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i += 1; }
      else quoted = !quoted;
    } else if (c === ',' && !quoted) { row.push(field); field = ''; }
    else if ((c === '\r' || c === '\n') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      if (row.some(value => value.length)) rows.push(row);
      row = []; field = '';
    } else field += c;
  }
  if (quoted) throw new Error('Unclosed CSV quote.');
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const [headers, ...data] = rows;
  if (!headers) throw new Error('Empty CSV.');
  return data.map(cells => Object.fromEntries(headers.map((name, i) => [name, cells[i] ?? ''])));
}

export function loadCorpus(csvPath: string): CorpusSnapshot {
  const bytes = fs.readFileSync(csvPath);
  const rows = parseCsv(bytes.toString('utf8'));
  const seenSongs = new Set<string>();
  const seenSections = new Set<string>();
  const songs = rows.filter(row => row.approval_status === 'approved').map(raw => {
    const row = SongRowSchema.parse(raw);
    if (seenSongs.has(row.song_id)) throw new Error('Duplicate song ID: ' + row.song_id);
    seenSongs.add(row.song_id);
    const sections = z.array(SectionSchema).parse(JSON.parse(row.lyrics_sections_json)).map(section => {
      if (seenSections.has(section.section_id)) throw new Error('Duplicate section ID: ' + section.section_id);
      seenSections.add(section.section_id);
      return {
        sectionId: section.section_id,
        songId: row.song_id,
        sectionType: section.section_type,
        sectionLabel: section.section_label,
        lyrics: section.lyrics_text,
        passageText: `Song: ${row.display_title}\nSection: [${section.section_label}]\n${section.lyrics_text}`.trim(),
      };
    });
    return { songId: row.song_id, title: row.display_title, artist: row.ministry_or_artist, sections };
  });
  const anchorSongIds = ANCHOR_TITLES.map(title => {
    const matches = rows.filter(row =>
      normalizeForComparison(row.display_title) === normalizeForComparison(title) ||
      normalizeForComparison(row.canonical_title) === normalizeForComparison(title) ||
      normalizeForComparison(row.display_title).startsWith(normalizeForComparison(title) + ' -')
    );
    if (matches.length !== 1 || matches[0].approval_status !== 'approved') {
      throw new Error(`Anchor "${title}" must resolve to one approved song; found ${matches.length}.`);
    }
    return matches[0].song_id;
  });
  if (new Set(anchorSongIds).size !== ANCHOR_TITLES.length) throw new Error('Duplicate anchor resolution.');
  const excluded = new Set(anchorSongIds);
  return {
    songs,
    anchorSongIds,
    eligibleSongs: songs.filter(song => !excluded.has(song.songId)),
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  };
}

export function loadProtectedQueries(csvPath: string) {
  return parseCsv(fs.readFileSync(csvPath, 'utf8')).map(row => ({
    id: row.query_id,
    text: row.query_text,
    scope: row.topic_id && !TRAIN_TOPIC_IDS.has(row.topic_id) ? 'diagnostic' as const : 'development' as const,
  }));
}

export function loadTrainTopics(csvPath: string) {
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  const train = rows.filter(row => TRAIN_TOPIC_IDS.has(row.topic_id));
  if (train.length !== 10) throw new Error(`Expected 10 train topics, found ${train.length}.`);
  return train.map(row => ({ topicId: row.topic_id, title: row.title, description: row.description }));
}

export function assertSectionMembership(snapshot: CorpusSnapshot, songId: string, sectionId: string): void {
  const song = snapshot.eligibleSongs.find(item => item.songId === songId);
  if (!song || !song.sections.some(section => section.sectionId === sectionId)) {
    throw new Error('Source section does not belong to an eligible song.');
  }
}

export function buildSourceManifest(
  snapshot: CorpusSnapshot,
  trainTopics: readonly { topicId: string }[],
  protectedQueryCount: number
): SourceManifest {
  const eligibleIds = snapshot.eligibleSongs
    .flatMap(song => song.sections.map(section => [song.songId, section.sectionId]))
    .sort((a, b) => a[1].localeCompare(b[1]));
  return {
    schemaVersion: 'source-manifest-v1',
    corpusSha256: snapshot.sha256,
    approvedSongs: snapshot.songs.length,
    eligibleSongs: snapshot.eligibleSongs.length,
    eligibleSections: eligibleIds.length,
    anchorSongIds: [...snapshot.anchorSongIds].sort(),
    trainTopicIds: trainTopics.map(topic => topic.topicId).sort(),
    protectedQueryCount,
    eligibleSourceSha256: crypto.createHash('sha256')
      .update(JSON.stringify(eligibleIds)).digest('hex'),
  };
}
