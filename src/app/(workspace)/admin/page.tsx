import { redirect } from 'next/navigation';
import AppShell from '@/components/AppShell';
import UserAdminPanel from '@/components/UserAdminPanel';
import { getAuthenticatedUserFromCookies } from '@/lib/authSession';

export default async function AdminPage() {
  const user = await getAuthenticatedUserFromCookies();

  if (!user) {
    redirect('/login');
  }

  if (!user.isAdmin) {
    redirect('/dashboard');
  }

  return (
    <AppShell
      title="Administração de usuários"
      subtitle="Cadastre acessos e troque senhas diretamente no banco de dados"
    >
      <UserAdminPanel currentUsername={user.username} />
    </AppShell>
  );
}