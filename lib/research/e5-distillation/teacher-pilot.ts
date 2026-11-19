import crypto from 'node:crypto';
import type { CorpusSnapshot } from './corpus';
import { normalizeForComparison, tokenizeWords, wordJaccard } from './normalization';

export type PilotQueryStyle =
  | 'natural_thematic_request'
  | 'lyric_paraphrase'
  | 'ambiguous_request';

export interface PilotTopic {
  topicId: string;
  title: string;
  description: string;
}

export interface PilotSourceSelection {
  queryId: string;
  topic: PilotTopic;
  targetLanguage: 'vi' | 'en';
  queryStyle: PilotQueryStyle;
  coverageCategory: 'semantic_paraphrase' | 'sermon_topic' | 'theological_concept' | 'cross_lingual';
  songId: string;
  songTitle: string;
  artist: string;
  sectionId: string;
  sectionType: string;
  sectionLabel: string;
  lyrics: string;
  selectionScore: number;
}

const TOPIC_TERMS: Record<string, string[]> = {
  T01: ['thánh linh', 'thần ngài', 'quyền năng', 'năng quyền', 'lửa', 'spirit', 'power'],
  T02: ['thế hệ', 'generation', 'tuổi trẻ', 'con trẻ', 'đức tin', 'ngọn lửa', 'bold'],
  T03: ['truyền', 'trao', 'dạy', 'môn đồ', 'sai đi', 'muôn dân', 'disciple', 'send'],
  T04: ['yêu thương', 'tình yêu', 'phục vụ', 'tha nhân', 'love', 'serve', 'mercy'],
  T05: ['con của', 'thuộc về', 'danh phận', 'tự do', 'identity', 'child', 'belong'],
  T06: ['nhà chúa', 'gia đình', 'hiệp một', 'cùng nhau', 'thuộc về', 'church', 'family'],
  T07: ['theo chúa', 'bước đi', 'dẫn dắt', 'lớn lên', 'đường ngài', 'follow', 'grow'],
  T08: [
    'kêu gọi', 'sai đi', 'mục đích', 'ý ngài', 'sứ mạng', 'đời con', 'vinh hiển',
    'dùng con', 'calling', 'purpose', 'mission', 'glory',
  ],
  T09: ['giúp', 'ủi an', 'ở cùng', 'sức mới', 'nâng đỡ', 'helper', 'strength'],
  T10: ['dạy', 'nhắc', 'lời chúa', 'khôn ngoan', 'hiểu biết', 'teach', 'remember'],
};

function deterministicRank(seed: string, id: string): string {
  return crypto.createHash('sha256').update(`${seed}:${id}`).digest('hex');
}

function topicScore(topicId: string, lyrics: string): number {
  const normalized = normalizeForComparison(lyrics);
  return (TOPIC_TERMS[topicId] ?? []).reduce(
    (score, term) => score + (normalized.includes(normalizeForComparison(term)) ? 1 : 0), 0
  );
}

function planDimensions(index: number): Pick<PilotSourceSelection,
  'targetLanguage' | 'queryStyle' | 'coverageCategory'> {
  const position = index % 5;
  if (position === 0) {
    return { targetLanguage: 'vi', queryStyle: 'lyric_paraphrase', coverageCategory: 'semantic_paraphrase' };
  }
  if (position === 1) {
    return { targetLanguage: 'vi', queryStyle: 'natural_thematic_request', coverageCategory: 'sermon_topic' };
  }
  if (position === 2) {
    return { targetLanguage: 'en', queryStyle: 'lyric_paraphrase', coverageCategory: 'cross_lingual' };
  }
  if (position === 3) {
    return { targetLanguage: 'vi', queryStyle: 'ambiguous_request', coverageCategory: 'theological_concept' };
  }
  return { targetLanguage: 'en', queryStyle: 'natural_thematic_request', coverageCategory: 'cross_lingual' };
}

export function selectPilotSources(
  snapshot: CorpusSnapshot,
  topics: readonly PilotTopic[],
  excludedSectionIds: ReadonlySet<string>,
  countPerTopic = 5,
  seed = 'teacher-judge-pilot-v1'
): PilotSourceSelection[] {
  const selected: PilotSourceSelection[] = [];
  const usedSections = new Set<string>();
  const usedSongs = new Set<string>();
  const available = snapshot.eligibleSongs.flatMap(song => song.sections
    .filter(section => !excludedSectionIds.has(section.sectionId))
    .map(section => ({ song, section })));

  for (const topic of topics) {
    const ranked = [...available].sort((left, right) =>
      topicScore(topic.topicId, right.section.lyrics) - topicScore(topic.topicId, left.section.lyrics) ||
      deterministicRank(`${seed}:${topic.topicId}`, left.section.sectionId)
        .localeCompare(deterministicRank(`${seed}:${topic.topicId}`, right.section.sectionId))
    );
    for (let slot = 0; slot < countPerTopic; slot += 1) {
      const preferred = ranked.find(item =>
        topicScore(topic.topicId, item.section.lyrics) > 0 &&
        !usedSections.has(item.section.sectionId) && !usedSongs.has(item.song.songId));
      const relevantFallback = ranked.find(item =>
        topicScore(topic.topicId, item.section.lyrics) > 0 &&
        !usedSections.has(item.section.sectionId));
      const diverseFallback = ranked.find(item =>
        !usedSections.has(item.section.sectionId) && !usedSongs.has(item.song.songId));
      const finalFallback = ranked.find(item => !usedSections.has(item.section.sectionId));
      const chosen = preferred ?? relevantFallback ?? diverseFallback ?? finalFallback;
      if (!chosen) throw new Error(`Insufficient eligible sections for ${topic.topicId}.`);
      usedSections.add(chosen.section.sectionId);
      usedSongs.add(chosen.song.songId);
      const index = selected.length;
      selected.push({
        queryId: `TP${String(index + 1).padStart(3, '0')}`,
        topic,
        ...planDimensions(index),
        songId: chosen.song.songId,
        songTitle: chosen.song.title,
        artist: chosen.song.artist,
        sectionId: chosen.section.sectionId,
        sectionType: chosen.section.sectionType,
        sectionLabel: chosen.section.sectionLabel,
        lyrics: chosen.section.lyrics,
        selectionScore: topicScore(topic.topicId, chosen.section.lyrics),
      });
    }
  }
  return selected;
}

export function sharedLyricSpan(queryText: string, lyrics: string, minimumWords = 4): string | null {
  const queryTokens = tokenizeWords(queryText);
  const lyricTokens = tokenizeWords(lyrics);
  for (let size = Math.min(queryTokens.length, lyricTokens.length); size >= minimumWords; size -= 1) {
    const lyricSpans = new Set<string>();
    for (let index = 0; index <= lyricTokens.length - size; index += 1) {
      lyricSpans.add(lyricTokens.slice(index, index + size).join(' '));
    }
    for (let index = 0; index <= queryTokens.length - size; index += 1) {
      const span = queryTokens.slice(index, index + size).join(' ');
      if (lyricSpans.has(span)) return span;
    }
  }
  return null;
}

export function hasTitleOrArtistLeak(queryText: string, title: string, artist: string): boolean {
  const query = normalizeForComparison(queryText);
  const values = [title, artist]
    .map(normalizeForComparison)
    .filter(value => tokenizeWords(value).length >= 2 || value.length >= 8);
  return values.some(value => query.includes(value));
}

export interface GeneratedDuplicateAudit {
  duplicateOfQueryId: string | null;
  maximumWordJaccard: number;
}

export function auditGeneratedDuplicates(
  records: readonly { queryId: string; queryText: string }[]
): Map<string, GeneratedDuplicateAudit> {
  const result = new Map<string, GeneratedDuplicateAudit>();
  for (let index = 0; index < records.length; index += 1) {
    let duplicateOfQueryId: string | null = null;
    let maximumWordJaccard = 0;
    for (let prior = 0; prior < index; prior += 1) {
      const score = wordJaccard(records[index].queryText, records[prior].queryText);
      maximumWordJaccard = Math.max(maximumWordJaccard, score);
      if (
        normalizeForComparison(records[index].queryText) ===
          normalizeForComparison(records[prior].queryText) ||
        score >= 0.85
      ) {
        duplicateOfQueryId ??= records[prior].queryId;
      }
    }
    result.set(records[index].queryId, { duplicateOfQueryId, maximumWordJaccard });
  }
  return result;
}

export function queryLyricWordOverlap(queryText: string, lyrics: string): number {
  return wordJaccard(queryText, lyrics);
}
