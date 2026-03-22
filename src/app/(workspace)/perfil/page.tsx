'use client';

import AppShell from '@/components/AppShell';
import { useEffect, useState } from 'react';

interface SessionUser {
  username: string;
  fullName: string | null;
  email: string | null;
  isAdmin: boolean;
  accountPlan: 'basic' | 'clinical' | 'pro' | 'trial';
  trialExpiresAt: string | null;
  trialExpired: boolean;
  moduleAccess: {
    transcricao: boolean;
    teleconsulta: boolean;
    prontuario: boolean;
  };
  createdAt: string;
  lastLoginAt: string | null;
}

const formatDate = (value: string | null) => {
  if (!value) {
    return 'Ainda sem registro';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
};

export default function PerfilPage() {
  const [user, setUser] = useState<SessionUser | null>(null);

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
          setUser(data.user as SessionUser);
        }
      } catch {
        if (isMounted) {
          setUser(null);
        }
      }
    };

    void loadSession();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <AppShell
      title="Perfil"
      subtitle="Dados da conta autenticada e do nível de acesso atual"
    >
      <div className="max-w-3xl space-y-5">
        <div className="bg-white border border-[#cfe0e8] rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-[#155b79] mb-2">Perfil em uso</h3>
          <p className="text-sm text-[#4b6573] mb-6">
            Seus dados na plataforma:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-[#cfe0e8] bg-[#f7fbfc] p-4">
              <p className="text-xs font-semibold text-[#4b6573] uppercase tracking-wide">Nome exibido</p>
              <p className="text-sm font-medium text-[#0c161c] mt-1">{user?.fullName || 'Carregando...'}</p>
            </div>

            <div className="rounded-lg border border-[#cfe0e8] bg-[#f7fbfc] p-4">
              <p className="text-xs font-semibold text-[#4b6573] uppercase tracking-wide">Usuário (login)</p>
              <p className="text-sm font-medium text-[#0c161c] mt-1">{user?.username || 'Carregando...'}</p>
            </div>

            <div className="rounded-lg border border-[#cfe0e8] bg-[#f7fbfc] p-4">
              <p className="text-xs font-semibold text-[#4b6573] uppercase tracking-wide">E-mail</p>
              <p className="text-sm font-medium text-[#0c161c] mt-1">{user?.email || 'Não informado'}</p>
            </div>

            <div className="rounded-lg border border-[#cfe0e8] bg-[#f7fbfc] p-4">
              <p className="text-xs font-semibold text-[#4b6573] uppercase tracking-wide">Nível de acesso</p>
              <p className="text-sm font-medium text-[#0c161c] mt-1">{user?.isAdmin ? 'Administrador' : 'Usuário padrão'}</p>
            </div>

            <div className="rounded-lg border border-[#cfe0e8] bg-[#f7fbfc] p-4">
              <p className="text-xs font-semibold text-[#4b6573] uppercase tracking-wide">Plano contratado</p>
              <p className="text-sm font-medium text-[#0c161c] mt-1">
                {user?.accountPlan === 'pro'
                  ? 'Pró'
                  : user?.accountPlan === 'clinical'
                    ? 'Clínico'
                    : user?.accountPlan === 'trial'
                      ? 'Teste (3 dias)'
                      : 'Básico'}
              </p>
            </div>

            <div className="rounded-lg border border-[#cfe0e8] bg-[#f7fbfc] p-4">
              <p className="text-xs font-semibold text-[#4b6573] uppercase tracking-wide">Validade do teste</p>
              <p className="text-sm font-medium text-[#0c161c] mt-1">
                {user?.accountPlan === 'trial'
                  ? user.trialExpiresAt
                    ? `${formatDate(user.trialExpiresAt)}${user.trialExpired ? ' (expirado)' : ''}`
                    : 'Sem data registrada'
                  : 'Não se aplica'}
              </p>
            </div>

            <div className="rounded-lg border border-[#cfe0e8] bg-[#f7fbfc] p-4">
              <p className="text-xs font-semibold text-[#4b6573] uppercase tracking-wide">Conta criada em</p>
              <p className="text-sm font-medium text-[#0c161c] mt-1">{formatDate(user?.createdAt || null)}</p>
            </div>

            <div className="rounded-lg border border-[#cfe0e8] bg-[#f7fbfc] p-4">
              <p className="text-xs font-semibold text-[#4b6573] uppercase tracking-wide">Último acesso</p>
              <p className="text-sm font-medium text-[#0c161c] mt-1">{formatDate(user?.lastLoginAt || null)}</p>
            </div>

            <div className="rounded-lg border border-[#cfe0e8] bg-[#f7fbfc] p-4 sm:col-span-2">
              <p className="text-xs font-semibold text-[#4b6573] uppercase tracking-wide">Gestão administrativa</p>
              <p className="text-sm font-medium text-[#0c161c] mt-1">
                {user?.isAdmin
                  ? 'Você já pode cadastrar usuários e trocar senhas em Administração.'
                  : 'Solicite a um administrador o provisionamento ou a alteração de credenciais.'}
              </p>
            </div>

            <div className="rounded-lg border border-[#cfe0e8] bg-[#f7fbfc] p-4 sm:col-span-2">
              <p className="text-xs font-semibold text-[#4b6573] uppercase tracking-wide">Módulos liberados</p>
              <p className="text-sm font-medium text-[#0c161c] mt-1">
                {user?.isAdmin
                  ? 'Acesso completo a todos os módulos.'
                  : [
                      user?.moduleAccess.transcricao ? 'Transcrição' : null,
                      user?.moduleAccess.teleconsulta ? 'Teleconsulta' : null,
                      user?.moduleAccess.prontuario ? 'Prontuário' : null,
                    ]
                      .filter(Boolean)
                      .join(', ') || 'Nenhum módulo liberado'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
