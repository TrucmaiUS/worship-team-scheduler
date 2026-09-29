import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${baseUrl}/api/auth/google/callback`;
  
  if (!clientId) {
    console.error('Missing GOOGLE_CLIENT_ID');
    // For development/demo purposes without keys, redirect back with error
    return NextResponse.redirect(`${baseUrl}/login?error=Google_OAuth_Not_Configured`);
  }

  const searchParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account'
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${searchParams.toString()}`;
  return NextResponse.redirect(url);
}
