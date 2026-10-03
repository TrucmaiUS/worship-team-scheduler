'use server';

import { getSession } from '@/lib/auth';
import db from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function addService(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return { error: 'Unauthorized' };
  }

  const title = formData.get('title') as string;
  const date = formData.get('date') as string;
  const start_time = formData.get('start_time') as string;
  const end_time = formData.get('end_time') as string;

  if (!title || !date || !start_time || !end_time) {
    return { error: 'Please fill in all required fields' };
  }

  try {
    const id = `s_${Date.now()}`;
    await db.query(
      'INSERT INTO services (id, title, date, start_time, end_time) VALUES ($1, $2, $3, $4, $5)',
      [id, title, date, start_time, end_time]
    );

    revalidatePath('/admin');
    revalidatePath('/schedule');
    revalidatePath('/');
    
    return { success: true };
  } catch (err: any) {
    return { error: 'Database Error: ' + err.message };
  }
}
