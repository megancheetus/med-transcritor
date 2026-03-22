import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getAuthenticatedUserFromCookies } from '@/lib/authSession';

export default async function TeleconsultaLayout({ children }: { children: ReactNode }) {
  const user = await getAuthenticatedUserFromCookies();

  if (!user) {
    redirect('/login');
  }

  if (!user.isAdmin && !user.moduleAccess.teleconsulta) {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
