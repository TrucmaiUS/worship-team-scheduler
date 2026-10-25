import { describe, it, expect } from 'vitest';
import { parseSongText, calculateFileHash } from '../docx-parser';
import { determineApprovalStatus } from '../approval-policy';
import { annotateDuplicates, ExistingSongRecord } from '../duplicate-detector';

describe('DOCX Parser & Song Import Engine (English Specification)', () => {
  // Test case input from real user scenario
  const sampleMultiSongText = `
A THOUSAND HALLELUJAHS
Victory Worship

[Verse]
Nguyện Danh Thánh của Chúa là Danh mà con nhắc đến
Và là Danh của Đấng Toàn Năng chính con thờ lạy
Mọi điều Cha làm nên tuyệt thật lòng con chúc tán
Chỉ duy Chúa quyền năng trên đất không ai bì cùng
Chỉ duy Chúa quyền năng trên đất con đây tôn vinh

[Chorus]
Lòng con đây dâng lên với Chúa hết thảy ngàn lời chúc tán
Lòng con đây yêu thương với Chúa cất tiếng ngàn lời ca vang
Chỉ duy Chúa xứng đáng với tiếng hát ngợi ca mãi mãi
Tốt thay, Chúa Cha đời đời (mãi mãi)

[Bridge]
Thật Cha công chính, quyền năng, thương xót
Ngài mãi mãi còn nguyên
Thật Cha công chính, quyền năng, thương xót
Ngài mãi mãi yêu con
----
Beauty For Ashes
Every Nation

[Verse 1]
Bừng sáng hy vọng, sợ hãi không còn
Tấm thân Giê-su, là duy nhất
Nhục nhã không còn, giờ Chúa bên cạnh
Bóng đêm trong con, giờ tan biến
Chính Chúa Con - Đấng Cứu Ân

[Verse 2]
Ánh sáng Ngài, sáng soi đường
Bước đi theo , bỏ lại quá khứ
Sự sống nơi Ngài, đã thay đổi con
Mang đi xa những gian dối kia
Chính Chúa Con - Đấng Cứu Ân

[Chorus]
Ngài đã lấy đi, bao sầu héo trong con
Gần với Chúa hơn, con mong bên Ngài
Ngài hóa khóc than, vui mừng nở trên môi
Ơn cao Giê-su
Vinh quang Giê-su

[Bridge]
Ngài đã lấy đi
Nhục ô trong chúng con
Ngài đã giúp con
Truyền cho con sức thiêng 
Buồn đau qua đi
Lòng vui hân hoan 
Giê-su
`.trim();

  // -------------------------------------------------------------
  // Group 1: Parse multiple songs separated by delimiter (----)
  // -------------------------------------------------------------
  it('Group 1: Should accurately parse multiple songs separated by delimiter (----)', () => {
    const songs = parseSongText(sampleMultiSongText);
    expect(songs).toHaveLength(2);

    expect(songs[0].display_title).toBe('A THOUSAND HALLELUJAHS');
    expect(songs[0].canonical_title).toBe('a thousand hallelujahs');
    expect(songs[0].ministry_or_artist).toBe('Victory Worship');

    expect(songs[1].display_title).toBe('Beauty For Ashes');
    expect(songs[1].canonical_title).toBe('beauty for ashes');
    expect(songs[1].ministry_or_artist).toBe('Every Nation');
  });

  // -------------------------------------------------------------
  // Group 2: Section labels recognition
  // -------------------------------------------------------------
  it('Group 2: Should accurately detect section types (verse, chorus, bridge)', () => {
    const songs = parseSongText(sampleMultiSongText);

    // Song 1 has: Verse, Chorus, Bridge
    expect(songs[0].sections.map((s) => s.section_type)).toEqual(['verse', 'chorus', 'bridge']);
    expect(songs[0].sections.map((s) => s.section_label)).toEqual(['[Verse]', '[Chorus]', '[Bridge]']);
    expect(songs[0].sections.every((s) => s.is_recognized)).toBe(true);

    // Song 2 has: Verse 1, Verse 2, Chorus, Bridge
    expect(songs[1].sections.map((s) => s.section_type)).toEqual(['verse', 'verse', 'chorus', 'bridge']);
    expect(songs[1].sections.map((s) => s.section_label)).toEqual(['[Verse 1]', '[Verse 2]', '[Chorus]', '[Bridge]']);
  });

  // -------------------------------------------------------------
  // Group 3: Preserve section order and exact lyrics content
  // -------------------------------------------------------------
  it('Group 3: Should preserve section ordering and exact lyrics content', () => {
    const songs = parseSongText(sampleMultiSongText);
    const song1 = songs[0];

    // Check order numbering
    expect(song1.sections[0].section_order).toBe(1);
    expect(song1.sections[1].section_order).toBe(2);
    expect(song1.sections[2].section_order).toBe(3);

    // Check exact text content in Chorus
    expect(song1.sections[1].lyrics_text).toBe(
      'Lòng con đây dâng lên với Chúa hết thảy ngàn lời chúc tán\n' +
      'Lòng con đây yêu thương với Chúa cất tiếng ngàn lời ca vang\n' +
      'Chỉ duy Chúa xứng đáng với tiếng hát ngợi ca mãi mãi\n' +
      'Tốt thay, Chúa Cha đời đời (mãi mãi)'
    );
  });

  // -------------------------------------------------------------
  // Group 4: Dynamic Song Type Tags
  // -------------------------------------------------------------
  it('Group 4: Should support tag-based types with default and custom tags', () => {
    const defaultSongs = parseSongText(sampleMultiSongText);
    expect(defaultSongs[0].types).toEqual(['worship']);

    const customTaggedSongs = parseSongText(sampleMultiSongText, {
      defaultTypes: ['praise', 'fast', 'opener'],
    });
    expect(customTaggedSongs[0].types).toEqual(['praise', 'fast', 'opener']);
    expect(customTaggedSongs[1].types).toEqual(['praise', 'fast', 'opener']);
  });

  // -------------------------------------------------------------
  // Group 5: Handle missing artist or unrecognized sections
  // -------------------------------------------------------------
  it('Group 5: Should flag MISSING_ARTIST warning without throwing error', () => {
    const textWithoutArtist = `
LỜI TẠ ƠN
[Chorus]
Cảm tạ Chúa vì muôn ơn lành
`.trim();

    const songs = parseSongText(textWithoutArtist);
    expect(songs).toHaveLength(1);
    expect(songs[0].display_title).toBe('LỜI TẠ ƠN');
    expect(songs[0].ministry_or_artist).toBeNull();
    expect(songs[0].warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'MISSING_ARTIST' }),
      ])
    );
  });

  it('Group 5b: Should handle custom/unrecognized sections with warning', () => {
    const textWithCustomSection = `
Chúa Cứu Thế
Hội Thánh Lời Sự Sống

[Nhạc dạo phiêu linh]
(Solo guitar)

[Chorus]
Chúa là tất cả cho con
`.trim();

    const songs = parseSongText(textWithCustomSection);
    expect(songs[0].sections[0].section_type).toBe('other');
    expect(songs[0].sections[0].is_recognized).toBe(false);
    expect(songs[0].warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'UNRECOGNIZED_SECTION' }),
      ])
    );
  });

  // -------------------------------------------------------------
  // Group 6: Duplicate file and title detection
  // -------------------------------------------------------------
  it('Group 6: calculateFileHash produces identical hash for same content', () => {
    const buffer1 = Buffer.from('Testing same file content');
    const buffer2 = Buffer.from('Testing same file content');
    const bufferDiff = Buffer.from('Testing different content');

    expect(calculateFileHash(buffer1)).toBe(calculateFileHash(buffer2));
    expect(calculateFileHash(buffer1)).not.toBe(calculateFileHash(bufferDiff));
  });

  it('Group 6b: annotateDuplicates flags POTENTIAL_DUPLICATE_TITLE', () => {
    const parsed = parseSongText(sampleMultiSongText);
    const existingSongs: ExistingSongRecord[] = [
      {
        id: 'song_uuid_123',
        canonical_title: 'a thousand hallelujahs',
        display_title: 'A Thousand Hallelujahs',
        ministry_or_artist: 'Victory Worship',
        approval_status: 'approved',
      },
    ];

    const annotated = annotateDuplicates(parsed, existingSongs);
    const song1 = annotated[0];

    expect(song1.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'POTENTIAL_DUPLICATE_TITLE' }),
      ])
    );
    expect(song1.approval_status).toBe('pending_review');
  });

  // -------------------------------------------------------------
  // Group 7: Strict human review policy (Always pending_review)
  // -------------------------------------------------------------
  it('Group 7: All imported songs must always default to pending_review', () => {
    const songs = parseSongText(sampleMultiSongText);
    expect(songs[0].approval_status).toBe('pending_review');
    expect(songs[1].approval_status).toBe('pending_review');

    expect(determineApprovalStatus()).toBe('pending_review');
  });
});
