'use server';

import db from '@/lib/db';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function joinService(serviceId: string, team: string, roleDetail: string = '') {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  try {
    const userCheck = await db.query(
      'SELECT id FROM registrations WHERE service_id = $1 AND user_id = $2',
      [serviceId, session.id]
    );
    if (userCheck.rows.length > 0) {
      return { error: 'You are already registered for this service!' };
    }

    let roleCheck;
    if (team === 'SOUND') {
      roleCheck = await db.query(
        `SELECT r.id, u.full_name as user_name 
         FROM registrations r 
         JOIN users u ON r.user_id = u.id 
         WHERE r.service_id = $1 AND r.team = 'SOUND' AND r.user_id != $2`,
        [serviceId, session.id]
      );
    } else {
      roleCheck = await db.query(
        `SELECT r.id, u.full_name as user_name 
         FROM registrations r 
         JOIN users u ON r.user_id = u.id 
         WHERE r.service_id = $1 AND r.team = $2 AND LOWER(COALESCE(r.role_detail, '')) = LOWER($3) AND r.user_id != $4`,
        [serviceId, team, roleDetail, session.id]
      );
    }

    if (roleCheck.rows.length > 0) {
      const existingUser = roleCheck.rows[0].user_name;
      const roleName = roleDetail || (team === 'SOUND' ? 'Sound Team' : team);
      return { error: `${roleName} is already taken by ${existingUser}!` };
    }

    const id = `r_${Date.now()}`;
    await db.query(
      'INSERT INTO registrations (id, service_id, user_id, team, role_detail) VALUES ($1, $2, $3, $4, $5)',
      [id, serviceId, session.id, team, roleDetail]
    );
    revalidatePath('/schedule');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to register' };
  }
}

export async function changeRole(serviceId: string, newTeam: string, roleDetail: string = '') {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  try {
    let roleCheck;
    if (newTeam === 'SOUND') {
      roleCheck = await db.query(
        `SELECT r.id, u.full_name as user_name 
         FROM registrations r 
         JOIN users u ON r.user_id = u.id 
         WHERE r.service_id = $1 AND r.team = 'SOUND' AND r.user_id != $2`,
        [serviceId, session.id]
      );
    } else {
      roleCheck = await db.query(
        `SELECT r.id, u.full_name as user_name 
         FROM registrations r 
         JOIN users u ON r.user_id = u.id 
         WHERE r.service_id = $1 AND r.team = $2 AND LOWER(COALESCE(r.role_detail, '')) = LOWER($3) AND r.user_id != $4`,
        [serviceId, newTeam, roleDetail, session.id]
      );
    }

    if (roleCheck.rows.length > 0) {
      const existingUser = roleCheck.rows[0].user_name;
      const roleName = roleDetail || (newTeam === 'SOUND' ? 'Sound Team' : newTeam);
      return { error: `${roleName} is already taken by ${existingUser}!` };
    }

    await db.query(
      'UPDATE registrations SET team = $1, role_detail = $4 WHERE service_id = $2 AND user_id = $3',
      [newTeam, serviceId, session.id, roleDetail]
    );
    revalidatePath('/schedule');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to update' };
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
    return { success: true };
  } catch (err) {
    return { error: 'Failed to cancel' };
  }
}
