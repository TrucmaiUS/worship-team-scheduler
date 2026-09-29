'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { register } from '@/app/actions/auth';

export default function RegisterPage() {
  const [error, setError] = useState('');

  async function handleSubmit(formData: FormData) {
    const res = await register(formData);
    if (res?.error) {
      setError(res.error);
    }
  }

  return (
    <>
      <main className="flex-1 flex items-center justify-center checkerboard-pastel p-4 min-h-[calc(100vh-64px)] py-12">
        <div className="w-full max-w-md bg-brand-white border-8 border-brand-black shadow-[12px_12px_0_0_#111111] p-8">
          <div className="text-center mb-8">
            <h1 className="editorial-heading text-4xl text-brand-blue mb-2">JOIN TEAM</h1>
            <p className="font-bold text-brand-black/70 uppercase tracking-widest text-sm">Create your account</p>
          </div>

          <form action={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-brand-red text-brand-white p-3 border-2 border-brand-black font-bold text-sm">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <label className="block font-bold uppercase tracking-widest text-sm">Full Name</label>
              <input 
                type="text" 
                name="fullName" 
                required
                className="w-full border-4 border-brand-black p-3 font-bold focus:outline-none focus:ring-4 focus:ring-brand-pink/30"
              />
            </div>

            <div className="space-y-2">
              <label className="block font-bold uppercase tracking-widest text-sm">Email</label>
              <input 
                type="email" 
                name="email" 
                required
                className="w-full border-4 border-brand-black p-3 font-bold focus:outline-none focus:ring-4 focus:ring-brand-pink/30"
              />
            </div>
            
            <div className="space-y-2">
              <label className="block font-bold uppercase tracking-widest text-sm">Password</label>
              <input 
                type="password" 
                name="password" 
                required
                className="w-full border-4 border-brand-black p-3 font-bold focus:outline-none focus:ring-4 focus:ring-brand-pink/30"
              />
            </div>

            <div className="space-y-2">
              <label className="block font-bold uppercase tracking-widest text-sm">Confirm Password</label>
              <input 
                type="password" 
                name="confirmPassword" 
                required
                className="w-full border-4 border-brand-black p-3 font-bold focus:outline-none focus:ring-4 focus:ring-brand-pink/30"
              />
            </div>

            <Button type="submit" variant="secondary" className="w-full h-14 text-lg mt-4">
              Sign Up
            </Button>

            <div className="relative flex items-center py-2 mt-4">
              <div className="flex-grow border-t-4 border-dashed border-brand-black/20"></div>
              <span className="flex-shrink-0 mx-4 font-bold text-sm text-brand-black/50 uppercase tracking-widest">or</span>
              <div className="flex-grow border-t-4 border-dashed border-brand-black/20"></div>
            </div>
            
            <a href="/api/auth/google" className="w-full h-14 text-lg bg-brand-white border-4 border-brand-black font-bold flex items-center justify-center hover:bg-brand-cream shadow-[4px_4px_0_0_#111111] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#111111] transition-all">
              <svg className="w-6 h-6 mr-3" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign up with Google
            </a>
          </form>

          <div className="mt-8 text-center">
            <p className="font-bold text-sm">
              Already have an account?{' '}
              <Link href="/login" className="text-brand-pink hover:text-brand-blue underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
