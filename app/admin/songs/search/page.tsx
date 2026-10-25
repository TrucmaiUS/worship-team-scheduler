import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import SearchPlaygroundClient from './SearchPlaygroundClient';

export default async function AdminSongSearchPage() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    redirect('/login');
  }

  return <SearchPlaygroundClient />;
}
