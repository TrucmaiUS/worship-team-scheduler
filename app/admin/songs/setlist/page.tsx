import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import SetlistGeneratorClient from '@/components/admin/SetlistGeneratorClient';

export default async function AdminSetlistPage() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    redirect('/login');
  }

  return <SetlistGeneratorClient />;
}
