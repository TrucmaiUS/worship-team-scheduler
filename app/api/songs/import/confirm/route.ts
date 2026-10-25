import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import db from '@/lib/db';
import { ParsedSong, ParsedSongSchema } from '@/lib/parser/types';
import { z } from 'zod';

const ConfirmRequestSchema = z.object({
  import_id: z.string().uuid(),
  songs: z.array(ParsedSongSchema).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session: any = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 401 });
    }

    const body = await req.json();
    const parseResult = ConfirmRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parseResult.error.format() }, { status: 400 });
    }

    const { import_id, songs: customSongs } = parseResult.data;

    // 1. Fetch the import record
    const importQuery = await db.query(
      'SELECT id, status, raw_payload FROM document_imports WHERE id = $1',
      [import_id]
    );

    if (importQuery.rows.length === 0) {
      return NextResponse.json({ error: 'Import record not found.' }, { status: 404 });
    }

    const importRecord = importQuery.rows[0];
    const songsToImport: ParsedSong[] = customSongs || importRecord.raw_payload || [];

    if (songsToImport.length === 0) {
      return NextResponse.json({ error: 'No songs found to import.' }, { status: 400 });
    }

    // 2. Perform database transaction
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const createdSongIds: string[] = [];

      for (const song of songsToImport) {
        const types = song.types && song.types.length > 0 ? song.types : ['worship'];
        const primaryType = types[0] || 'worship';

        // 2.1 Insert song (All imported songs are in pending_review status)
        const songRes = await client.query(
          `INSERT INTO songs 
            (canonical_title, display_title, ministry_or_artist, song_type, types, approval_status, import_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [
            song.canonical_title,
            song.display_title,
            song.ministry_or_artist,
            primaryType,
            types,
            'pending_review',
            import_id,
          ]
        );
        const songId = songRes.rows[0].id;
        createdSongIds.push(songId);

        // 2.2 Insert song_version
        const versionRes = await client.query(
          `INSERT INTO song_versions 
            (song_id, language, version_title)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [songId, song.language || 'vi', song.display_title]
        );
        const versionId = versionRes.rows[0].id;

        // 2.3 Insert song_sections
        for (const section of song.sections) {
          await client.query(
            `INSERT INTO song_sections 
              (version_id, section_type, section_label, section_order, lyrics_text)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              versionId,
              section.section_type,
              section.section_label,
              section.section_order,
              section.lyrics_text,
            ]
          );
        }
      }

      // 2.4 Update document_imports record
      await client.query(
        `UPDATE document_imports 
         SET status = 'completed', 
             imported_count = $1, 
             processed_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [createdSongIds.length, import_id]
      );

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        import_id,
        imported_count: createdSongIds.length,
        song_ids: createdSongIds,
      });
    } catch (txErr: any) {
      await client.query('ROLLBACK');
      console.error('Transaction rollback in song confirm:', txErr);

      await db.query(
        `UPDATE document_imports SET status = 'failed', error_message = $1 WHERE id = $2`,
        [txErr.message, import_id]
      );

      return NextResponse.json(
        { error: 'Transaction failed: ' + txErr.message },
        { status: 500 }
      );
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('Error in confirm route:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
