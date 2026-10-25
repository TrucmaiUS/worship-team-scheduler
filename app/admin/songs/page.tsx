import { getSession } from '@/lib/auth';
import db from '@/lib/db';
import { redirect } from 'next/navigation';
import SongsManagerClient from './SongsManagerClient';

export default async function AdminSongsPage() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    redirect('/login');
  }

  let songs = [];
  let availableTypes = [];
  let recentImports = [];

  try {
    const [songsRes, typesRes, importsRes] = await Promise.all([
      db.query(`
        SELECT 
          s.id, 
          s.canonical_title, 
          s.display_title, 
          s.ministry_or_artist, 
          s.song_type,
          COALESCE(s.types, ARRAY[COALESCE(s.song_type, 'worship')]) as types,
          s.approval_status, 
          s.created_at,
          COALESCE((
            SELECT COUNT(ss.id) 
            FROM song_sections ss 
            JOIN song_versions sv ON ss.version_id = sv.id 
            WHERE sv.song_id = s.id
          ), 0)::int as section_count
        FROM songs s
        ORDER BY s.created_at DESC
      `),
      db.query(`
        SELECT id, name, slug, color 
        FROM song_types 
        ORDER BY created_at ASC
      `),
      db.query(`
        SELECT 
          id, file_name, file_hash, status, detected_count, 
          imported_count, duplicate_count, needs_review_count, created_at
        FROM document_imports
        ORDER BY created_at DESC
        LIMIT 5
      `),
    ]);

    songs = songsRes.rows;
    availableTypes = typesRes.rows;
    recentImports = importsRes.rows;
  } catch (err: any) {
    console.error('Error fetching data for songs management:', err);
  }

  return (
    <SongsManagerClient 
      initialSongs={songs} 
      initialTypes={availableTypes}
      recentImports={recentImports} 
    />
  );
}
