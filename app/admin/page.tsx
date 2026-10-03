import { getSession } from '@/lib/auth';
import db from '@/lib/db';
import { redirect } from 'next/navigation';
import AdminDashboardClient from './AdminDashboardClient';
import { AddEventButton } from '@/components/admin/AddEventButton';

export default async function AdminPage() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    redirect('/login');
  }

  let services, users, registrations;
  try {
    const [resServices, resUsers, resRegs] = await Promise.all([
      db.query('SELECT * FROM services ORDER BY date ASC, start_time ASC'),
      db.query('SELECT id, full_name, email, role FROM users'),
      db.query('SELECT * FROM registrations')
    ]);
    
    services = resServices.rows;
    users = resUsers.rows;
    registrations = resRegs.rows;
  } catch (err: any) {
    return (
      <div className="p-8 text-red-500 font-bold text-2xl">
        FATAL ADMIN ERROR: {err.message}
      </div>
    );
  }

  // Stats
  const stats = {
    services: services.length,
    members: users.length,
    registrations: registrations.length,
  };

  // Build grid data for services
  const gridData = services.map((s: any) => {
    const serviceRegs = registrations.filter((r: any) => r.service_id === s.id);
    return {
      ...s,
      sound: serviceRegs.filter((r: any) => r.team === 'SOUND').map((r: any) => { const u = users.find((u: any) => u.id === r.user_id); return u ? { ...u, role_detail: r.role_detail } : null; }).filter(Boolean),
      singer: serviceRegs.filter((r: any) => r.team === 'SINGER').map((r: any) => { const u = users.find((u: any) => u.id === r.user_id); return u ? { ...u, role_detail: r.role_detail } : null; }).filter(Boolean),
      musician: serviceRegs.filter((r: any) => r.team === 'MUSICIAN').map((r: any) => { const u = users.find((u: any) => u.id === r.user_id); return u ? { ...u, role_detail: r.role_detail } : null; }).filter(Boolean),
    };
  });

  return (
    <div className="min-h-screen flex flex-col bg-brand-cream">
      <main className="flex-1 container mx-auto px-4 py-8 pb-32">
        <div className="mb-8 border-b-8 border-brand-black pb-4">
          <h1 className="editorial-heading text-4xl text-brand-blue mb-2">ADMIN DASHBOARD</h1>
          <p className="font-bold uppercase tracking-widest text-brand-black/60">Manage Services & Teams</p>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-12">
          <div className="bg-brand-white border-2 sm:border-4 border-brand-black p-2 sm:p-4 text-center shadow-[2px_2px_0_0_#0038FF] sm:shadow-[4px_4px_0_0_#0038FF]">
            <h3 className="font-bold text-[10px] sm:text-sm uppercase tracking-widest mb-1 sm:mb-2 opacity-70 truncate">Services</h3>
            <p className="editorial-heading text-2xl sm:text-4xl">{stats.services}</p>
          </div>
          <div className="bg-brand-white border-2 sm:border-4 border-brand-black p-2 sm:p-4 text-center shadow-[2px_2px_0_0_#FF2E93] sm:shadow-[4px_4px_0_0_#FF2E93]">
            <h3 className="font-bold text-[10px] sm:text-sm uppercase tracking-widest mb-1 sm:mb-2 opacity-70 truncate">Members</h3>
            <p className="editorial-heading text-2xl sm:text-4xl">{stats.members}</p>
          </div>
          <div className="bg-brand-white border-2 sm:border-4 border-brand-black p-2 sm:p-4 text-center shadow-[2px_2px_0_0_#111111] sm:shadow-[4px_4px_0_0_#111111]">
            <h3 className="font-bold text-[10px] sm:text-sm uppercase tracking-widest mb-1 sm:mb-2 opacity-70 truncate">Sign-ups</h3>
            <p className="editorial-heading text-2xl sm:text-4xl">{stats.registrations}</p>
          </div>
        </div>

        {/* OVERVIEW GRID */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="editorial-heading text-2xl">SCHEDULE OVERVIEW</h2>
          <AddEventButton />
        </div>
        <AdminDashboardClient gridData={gridData} allUsers={users} />
      </main>
    </div>
  );
}

