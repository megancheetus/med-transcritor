import { redirect } from 'next/navigation';
import { getAuthenticatedUserFromCookies } from '@/lib/authSession';

export default async function Home() {
  const user = await getAuthenticatedUserFromCookies();

  if (!user) {
    redirect('/login-escolha');
  }

  redirect('/dashboard');
}
