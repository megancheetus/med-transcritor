import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getAuthenticatedUserFromCookies } from '@/lib/authSession';

export default async function ProntuarioLayout({ children }: { children: ReactNode }) {
  const user = await getAuthenticatedUserFromCookies();

  if (!user) {
    redirect('/login');
  }

  if (!user.isAdmin && !user.moduleAccess.prontuario) {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
