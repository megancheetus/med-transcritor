import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isValidAuthToken } from '@/lib/auth';

export default async function Home() {
  const cookieStore = await cookies();
  const authToken = cookieStore.get('auth_token')?.value;

  if (!(await isValidAuthToken(authToken))) {
    redirect('/login');
  }

  redirect('/dashboard');
}
