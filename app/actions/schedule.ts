'use server';

import db from '@/lib/db';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function joinService(serviceId: string, team: string, roleDetail: string = '') {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  try {
    const id = `r_${Date.now()}`;
    await db.query(
      'INSERT INTO registrations (id, service_id, user_id, team, role_detail) VALUES ($1, $2, $3, $4, $5)',
      [id, serviceId, session.id, team, roleDetail]
    );
    revalidatePath('/schedule');
    revalidatePath('/admin');
    return { success: true };
  } catch (err) {
    return { error: 'You are already registered for this service.' };
  }
}

export async function changeRole(serviceId: string, newTeam: string, roleDetail: string = '') {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  try {
    await db.query(
      'UPDATE registrations SET team = $1, role_detail = $4 WHERE service_id = $2 AND user_id = $3',
      [newTeam, serviceId, session.id, roleDetail]
    );
    revalidatePath('/schedule');
    revalidatePath('/admin');
    return { success: true };
  } catch (err) {
    return { error: 'Failed to update' };
  }
}

export async function cancelRegistration(serviceId: string) {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  try {
    await db.query(
      'DELETE FROM registrations WHERE service_id = $1 AND user_id = $2',
      [serviceId, session.id]
    );
    revalidatePath('/schedule');
    revalidatePath('/admin');
    return { success: true };
  } catch (err) {
    return { error: 'Failed to cancel' };
  }
}
