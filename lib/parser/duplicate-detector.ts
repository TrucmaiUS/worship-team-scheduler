import db from '@/lib/db';
import { ParsedSong } from './types';

export interface ExistingSongRecord {
  id: string;
  canonical_title: string;
  display_title: string;
  ministry_or_artist: string | null;
  approval_status: string;
}

/**
 * Checks in-memory list or database for duplicate canonical titles.
 * If a matching canonical_title exists, adds a POTENTIAL_DUPLICATE_TITLE warning
 * and forces approval_status to 'pending_review'.
 */
export function annotateDuplicates(
  songs: ParsedSong[],
  existingSongs: ExistingSongRecord[]
): ParsedSong[] {
  const existingMap = new Map<string, ExistingSongRecord[]>();

  for (const item of existingSongs) {
    const list = existingMap.get(item.canonical_title) || [];
    list.push(item);
    existingMap.set(item.canonical_title, list);
  }

  return songs.map((song) => {
    const matches = existingMap.get(song.canonical_title);
    if (matches && matches.length > 0) {
      const matchArtist = matches.find(
        (m) =>
          (m.ministry_or_artist || '').toLowerCase() ===
          (song.ministry_or_artist || '').toLowerCase()
      );

      const warningMsg = matchArtist
        ? `Phát hiện bài hát trùng tên và tác giả với bài đã có trong hệ thống (ID: ${matchArtist.id}).`
        : `Phát hiện bài hát có cùng tiêu đề chuẩn hóa với bài hát đã có (ID: ${matches[0].id}).`;

      const updatedWarnings = [
        ...song.warnings,
        {
          type: 'POTENTIAL_DUPLICATE_TITLE' as const,
          message: warningMsg,
        },
      ];

      return {
        ...song,
        warnings: updatedWarnings,
        // Rule 4: If potential duplicate is detected, it must stay pending_review
        approval_status: 'pending_review' as const,
      };
    }

    return song;
  });
}

/**
 * Queries database to check if file_hash already exists in document_imports
 */
export async function checkFileHashExists(fileHash: string): Promise<boolean> {
  const result = await db.query(
    'SELECT id FROM document_imports WHERE file_hash = $1 AND status = $2',
    [fileHash, 'completed']
  );
  return result.rows.length > 0;
}

/**
 * Queries database for existing songs matching the given canonical titles
 */
export async function findExistingSongsByTitles(
  canonicalTitles: string[]
): Promise<ExistingSongRecord[]> {
  if (canonicalTitles.length === 0) return [];
  const result = await db.query(
    'SELECT id, canonical_title, display_title, ministry_or_artist, approval_status FROM songs WHERE canonical_title = ANY($1)',
    [canonicalTitles]
  );
  return result.rows;
}
