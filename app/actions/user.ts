'use server';

import { getSession } from '@/lib/auth';
import { signToken } from '@/lib/auth';
import db from '@/lib/db';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function uploadAvatar(formData: FormData) {
  const session = await getSession();
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const file = formData.get('avatar') as File;
  if (!file || file.size === 0) {
    return { error: 'No file uploaded' };
  }

  const ext = file.name.split('.').pop();
  const filename = `${session.id}_${Date.now()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('avatars')
    .upload(filename, buffer, {
      contentType: file.type,
      upsert: true
    });

  if (error) {
    return { error: 'Upload to storage failed: ' + error.message };
  }

  const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filename);
  const avatarUrl = publicUrlData.publicUrl;

  // Update DB
  await db.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatarUrl, session.id]);

  // Re-issue JWT with new avatarUrl
  const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [session.id]);
  const user = rows[0] as any;
  const token = await signToken({
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.full_name,
    avatarUrl: user.avatar_url
  });

  const cookieStore = await cookies();
  cookieStore.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 1 day
  });

  revalidatePath('/');
  revalidatePath('/profile');
  revalidatePath('/schedule');
  
  return { success: true, avatarUrl };
}
