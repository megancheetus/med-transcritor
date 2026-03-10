import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import TranscriberPage from '@/components/TranscriberPage';

export default async function Home() {
  const cookieStore = await cookies();
  const authToken = cookieStore.get('auth_token')?.value;

  if (authToken !== 'authenticated') {
    redirect('/login');
  }

  return <TranscriberPage />;
}
