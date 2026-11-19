import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadCorpus, loadTrainTopics } from '../corpus';
import {
  auditGeneratedDuplicates,
  hasTitleOrArtistLeak,
  selectPilotSources,
  sharedLyricSpan,
} from '../teacher-pilot';

const ROOT = path.resolve(__dirname, '../../../..');

describe('Teacher–Judge pilot source and query controls', () => {
  it('selects 50 distinct eligible sections without Human Reference sections or anchors', () => {
    const corpus = loadCorpus(path.join(ROOT, 'benchmark/data/songs.csv'));
    const topics = loadTrainTopics(path.join(ROOT, 'benchmark/data/topics.csv'));
    const humanReference = JSON.parse(fs.readFileSync(path.join(ROOT,
      'benchmark/distillation/human_reference/judge_selection_reference_v2.json'), 'utf8'));
    const excluded = new Set<string>(humanReference.map((pair: any) => pair.candidate.sourceSectionId));
    const selected = selectPilotSources(corpus, topics, excluded);

    expect(selected).toHaveLength(50);
    expect(new Set(selected.map(item => item.sectionId)).size).toBe(50);
    expect(selected.some(item => excluded.has(item.sectionId))).toBe(false);
    expect(selected.some(item => corpus.anchorSongIds.includes(item.songId))).toBe(false);
    expect(new Set(selected.map(item => item.topic.topicId)).size).toBe(10);
    expect(selected.filter(item => item.targetLanguage === 'vi')).toHaveLength(30);
    expect(selected.filter(item => item.targetLanguage === 'en')).toHaveLength(20);
  });

  it('detects copied lyric spans and title or artist leakage', () => {
    expect(sharedLyricSpan(
      'Tìm bài hát nói rằng tình yêu Chúa nâng đỡ con',
      'Tình yêu Chúa nâng đỡ con qua đêm tối'
    )).toBe('tình yêu chúa nâng đỡ con');
    expect(sharedLyricSpan(
      'Tìm bài hát về tình yêu nâng đỡ trong thử thách',
      'Tình yêu Chúa nâng đỡ con qua đêm tối'
    )).toBeNull();
    expect(hasTitleOrArtistLeak('Find songs like Build My Life', 'Build My Life', 'Freedom Movement'))
      .toBe(true);
  });

  it('flags exact and high-overlap generated duplicates', () => {
    const result = auditGeneratedDuplicates([
      { queryId: 'TP001', queryText: 'Bài hát về tình yêu Chúa nâng đỡ người yếu đuối' },
      { queryId: 'TP002', queryText: 'Bài hát về tình yêu Chúa nâng đỡ người yếu đuối' },
      { queryId: 'TP003', queryText: 'Worship songs about hope in suffering' },
    ]);
    expect(result.get('TP002')?.duplicateOfQueryId).toBe('TP001');
    expect(result.get('TP003')?.duplicateOfQueryId).toBeNull();
  });
});
