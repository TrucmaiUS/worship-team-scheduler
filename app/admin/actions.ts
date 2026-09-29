'use server';

import db from '@/lib/db';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function adminAssignMember(serviceId: string, userId: string, team: string) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return { error: 'Unauthorized' };

  try {
    const id = `r_${Date.now()}`;
    const stmt = db.prepare('INSERT INTO registrations (id, service_id, user_id, team) VALUES (?, ?, ?, ?)');
    stmt.run(id, serviceId, userId, team);
    revalidatePath('/admin');
    revalidatePath('/schedule');
    return { success: true };
  } catch (err) {
    return { error: 'Failed or already registered' };
  }
}

export async function adminRemoveAssignment(serviceId: string, userId: string) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return { error: 'Unauthorized' };

  try {
    const stmt = db.prepare('DELETE FROM registrations WHERE service_id = ? AND user_id = ?');
    stmt.run(serviceId, userId);
    revalidatePath('/admin');
    revalidatePath('/schedule');
    return { success: true };
  } catch (err) {
    return { error: 'Failed to remove' };
  }
}
