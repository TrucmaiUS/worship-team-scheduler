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
      return { error: 'This member is already assigned to this service!' };
    }

    let roleCheck;
    if (team === 'SOUND') {
      roleCheck = await db.query(
        `SELECT r.id, u.full_name as user_name 
         FROM registrations r 
         JOIN users u ON r.user_id = u.id 
         WHERE r.service_id = $1 AND r.team = 'SOUND' AND r.user_id != $2`,
        [serviceId, userId]
      );
    } else {
      roleCheck = await db.query(
        `SELECT r.id, u.full_name as user_name 
         FROM registrations r 
         JOIN users u ON r.user_id = u.id 
         WHERE r.service_id = $1 AND r.team = $2 AND LOWER(COALESCE(r.role_detail, '')) = LOWER($3) AND r.user_id != $4`,
        [serviceId, team, roleDetail || '', userId]
      );
    }

    if (roleCheck.rows.length > 0) {
      const existingUser = roleCheck.rows[0].user_name;
      const roleName = roleDetail || (team === 'SOUND' ? 'Sound Team' : team);
      return { error: `${roleName} is already assigned to ${existingUser}!` };
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

export async function adminDeleteService(serviceId: string) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return { error: 'Unauthorized' };

  try {
    await db.query('DELETE FROM registrations WHERE service_id = $1', [serviceId]);
    await db.query('DELETE FROM services WHERE id = $1', [serviceId]);
    
    revalidatePath('/admin');
    revalidatePath('/schedule');
    revalidatePath('/');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to delete service' };
  }
}

