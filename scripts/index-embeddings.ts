import { Pool } from 'pg';
import { getActiveEmbeddingProvider, computeChunkHash } from '../lib/search/embedding-service';

async function embedWithRetry(provider: any, text: string): Promise<number[]> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const vec = await provider.embedText(text);
      // Stay safely below the 100 requests/min free tier rate limit
      await new Promise((r) => setTimeout(r, 650));
      return vec;
    } catch (err: any) {
      if (err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED')) {
        console.log(`\nGoogle Rate limit (100 RPM limit). Waiting 20s before retry (attempt ${attempt}/5)...`);
        await new Promise((r) => setTimeout(r, 20000));
      } else {
        throw err;
      }
    }
  }
  throw new Error('Max retries exceeded for embedding');
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const provider = getActiveEmbeddingProvider();
  console.log(`Starting catalog embedding indexation...`);
  console.log(`Provider: ${provider.name} (${provider.dimension} dimensions)`);

  try {
    // 1. Fetch all songs
    const songsRes = await pool.query(`
      SELECT s.id, s.canonical_title, s.display_title, s.ministry_or_artist, s.song_type
      FROM songs s
      ORDER BY s.canonical_title;
    `);

    console.log(`Found ${songsRes.rows.length} songs in database.`);

    // 2. Fetch all sections
    const sectionsRes = await pool.query(`
      SELECT ss.id, ss.version_id, sv.song_id, ss.section_type, ss.section_label, ss.section_order, ss.lyrics_text,
             s.display_title
      FROM song_sections ss
      JOIN song_versions sv ON ss.version_id = sv.id
      JOIN songs s ON sv.song_id = s.id
      ORDER BY s.id, ss.section_order;
    `);

    console.log(`Found ${sectionsRes.rows.length} sections across songs.`);

    // 3. Check existing content hashes in song_embeddings for this model
    const existingHashesRes = await pool.query(
      `SELECT content_hash FROM song_embeddings WHERE model_name = $1`,
      [provider.name]
    );
    const existingHashes = new Set<string>(existingHashesRes.rows.map((r) => r.content_hash));
    console.log(`Found ${existingHashes.size} already indexed embedding records.`);

    let indexedSections = 0;
    let skippedSections = 0;
    let indexedSongs = 0;
    let skippedSongs = 0;

    // 4. Index sections
    console.log(`\nIndexing sections...`);
    for (const sec of sectionsRes.rows) {
      const chunkText = `Song: ${sec.display_title}\nSection: [${sec.section_label}]\n${sec.lyrics_text}`.trim();
      const hash = computeChunkHash(chunkText);

      if (existingHashes.has(hash)) {
        skippedSections++;
        continue;
      }

      const vec = await embedWithRetry(provider, chunkText);
      const vecStr = `[${vec.join(',')}]`;

      await pool.query(
        `INSERT INTO song_embeddings (target_type, song_id, section_id, model_name, dimension, content_hash, chunk_text, embedding)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector)`,
        ['section', sec.song_id, sec.id, provider.name, provider.dimension, hash, chunkText, vecStr]
      );

      existingHashes.add(hash);
      indexedSections++;
      if (indexedSections % 25 === 0) {
        process.stdout.write(`Indexed ${indexedSections} sections...\r`);
      }
    }
    console.log(`\nSections indexation complete: ${indexedSections} new indexed, ${skippedSections} cached.`);

    // 5. Index whole songs (Title + Artist + Aggregated lyrics)
    console.log(`\nIndexing whole songs...`);
    // Group sections by song_id
    const songSectionsMap = new Map<string, string[]>();
    for (const sec of sectionsRes.rows) {
      const list = songSectionsMap.get(sec.song_id) || [];
      list.push(`[${sec.section_label}]\n${sec.lyrics_text}`);
      songSectionsMap.set(sec.song_id, list);
    }

    for (const song of songsRes.rows) {
      const lyricsArr = songSectionsMap.get(song.id) || [];
      const chunkText = `Song: ${song.display_title}\nArtist: ${song.ministry_or_artist || 'Unknown'}\nLyrics:\n${lyricsArr.join('\n\n')}`.trim();
      const hash = computeChunkHash(chunkText);

      if (existingHashes.has(hash)) {
        skippedSongs++;
        continue;
      }

      const vec = await embedWithRetry(provider, chunkText);
      const vecStr = `[${vec.join(',')}]`;

      await pool.query(
        `INSERT INTO song_embeddings (target_type, song_id, section_id, model_name, dimension, content_hash, chunk_text, embedding)
         VALUES ($1, $2, NULL, $3, $4, $5, $6, $7::vector)`,
        ['song', song.id, provider.name, provider.dimension, hash, chunkText, vecStr]
      );

      existingHashes.add(hash);
      indexedSongs++;
    }
    console.log(`Songs indexation complete: ${indexedSongs} new indexed, ${skippedSongs} cached.`);

    console.log(`\nAll catalog embeddings successfully synced to PostgreSQL pgvector!`);
  } catch (err) {
    console.error('Error indexing embeddings:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
