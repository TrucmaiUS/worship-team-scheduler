import { getSession } from '@/lib/auth';
import db from '@/lib/db';
import { redirect } from 'next/navigation';
import { startOfMonth, endOfMonth, addMonths, format } from 'date-fns';
import ClientSchedule from './ClientSchedule';

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ offset?: string }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect('/register');
  }

  const params = await searchParams;
  const offset = parseInt(params.offset || '0', 10);
  
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  
  // 1. Fetch Upcoming Services (Next 14 days)
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 14);
  const upcomingEndStr = format(endDate, 'yyyy-MM-dd');

  const currentMonthStart = addMonths(startOfMonth(today), offset);
  const currentMonthEnd = endOfMonth(currentMonthStart);
  
  const startStr = format(currentMonthStart, 'yyyy-MM-dd');
  const monthEndStr = format(currentMonthEnd, 'yyyy-MM-dd');

  let upcomingServices = [];
  let monthlyServices = [];
  let registrationsMap: Record<string, any[]> = {};

  try {
    const resUpcoming = await db.query(`
      SELECT * FROM services 
      WHERE date >= $1 AND date <= $2
      ORDER BY date ASC, start_time ASC
    `, [todayStr, upcomingEndStr]);
    upcomingServices = resUpcoming.rows;

    const resMonthly = await db.query(`
      SELECT * FROM services 
      WHERE date >= $1 AND date <= $2
      ORDER BY date ASC, start_time ASC
    `, [startStr, monthEndStr]);
    monthlyServices = resMonthly.rows;

    const allServices = [...upcomingServices, ...monthlyServices];
    const uniqueServiceIds = Array.from(new Set(allServices.map(s => s.id)));
    
    if (uniqueServiceIds.length > 0) {
      const idsString = uniqueServiceIds.map((_, i) => `$${i + 1}`).join(',');
      const { rows: registrations } = await db.query(`
        SELECT r.service_id, r.team, r.user_id, u.full_name as user_name
        FROM registrations r
        JOIN users u ON r.user_id = u.id
        WHERE r.service_id IN (${idsString})
      `, uniqueServiceIds);

      for (const id of uniqueServiceIds) {
        registrationsMap[id] = registrations.filter((r: any) => r.service_id === id);
      }
    }
  } catch (err: any) {
    return <div className="p-8 text-red-500 font-bold text-2xl">FATAL SCHEDULE ERROR: {err.message}</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-brand-cream">
      <main className="flex-1 container mx-auto px-4 py-8">
        <ClientSchedule 
          upcomingServices={upcomingServices}
          monthlyServices={monthlyServices} 
          registrationsMap={registrationsMap} 
          userId={session.id} 
          userName={(session as any).full_name}
          avatarUrl={(session as any).avatarUrl}
          offset={offset}
          currentMonthDate={currentMonthStart.toISOString()}
        />
      </main>
    </div>
  );
}
