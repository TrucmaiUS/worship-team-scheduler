import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { parseDocxBuffer, calculateFileHash } from '../lib/parser/docx-parser';

async function importAllSongs() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('No DATABASE_URL found in environment variables.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  console.log('Connected to Supabase PostgreSQL database.');

  try {
    const praiseDir = path.join(process.cwd(), 'songs_database', 'Praise');
    const worshipDir = path.join(process.cwd(), 'songs_database', 'Worship');

    interface FileTask {
      filePath: string;
      fileName: string;
      type: 'praise' | 'worship';
    }

    const tasks: FileTask[] = [];

    if (fs.existsSync(praiseDir)) {
      const files = fs.readdirSync(praiseDir).filter(f => f.toLowerCase().endsWith('.docx'));
      for (const f of files) {
        tasks.push({ filePath: path.join(praiseDir, f), fileName: f, type: 'praise' });
      }
    }

    if (fs.existsSync(worshipDir)) {
      const files = fs.readdirSync(worshipDir).filter(f => f.toLowerCase().endsWith('.docx'));
      for (const f of files) {
        tasks.push({ filePath: path.join(worshipDir, f), fileName: f, type: 'worship' });
      }
    }

    console.log(`Found ${tasks.length} .docx files in songs_database (${tasks.filter(t => t.type === 'praise').length} Praise, ${tasks.filter(t => t.type === 'worship').length} Worship).\n`);

    let totalInsertedSongs = 0;
    let totalInsertedSections = 0;
    let totalSkippedDuplicates = 0;
    let totalErrors = 0;

    for (const [idx, task] of tasks.entries()) {
      const prefix = `[${idx + 1}/${tasks.length}] [${task.type.toUpperCase()}] ${task.fileName}`;
      try {
        const buffer = fs.readFileSync(task.filePath);
        const fileHash = calculateFileHash(buffer);

        // 1. Parse using our deterministic engine
        const parsedSongs = await parseDocxBuffer(buffer, {
          defaultTypes: [task.type],
        });

        if (parsedSongs.length === 0) {
          console.warn(`${prefix} -> No song structure detected, skipping.`);
          totalErrors++;
          continue;
        }

        await client.query('BEGIN');

        // 2. Track document import record
        const importRes = await client.query(
          `INSERT INTO document_imports 
            (file_name, file_hash, file_size, status, detected_count, raw_payload)
           VALUES ($1, $2, $3, 'completed', $4, $5)
           ON CONFLICT (file_hash) DO UPDATE SET status = 'completed'
           RETURNING id`,
          [
            task.fileName,
            fileHash,
            buffer.length,
            parsedSongs.length,
            JSON.stringify(parsedSongs),
          ]
        );
        const importId = importRes.rows[0].id;

        for (const song of parsedSongs) {
          // 3. Duplicate check by canonical_title
          const existingRes = await client.query(
            'SELECT id, display_title FROM songs WHERE canonical_title = $1',
            [song.canonical_title]
          );

          if (existingRes.rows.length > 0) {
            console.log(`${prefix} -> Skipped (Already exists: "${existingRes.rows[0].display_title}")`);
            totalSkippedDuplicates++;
            continue;
          }

          // 4. Insert canonical song
          const songRes = await client.query(
            `INSERT INTO songs 
              (canonical_title, display_title, ministry_or_artist, song_type, types, approval_status, import_id)
             VALUES ($1, $2, $3, $4, $5, 'pending_review', $6)
             RETURNING id`,
            [
              song.canonical_title,
              song.display_title,
              song.ministry_or_artist,
              task.type,
              [task.type],
              importId,
            ]
          );
          const songId = songRes.rows[0].id;
          totalInsertedSongs++;

          // 5. Insert version
          const versionRes = await client.query(
            `INSERT INTO song_versions 
              (song_id, language, version_title)
             VALUES ($1, 'vi', $2)
             RETURNING id`,
            [songId, song.display_title]
          );
          const versionId = versionRes.rows[0].id;

          // 6. Insert sections
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
            totalInsertedSections++;
          }

          console.log(`${prefix} -> Inserted "${song.display_title}" (${song.sections.length} sections)`);
        }

        await client.query('COMMIT');
      } catch (fileErr: any) {
        await client.query('ROLLBACK');
        console.error(`${prefix} -> FAILED:`, fileErr.message);
        totalErrors++;
      }
    }

    console.log('\n=============================================');
    console.log('BULK IMPORT SUMMARY:');
    console.log(`- Total files processed:    ${tasks.length}`);
    console.log(`- Songs inserted:           ${totalInsertedSongs}`);
    console.log(`- Sections created:         ${totalInsertedSections}`);
    console.log(`- Duplicates skipped:       ${totalSkippedDuplicates}`);
    console.log(`- Errors / Unsupported:     ${totalErrors}`);
    console.log('=============================================\n');

  } catch (err) {
    console.error('Fatal error during import:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

importAllSongs();
