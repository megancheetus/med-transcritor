'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface AppShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

const BASE_MENU_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/transcricao', label: 'Transcrição', module: 'transcricao' as const },
  { href: '/prontuario', label: 'Prontuário', module: 'prontuario' as const },
  { href: '/teleconsulta', label: 'Teleconsulta', module: 'teleconsulta' as const },
  { href: '/historico', label: 'Histórico' },
  { href: '/perfil', label: 'Perfil' },
];

const ADMIN_MENU_ITEM = { href: '/admin', label: 'Administração' };

interface SessionUser {
  username: string;
  fullName: string | null;
  isAdmin: boolean;
  accountPlan: 'basic' | 'clinical' | 'pro' | 'trial';
  trialExpired: boolean;
  moduleAccess: {
    transcricao: boolean;
    teleconsulta: boolean;
    prontuario: boolean;
  };
}

export default function AppShell({ title, subtitle, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      try {
        const response = await fetch('/api/auth/session', { cache: 'no-store' });

        if (!response.ok) {
          return;
        }

        const data = await response.json();

        if (isMounted) {
          setSessionUser(data.user as SessionUser);
        }
      } catch {
        if (isMounted) {
          setSessionUser(null);
        }
      }
    };

    void loadSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const menuItems = BASE_MENU_ITEMS.filter((item) => {
    if (!('module' in item) || !item.module) {
      return true;
    }

    if (!sessionUser) {
      return true;
    }

    return sessionUser.isAdmin || sessionUser.moduleAccess[item.module];
  });

  const menuItemsWithAdmin = sessionUser?.isAdmin ? [...menuItems, ADMIN_MENU_ITEM] : menuItems;

  const handleLogout = async () => {
    await fetch('/api/auth/logout');
    router.push('/login');
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const sessionDisplayName = sessionUser?.fullName?.trim() || sessionUser?.username || '';

  const renderMenu = (mobile: boolean = false) => (
    <nav className="p-4 space-y-1">
      {menuItemsWithAdmin.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={mobile ? closeMobileMenu : undefined}
            className={`block px-3 py-2.5 rounded-lg font-medium transition ${
              active
                ? 'bg-[#e5f4f8] text-[#155b79]'
                : 'text-[#4b6573] hover:bg-[#f2f8fa]'
            }`}
          >
            {item.label}
          </Link>
        );
      })}

      <button
        type="button"
        disabled
        className="w-full text-left px-3 py-2.5 rounded-lg text-[#96a8b2] bg-[#f8fbfc] cursor-not-allowed"
      >
        Configuração (em breve)
      </button>
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

      <aside className={`fixed left-0 top-0 h-full w-72 border-r border-[#cfe0e8] bg-white z-50 transform transition-transform duration-300 lg:hidden ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-6 flex items-center justify-between gap-3 border-b border-[#edf4f6]">
          <div>
            <div className="flex items-center gap-3">
              <Image src="/favicon.png" alt="OmniNote Favicon" width={40} height={40} className="w-10 h-10" priority />
              <div>
                <h1 className="font-bold text-[#155b79] text-lg leading-tight">OmniNote</h1>
                <p className="text-xs text-[#1ea58c] font-semibold">Visão integral e multiprofissional</p>
              </div>
            </div>
            {sessionUser && (
              <div className="mt-3 rounded-lg border border-[#edf4f6] bg-[#f7fbfc] px-3 py-2">
                <p className="text-xs font-semibold text-[#4b6573] uppercase tracking-wide">Sessão atual</p>
                <p className="text-sm font-medium text-[#0c161c] mt-1">{sessionDisplayName}</p>
                <p className="text-xs text-[#1ea58c] mt-1">{sessionUser.isAdmin ? 'Administrador' : sessionUser.accountPlan === 'trial' ? 'Plano Teste' : sessionUser.accountPlan === 'pro' ? 'Plano Pró' : sessionUser.accountPlan === 'clinical' ? 'Plano Clínico' : 'Plano Básico'}</p>
              </div>
            )}
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
              <p className="text-xs text-[#1ea58c] font-semibold">Visão integral e multiprofissional</p>
            </div>
          </div>

          {sessionUser && (
            <div className="mt-4 rounded-lg border border-[#edf4f6] bg-[#f7fbfc] px-3 py-3">
              <p className="text-xs font-semibold text-[#4b6573] uppercase tracking-wide">Sessão atual</p>
              <p className="text-sm font-medium text-[#0c161c] mt-1">{sessionDisplayName}</p>
              <p className="text-xs text-[#1ea58c] mt-1">{sessionUser.isAdmin ? 'Administrador' : sessionUser.accountPlan === 'trial' ? 'Plano Teste' : sessionUser.accountPlan === 'pro' ? 'Plano Pró' : sessionUser.accountPlan === 'clinical' ? 'Plano Clínico' : 'Plano Básico'}</p>
            </div>
          )}
        </div>

        {renderMenu()}
      </aside>

      <main className="flex-1">
        <header className="h-16 border-b border-[#cfe0e8] bg-white/90 backdrop-blur px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg border border-[#cfe0e8] text-[#4b6573] hover:text-[#155b79] hover:border-[#155b79] transition"
              aria-label="Abrir menu"
            >
              ☰
            </button>

            <div>
              <h2 className="text-lg sm:text-xl font-bold text-[#155b79]">{title}</h2>
              <p className="text-xs text-[#4b6573] hidden sm:block">{subtitle}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="text-sm font-medium text-[#4b6573] hover:text-[#155b79] transition"
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
