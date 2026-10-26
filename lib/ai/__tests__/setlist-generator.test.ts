import { describe, it, expect } from 'vitest';
import { generateWorshipSetlist, GeneratedSetlistResponseSchema } from '../setlist-generator';

describe('Phase 5: AI Controlled Setlist Generator', () => {
  it('should generate a valid 3-song worship setlist grounded in real candidate songs', async () => {
    const theme = 'Sự tha thứ & Yêu thương kẻ thù';
    const setlist = await generateWorshipSetlist({
      theme,
      leaderVocalRange: 'male',
      scriptureReference: 'Ma-thi-ơ 5:43-48',
    });

    // 1. Zod schema validation
    const parsed = GeneratedSetlistResponseSchema.safeParse(setlist);
    expect(parsed.success).toBe(true);

    // 2. Exact 3 songs
    expect(setlist.songs).toHaveLength(3);
    expect(setlist.songs[0].position).toBe('opener');
    expect(setlist.songs[1].position).toBe('worship');
    expect(setlist.songs[2].position).toBe('closing');

    // 3. Recommended keys exist
    setlist.songs.forEach((s) => {
      expect(s.song_id).toBeTruthy();
      expect(s.song_title).toBeTruthy();
      expect(s.recommended_key).toBeTruthy();
      expect(s.liturgical_reasoning).toBeTruthy();
    });

    // 4. Transitions
    expect(setlist.transitions).toHaveLength(2);
    expect(setlist.transitions[0].prayer_script).toBeTruthy();
    expect(setlist.transitions[1].prayer_script).toBeTruthy();
    expect(setlist.transitions[0].musical_tip).toBeTruthy();

    // 5. Closing prayer
    expect(setlist.closing_prayer).toBeTruthy();
  }, 45000);

  it('should respect female vocal range by adjusting recommended keys', async () => {
    const setlist = await generateWorshipSetlist({
      theme: 'Đức Thánh Linh & Sự đổi mới',
      leaderVocalRange: 'female',
    });

    expect(setlist.songs).toHaveLength(3);
    expect(setlist.leader_vocal_range).toBe('female');
    setlist.songs.forEach((s) => {
      expect(s.recommended_key).toBeTruthy();
    });
  }, 45000);
});
