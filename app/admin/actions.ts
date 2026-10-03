'use server';

import db from '@/lib/db';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function adminAssignMember(serviceId: string, userId: string, team: string, roleDetail: string | null = null) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return { error: 'Unauthorized' };

  try {
    const check = await db.query('SELECT * FROM registrations WHERE service_id = $1 AND user_id = $2', [serviceId, userId]);
    if (check.rows.length > 0) {
      return { error: 'Thành viên này đã được phân công trong buổi này rồi!' };
    }

    const id = `r_${Date.now()}`;
    await db.query(
      'INSERT INTO registrations (id, service_id, user_id, team, role_detail) VALUES ($1, $2, $3, $4, $5)',
      [id, serviceId, userId, team, roleDetail]
    );
    revalidatePath('/admin');
    revalidatePath('/schedule');
    return { success: true };
  } catch (err) {
    return { error: 'Failed to assign member' };
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

export async function adminDeleteUser(userId: string) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return { error: 'Unauthorized' };

  try {
    // Delete their registrations first (just in case no cascade)
    await db.query('DELETE FROM registrations WHERE user_id = $1', [userId]);
    // Then delete user
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
    
    revalidatePath('/admin');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to delete user' };
  }
}
