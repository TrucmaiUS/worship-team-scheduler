import { getSession } from '@/lib/auth';
import db from '@/lib/db';
import { redirect } from 'next/navigation';
import { logout } from '@/app/actions/auth';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { AvatarUploadForm } from '@/components/ui/AvatarUploadForm';
import { uploadAvatar } from '@/app/actions/user';

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  let user;
  let history = [];
  try {
    const { rows: userRows } = await db.query('SELECT * FROM users WHERE id = $1', [session.id]);
    user = userRows[0] as any;
    const resHistory = await db.query(`
      SELECT r.team, s.title, s.date, s.start_time 
      FROM registrations r
      JOIN services s ON r.service_id = s.id
      WHERE r.user_id = $1
      ORDER BY s.date DESC
    `, [session.id]);
    history = resHistory.rows;
  } catch (err: any) {
    return <div className="p-8 text-red-500 font-bold text-2xl">FATAL PROFILE ERROR: {err.message}</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-brand-cream">
      <main className="flex-1 container mx-auto px-4 py-12 pb-32">
        <div className="max-w-2xl mx-auto">
          <div className="bg-brand-white border-8 border-brand-black shadow-[12px_12px_0_0_#FF2E93] p-8 mb-12 transform rotate-1 flex flex-col md:flex-row gap-8 items-start">
            <div className="flex flex-col items-center gap-4 w-full md:w-auto">
              <Avatar name={user.full_name} imgUrl={user.avatar_url} className="w-32 h-32 text-4xl shadow-[4px_4px_0_0_#111111]" />
              <AvatarUploadForm uploadAction={uploadAvatar} />
            </div>
            <div className="flex-1 w-full">
              <h1 className="editorial-heading text-4xl text-brand-black mb-6">PROFILE</h1>
            
            <div className="space-y-4 font-bold text-sm mb-8">
              <div className="border-b-4 border-brand-black pb-2">
                <span className="opacity-50 inline-block w-24 uppercase tracking-widest">Name:</span> 
                <span className="text-xl tracking-normal">{user.full_name}</span>
              </div>
              <div className="border-b-4 border-brand-black pb-2">
                <span className="opacity-50 inline-block w-24 uppercase tracking-widest">Email:</span> 
                <span className="text-base tracking-normal break-all">{user.email}</span>
              </div>
              <div className="border-b-4 border-brand-black pb-2">
                <span className="opacity-50 inline-block w-24 uppercase tracking-widest">Role:</span> 
                <span className="text-xl text-brand-blue uppercase tracking-widest">{user.role}</span>
              </div>
            </div>

            <form action={logout}>
              <Button type="submit" variant="ghost" className="text-brand-red border-2 border-brand-red border-dashed">
                LOGOUT
              </Button>
            </form>
            </div>
          </div>

          <div className="bg-brand-white border-8 border-brand-black shadow-[12px_12px_0_0_#0038FF] p-8 transform -rotate-1">
            <h2 className="editorial-heading text-3xl text-brand-black mb-6">SERVING HISTORY</h2>
            
            {history.length === 0 ? (
              <p className="font-bold opacity-50 text-center py-8">No serving history yet.</p>
            ) : (
              <div className="space-y-4">
                {history.map((h: any, i: any) => (
                  <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-brand-black pb-4 last:border-0">
                    <div>
                      <h3 className="font-bold text-lg">{h.title}</h3>
                      <p className="font-bold opacity-70">{new Date(h.date).toLocaleDateString('en-US', { dateStyle: 'medium' })} • {h.start_time}</p>
                    </div>
                    <div className="mt-2 sm:mt-0 font-bold bg-brand-pink text-brand-white px-3 py-1 border-2 border-brand-black uppercase">
                      {h.team}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
