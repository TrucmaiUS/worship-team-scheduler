import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/auth';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value;
  let session = null;
  
  if (token) {
    session = await verifyToken(token);
  }

  const { pathname } = request.nextUrl;

  // Protect /admin routes
  if (pathname.startsWith('/admin')) {
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Protect /schedule and /profile routes
  if (pathname.startsWith('/schedule') || pathname.startsWith('/profile')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Prevent logged in users from visiting login/register
  if (pathname === '/login' || pathname === '/register') {
    if (session) {
      if (session.role === 'ADMIN') {
        return NextResponse.redirect(new URL('/admin', request.url));
      }
      return NextResponse.redirect(new URL('/schedule', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/schedule/:path*', '/profile/:path*', '/login', '/register'],
};
