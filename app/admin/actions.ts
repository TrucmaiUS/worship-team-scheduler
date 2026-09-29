'use server';

import db from '@/lib/db';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function adminAssignMember(serviceId: string, userId: string, team: string) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return { error: 'Unauthorized' };

  try {
    const id = `r_${Date.now()}`;
    await db.query(
      'INSERT INTO registrations (id, service_id, user_id, team) VALUES ($1, $2, $3, $4)',
      [id, serviceId, userId, team]
    );
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
    await db.query(
      'DELETE FROM registrations WHERE service_id = $1 AND user_id = $2',
      [serviceId, userId]
    );
    revalidatePath('/admin');
    revalidatePath('/schedule');
    return { success: true };
  } catch (err) {
    return { error: 'Failed to remove' };
  }
}
