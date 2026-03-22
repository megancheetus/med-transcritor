import { redirect } from 'next/navigation';
import { TranscriptionWorkspaceProvider } from '@/components/TranscriptionWorkspaceProvider';
import { getAuthenticatedUserFromCookies } from '@/lib/authSession';

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthenticatedUserFromCookies();

  if (!user) {
    redirect('/login');
  }

  return <TranscriptionWorkspaceProvider storageNamespace={user.username}>{children}</TranscriptionWorkspaceProvider>;
}
