'use server';

import db from '@/lib/db';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export interface SongTypeItem {
  id: string;
  name: string;
  slug: string;
  color: string;
}

export async function adminGetSongTypes(): Promise<SongTypeItem[]> {
  try {
    const res = await db.query(
      'SELECT id, name, slug, color FROM song_types ORDER BY created_at ASC'
    );
    return res.rows;
  } catch (err) {
    console.error('Error fetching song types:', err);
    return [];
  }
}

export async function adminCreateSongType(name: string): Promise<{ success?: boolean; type?: SongTypeItem; error?: string }> {
  const session = await getSession();
  if (!session || (session as any).role !== 'ADMIN') {
    return { error: 'Unauthorized: Admin access required.' };
  }

  const cleanName = name.trim();
  if (!cleanName) {
    return { error: 'Type name cannot be empty.' };
  }

  const slug = cleanName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug) {
    return { error: 'Invalid type name.' };
  }

  try {
    const colors = ['blue', 'pink', 'purple', 'green', 'amber', 'rose', 'indigo'];
    const chosenColor = colors[Math.floor(Math.random() * colors.length)];

    const res = await db.query(
      `INSERT INTO song_types (name, slug, color) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, name, slug, color`,
      [cleanName, slug, chosenColor]
    );

    revalidatePath('/admin/songs');
    return { success: true, type: res.rows[0] };
  } catch (err: any) {
    return { error: err.message || 'Failed to create song type.' };
  }
}

export async function adminDeleteSongType(id: string): Promise<{ success?: boolean; error?: string }> {
  const session = await getSession();
  if (!session || (session as any).role !== 'ADMIN') {
    return { error: 'Unauthorized: Admin access required.' };
  }

  try {
    await db.query('DELETE FROM song_types WHERE id = $1', [id]);
    revalidatePath('/admin/songs');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to delete song type.' };
  }
}

/**
 * Sets exactly ONE song type (single-select).
 * When a new type is selected, the old type is automatically replaced.
 */
export async function adminSetSongType(songId: string, typeSlug: string) {
  const session = await getSession();
  if (!session || (session as any).role !== 'ADMIN') {
    return { error: 'Unauthorized: Admin access required.' };
  }

  try {
    await db.query(
      `UPDATE songs 
       SET types = ARRAY[$1]::text[], song_type = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [typeSlug, songId]
    );

    revalidatePath('/admin/songs');
    return { success: true, types: [typeSlug], song_type: typeSlug };
  } catch (err: any) {
    return { error: err.message || 'Failed to update song type.' };
  }
}

export async function adminToggleSongApproval(songId: string, newStatus: 'approved' | 'pending_review') {
  const session = await getSession();
  if (!session || (session as any).role !== 'ADMIN') {
    return { error: 'Unauthorized: Admin access required.' };
  }

  try {
    await db.query(
      `UPDATE songs SET approval_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [newStatus, songId]
    );
    revalidatePath('/admin/songs');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to update approval status.' };
  }
}

export async function adminDeleteSong(songId: string) {
  const session = await getSession();
  if (!session || (session as any).role !== 'ADMIN') {
    return { error: 'Unauthorized: Admin access required.' };
  }

  try {
    await db.query('DELETE FROM songs WHERE id = $1', [songId]);
    revalidatePath('/admin/songs');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to delete song.' };
  }
}
