'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface PatientPortalShellProps {
  title: string;
  subtitle: string;
  patientName: string;
  patientCpf: string;
  children: React.ReactNode;
}

const MENU_ITEMS = [
  { href: '/paciente/dashboard', label: 'Dashboard' },
  { href: '/paciente/mensagens', label: 'Mensagens' },
  { href: '/paciente/composicao-corporal', label: 'Composição Corporal' },
  { href: '/paciente/prontuario', label: 'Prontuário' },
  { href: '/paciente/medicamentos', label: 'Medicamentos' },
  { href: '/paciente/historico', label: 'Histórico' },
];

export default function PatientPortalShell({ title, subtitle, patientName, patientCpf, children }: PatientPortalShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const loadUnreadCount = async () => {
      try {
        const response = await fetch('/api/paciente/messages?limit=1', {
          cache: 'no-store',
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json();

        if (isMounted && typeof data?.unreadCount === 'number') {
          setUnreadMessagesCount(data.unreadCount);
        }
      } catch {
        // Mantém UX silenciosa no menu em caso de falha pontual
      }
    };

    void loadUnreadCount();

    const handleUnreadCountEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ unreadCount?: number }>;
      if (typeof customEvent.detail?.unreadCount === 'number') {
        setUnreadMessagesCount(customEvent.detail.unreadCount);
      }
    };

    window.addEventListener('patient-messages-unread-updated', handleUnreadCountEvent as EventListener);

    const interval = setInterval(() => {
      void loadUnreadCount();
    }, 60_000);

    return () => {
      isMounted = false;
      window.removeEventListener('patient-messages-unread-updated', handleUnreadCountEvent as EventListener);
      clearInterval(interval);
    };
  }, []);

  const handleLogout = async () => {
    await fetch('/api/paciente/logout', { method: 'POST' });
    router.push('/paciente/login');
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const renderMenu = (mobile: boolean = false) => (
    <nav className="p-4 space-y-1">
      {MENU_ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={mobile ? closeMobileMenu : undefined}
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg font-medium transition ${
              active ? 'bg-[#e5f4f8] text-[#155b79]' : 'text-[#4b6573] hover:bg-[#f2f8fa]'
            }`}
          >
            <span>{item.label}</span>
            {item.href === '/paciente/mensagens' && unreadMessagesCount > 0 && (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#d28a00] px-1.5 py-0.5 text-[10px] font-bold text-white">
                {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#edf4f6] text-[#0c161c] lg:flex">
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-[#0c161c]/35 z-40 lg:hidden"
          onClick={closeMobileMenu}
          aria-hidden="true"
        ></div>
      )}

      <aside className={`fixed left-0 top-0 h-full w-[85vw] max-w-72 border-r border-[#cfe0e8] bg-white z-50 transform transition-transform duration-300 lg:hidden ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-6 flex items-center justify-between gap-3 border-b border-[#edf4f6]">
          <div>
            <div className="flex items-center gap-3">
              <Image src="/favicon.png" alt="OmniNote Favicon" width={40} height={40} className="w-10 h-10" priority />
              <div>
                <h1 className="font-bold text-[#155b79] text-lg leading-tight">OmniNote</h1>
                <p className="text-xs text-[#1ea58c] font-semibold">Portal do Paciente</p>
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-[#edf4f6] bg-[#f7fbfc] px-3 py-2">
              <p className="text-xs font-semibold text-[#4b6573] uppercase tracking-wide">Sessão atual</p>
              <p className="text-sm font-medium text-[#0c161c] mt-1">{patientName}</p>
              <p className="text-xs text-[#1ea58c] mt-1">CPF: {patientCpf}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeMobileMenu}
            className="text-[#4b6573] hover:text-[#155b79] text-lg leading-none"
            aria-label="Fechar menu"
          >
            ×
          </button>
        </div>

        {renderMenu(true)}
      </aside>

      <aside className="hidden lg:flex lg:w-72 lg:flex-col border-r border-[#cfe0e8] bg-white">
        <div className="p-6 border-b border-[#edf4f6]">
          <div className="flex items-center gap-3">
            <Image src="/favicon.png" alt="OmniNote Favicon" width={40} height={40} className="w-10 h-10" priority />
            <div>
              <h1 className="font-bold text-[#155b79] text-lg leading-tight">OmniNote</h1>
              <p className="text-xs text-[#1ea58c] font-semibold">Portal do Paciente</p>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-[#edf4f6] bg-[#f7fbfc] px-3 py-3">
            <p className="text-xs font-semibold text-[#4b6573] uppercase tracking-wide">Sessão atual</p>
            <p className="text-sm font-medium text-[#0c161c] mt-1">{patientName}</p>
            <p className="text-xs text-[#1ea58c] mt-1">CPF: {patientCpf}</p>
          </div>
        </div>

        {renderMenu()}
      </aside>

      <main className="flex-1">
        <header className="min-h-16 border-b border-[#cfe0e8] bg-white/90 backdrop-blur px-3 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-3 sticky top-0 z-10">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg border border-[#cfe0e8] text-[#4b6573] hover:text-[#155b79] hover:border-[#155b79] transition"
              aria-label="Abrir menu"
            >
              ☰
            </button>

            <div className="min-w-0">
              <h2 className="text-base min-[360px]:text-lg sm:text-xl font-bold leading-tight break-words text-[#155b79]">{title}</h2>
              <p className="text-xs text-[#4b6573] hidden sm:block">{subtitle}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="shrink-0 text-xs min-[360px]:text-sm font-medium text-[#4b6573] hover:text-[#155b79] transition"
          >
            Sair
          </button>
        </header>

        <div className="p-4 sm:p-6 lg:p-8">{children}</div>

        <footer className="border-t border-[#cfe0e8] bg-white px-4 sm:px-6 lg:px-8 py-4 text-center text-xs text-[#7b8d97]">
          &copy; {new Date().getFullYear()} OmniNote. Todos os direitos reservados.
        </footer>
      </main>
    </div>
  );
}
