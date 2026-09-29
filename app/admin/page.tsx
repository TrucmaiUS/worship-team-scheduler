import { getSession } from '@/lib/auth';
import db from '@/lib/db';
import { redirect } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import AdminDashboardClient from './AdminDashboardClient';

export default async function AdminPage() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    redirect('/login');
  }

  const services = db.prepare('SELECT * FROM services ORDER BY date ASC, start_time ASC').all() as any[];
  const users = db.prepare('SELECT id, full_name, email, role FROM users').all() as any[];
  const registrations = db.prepare('SELECT * FROM registrations').all() as any[];

  // Stats
  const stats = {
    services: services.length,
    members: users.length,
    registrations: registrations.length,
  };

  // Build grid data for services
  const gridData = services.map(s => {
    const serviceRegs = registrations.filter(r => r.service_id === s.id);
    return {
      ...s,
      sound: serviceRegs.filter(r => r.team === 'SOUND').map(r => users.find(u => u.id === r.user_id)),
      singer: serviceRegs.filter(r => r.team === 'SINGER').map(r => users.find(u => u.id === r.user_id)),
      musician: serviceRegs.filter(r => r.team === 'MUSICIAN').map(r => users.find(u => u.id === r.user_id)),
    };
  });

  return (
    <div className="min-h-screen flex flex-col bg-brand-cream">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-8 border-b-8 border-brand-black pb-4">
          <h1 className="editorial-heading text-4xl text-brand-blue mb-2">ADMIN DASHBOARD</h1>
          <p className="font-bold uppercase tracking-widest text-brand-black/60">Manage Services & Teams</p>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-12">
          <div className="bg-brand-white border-4 border-brand-black p-4 text-center shadow-[4px_4px_0_0_#0038FF]">
            <h3 className="font-bold text-sm uppercase tracking-widest mb-2 opacity-70">Services</h3>
            <p className="editorial-heading text-4xl">{stats.services}</p>
          </div>
          <div className="bg-brand-white border-4 border-brand-black p-4 text-center shadow-[4px_4px_0_0_#FF2E93]">
            <h3 className="font-bold text-sm uppercase tracking-widest mb-2 opacity-70">Members</h3>
            <p className="editorial-heading text-4xl">{stats.members}</p>
          </div>
          <div className="bg-brand-white border-4 border-brand-black p-4 text-center shadow-[4px_4px_0_0_#111111]">
            <h3 className="font-bold text-sm uppercase tracking-widest mb-2 opacity-70">Registrations</h3>
            <p className="editorial-heading text-4xl">{stats.registrations}</p>
          </div>
        </div>

        {/* OVERVIEW GRID */}
        <h2 className="editorial-heading text-2xl mb-4">SCHEDULE OVERVIEW</h2>
        <AdminDashboardClient gridData={gridData} allUsers={users} />
      </main>
      <Footer />
    </div>
  );
}
