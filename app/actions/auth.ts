'use server';

import db from '@/lib/db';
import { signToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function login(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Email and password are required' };
  }

  let rows;
  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    rows = result.rows;
  } catch (err: any) {
    return { error: 'DB Connection Error: ' + err.message + ' (Check Vercel Environment Variables)' };
  }

  const user = rows[0] as any;

  if (!user || user.password !== password) {
    return { error: 'Invalid email or password' };
  }

  if (user.status !== 'ACTIVE') {
    return { error: 'Account is disabled' };
  }

  let token;
  try {
    token = await signToken({
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
  } catch (err: any) {
    return { error: 'Token/Cookie Error: ' + err.message };
  }

  if (user.role === 'ADMIN') {
    redirect('/admin');
  } else {
    redirect('/schedule');
  }
}

export async function register(formData: FormData) {
  const fullName = formData.get('fullName') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  if (!fullName || !email || !password || !confirmPassword) {
    return { error: 'All fields are required' };
  }

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match' };
  }

  const { rows: existingRows } = await db.query('SELECT id FROM users WHERE email = $1', [email]);
  const existingUser = existingRows[0];

  if (existingUser) {
    return { error: 'Email already exists' };
  }

  const id = `u_${Date.now()}`;
  
  try {
    await db.query(
      'INSERT INTO users (id, full_name, email, password, role) VALUES ($1, $2, $3, $4, $5)',
      [id, fullName, email, password, 'USER']
    );
  } catch (error) {
    return { error: 'Failed to create account' };
  }

  const token = await signToken({
    id,
    email,
    role: 'USER',
    name: fullName,
    avatarUrl: null
  });

  const cookieStore = await cookies();
  cookieStore.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 1 day
  });

  redirect('/schedule');
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete('auth-token');
  redirect('/');
}
