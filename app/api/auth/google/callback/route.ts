import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { signToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  
  const baseUrl = process.env.APP_URL || 'http://localhost:3000';

  if (error) {
    return NextResponse.redirect(`${baseUrl}/login?error=Google_OAuth_Error`);
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/login?error=No_Code_Provided`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${baseUrl}/login?error=Server_Configuration_Error`);
  }

  try {
    // 1. Exchange code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Google token error:', tokenData);
      return NextResponse.redirect(`${baseUrl}/login?error=Google_Token_Error`);
    }

    // 2. Fetch user profile
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const profileData = await profileResponse.json();

    if (!profileResponse.ok) {
      console.error('Google profile error:', profileData);
      return NextResponse.redirect(`${baseUrl}/login?error=Google_Profile_Error`);
    }

    const { sub: googleId, email, name: fullName, picture } = profileData;

    // 3. Find or Create User
    const { rows } = await db.query('SELECT * FROM users WHERE google_id = $1 OR email = $2', [googleId, email]);
    let user = rows[0] as any;

    if (user) {
      // User exists. Update google_id if missing (e.g. they registered via email first, now logged in via Google)
      if (!user.google_id) {
        await db.query('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, user.id]);
      }
      
      // Update avatar if missing
      if (!user.avatar_url && picture) {
        await db.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [picture, user.id]);
        user.avatar_url = picture;
      }
      
      if (user.status !== 'ACTIVE') {
        return NextResponse.redirect(`${baseUrl}/login?error=Account_Disabled`);
      }
    } else {
      // Create new user
      const id = `u_${Date.now()}`;
      await db.query(
        'INSERT INTO users (id, full_name, email, password, google_id, role, avatar_url) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [id, fullName, email, null, googleId, 'USER', picture || null]
      );
      
      user = {
        id,
        email,
        role: 'USER',
        full_name: fullName,
        avatar_url: picture || null
      };
    }

    // 4 & 5. Create Session and Redirect
    const token = await signToken({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.full_name,
      avatarUrl: user.avatar_url
    });

    const response = NextResponse.redirect(new URL('/schedule', request.url));
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 1 day
    });

    return response;

  } catch (err) {
    console.error('OAuth flow exception:', err);
    return NextResponse.redirect(`${baseUrl}/login?error=Internal_Server_Error`);
  }
}
