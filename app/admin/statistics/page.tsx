import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function StatisticsPage() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    redirect('/');
  }

  return (
    <div className="min-h-screen flex flex-col bg-brand-cream">
      <main className="flex-1 container mx-auto px-4 py-8 pb-32">
        
        <div className="flex justify-between items-center mb-8">
          <Link href="/admin" className="font-bold uppercase tracking-widest text-brand-black hover:text-brand-pink border-b-2 border-brand-black pb-1">
            &larr; Back to Admin
          </Link>
          <h1 className="editorial-heading text-4xl text-brand-blue">STATISTICS</h1>
        </div>

        <div className="bg-brand-white border-4 border-brand-black p-12 text-center shadow-[8px_8px_0_0_#111111]">
          <div className="text-6xl mb-4">📊</div>
          <h2 className="editorial-heading text-3xl mb-4">Coming Soon</h2>
          <p className="font-bold opacity-70">The statistics module is under construction. Check back later!</p>
        </div>

      </main>
    </div>
  );
}
