import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { TranscriptionWorkspaceProvider } from '@/components/TranscriptionWorkspaceProvider';
import { getUsernameFromAuthToken } from '@/lib/auth';

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const authToken = cookieStore.get('auth_token')?.value;
  const username = await getUsernameFromAuthToken(authToken);

  if (!username) {
    redirect('/login');
  }

  return <TranscriptionWorkspaceProvider storageNamespace={username}>{children}</TranscriptionWorkspaceProvider>;
}
