'use client';

import AppShell from '@/components/AppShell';
import { useEffect, useState } from 'react';
import { Edit2, Save, X } from 'lucide-react';

interface SessionUser {
  username: string;
  fullName: string | null;
  email: string | null;
  isAdmin: boolean;
  accountPlan: 'basic' | 'clinical' | 'pro' | 'trial';
  trialExpiresAt: string | null;
  trialExpired: boolean;
  dateOfBirth: string | null;
  cpf: string | null;
  specialty: string | null;
  councilNumber: string | null;
  councilState: string | null;
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

const UF_OPTIONS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
  'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC',
  'SP','SE','TO',
];

function formatCpfDisplay(cpf: string | null): string {
  if (!cpf) return 'Não informado';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export default function PerfilPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState({
    fullName: '',
    dateOfBirth: '',
    cpf: '',
    specialty: '',
    councilNumber: '',
    councilState: '',
  });

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
          const u = data.user as SessionUser;
          setUser(u);
          setForm({
            fullName: u.fullName || '',
            dateOfBirth: u.dateOfBirth || '',
            cpf: u.cpf || '',
            specialty: u.specialty || '',
            councilNumber: u.councilNumber || '',
            councilState: u.councilState || '',
          });
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

  const handleStartEdit = () => {
    if (!user) return;
    setForm({
      fullName: user.fullName || '',
      dateOfBirth: user.dateOfBirth || '',
      cpf: user.cpf || '',
      specialty: user.specialty || '',
      councilNumber: user.councilNumber || '',
      councilState: user.councilState || '',
    });
    setIsEditing(true);
    setSaveMessage(null);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setSaveMessage(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        setSaveMessage({ type: 'error', text: data.error || 'Erro ao salvar perfil' });
        return;
      }

      setUser(data.user as SessionUser);
      setIsEditing(false);
      setSaveMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
    } catch {
      setSaveMessage({ type: 'error', text: 'Erro de conexão ao salvar perfil' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell
      title="Perfil"
      subtitle="Dados da conta autenticada e do nível de acesso atual"
    >
      <div className="max-w-3xl space-y-5">
        {saveMessage && (
          <div className={`rounded-lg border px-4 py-3 text-sm font-medium ${saveMessage.type === 'success' ? 'border-green-300 bg-green-50 text-green-800' : 'border-red-300 bg-red-50 text-red-800'}`}>
            {saveMessage.text}
          </div>
        )}

        {/* Dados editáveis do profissional */}
        <div className="bg-white border border-[#cfe0e8] rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold text-[#155b79]">Dados do profissional</h3>
            {!isEditing ? (
              <button
                onClick={handleStartEdit}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition"
              >
                <Edit2 className="h-3.5 w-3.5" />
                Editar
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-60"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 transition disabled:opacity-60"
                >
                  <Save className="h-3.5 w-3.5" />
                  {isSaving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            )}
          </div>
          <p className="text-sm text-[#4b6573] mb-6">
            Informações pessoais e profissionais:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-[#cfe0e8] bg-[#f7fbfc] p-4">
              <label className="text-xs font-semibold text-[#4b6573] uppercase tracking-wide">Nome completo</label>
              {isEditing ? (
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="mt-1 w-full rounded-md border border-[#cfe0e8] bg-white px-3 py-1.5 text-sm text-[#0c161c] focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="Seu nome completo"
                />
              ) : (
                <p className="text-sm font-medium text-[#0c161c] mt-1">{user?.fullName || 'Não informado'}</p>
              )}
            </div>

            <div className="rounded-lg border border-[#cfe0e8] bg-[#f7fbfc] p-4">
              <label className="text-xs font-semibold text-[#4b6573] uppercase tracking-wide">Data de nascimento</label>
              {isEditing ? (
                <input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                  className="mt-1 w-full rounded-md border border-[#cfe0e8] bg-white px-3 py-1.5 text-sm text-[#0c161c] focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              ) : (
                <p className="text-sm font-medium text-[#0c161c] mt-1">
                  {user?.dateOfBirth ? new Date(user.dateOfBirth + 'T00:00:00').toLocaleDateString('pt-BR') : 'Não informado'}
                </p>
              )}
            </div>

            <div className="rounded-lg border border-[#cfe0e8] bg-[#f7fbfc] p-4">
              <label className="text-xs font-semibold text-[#4b6573] uppercase tracking-wide">CPF</label>
              {isEditing ? (
                <input
                  type="text"
                  value={form.cpf}
                  onChange={(e) => setForm({ ...form, cpf: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                  className="mt-1 w-full rounded-md border border-[#cfe0e8] bg-white px-3 py-1.5 text-sm text-[#0c161c] focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="00000000000"
                  maxLength={11}
                />
              ) : (
                <p className="text-sm font-medium text-[#0c161c] mt-1">{formatCpfDisplay(user?.cpf ?? null)}</p>
              )}
            </div>

            <div className="rounded-lg border border-[#cfe0e8] bg-[#f7fbfc] p-4">
              <label className="text-xs font-semibold text-[#4b6573] uppercase tracking-wide">Especialidade</label>
              {isEditing ? (
                <input
                  type="text"
                  value={form.specialty}
                  onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                  className="mt-1 w-full rounded-md border border-[#cfe0e8] bg-white px-3 py-1.5 text-sm text-[#0c161c] focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="Ex: Cardiologia, Nutrição..."
                />
              ) : (
                <p className="text-sm font-medium text-[#0c161c] mt-1">{user?.specialty || 'Não informado'}</p>
              )}
            </div>

            <div className="rounded-lg border border-[#cfe0e8] bg-[#f7fbfc] p-4">
              <label className="text-xs font-semibold text-[#4b6573] uppercase tracking-wide">Número do conselho</label>
              {isEditing ? (
                <input
                  type="text"
                  value={form.councilNumber}
                  onChange={(e) => setForm({ ...form, councilNumber: e.target.value })}
                  className="mt-1 w-full rounded-md border border-[#cfe0e8] bg-white px-3 py-1.5 text-sm text-[#0c161c] focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="Ex: CRM 12345, CRN 67890..."
                />
              ) : (
                <p className="text-sm font-medium text-[#0c161c] mt-1">{user?.councilNumber || 'Não informado'}</p>
              )}
            </div>

            <div className="rounded-lg border border-[#cfe0e8] bg-[#f7fbfc] p-4">
              <label className="text-xs font-semibold text-[#4b6573] uppercase tracking-wide">Estado do conselho</label>
              {isEditing ? (
                <select
                  value={form.councilState}
                  onChange={(e) => setForm({ ...form, councilState: e.target.value })}
                  className="mt-1 w-full rounded-md border border-[#cfe0e8] bg-white px-3 py-1.5 text-sm text-[#0c161c] focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                >
                  <option value="">Selecione o estado</option>
                  {UF_OPTIONS.map((uf) => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              ) : (
                <p className="text-sm font-medium text-[#0c161c] mt-1">{user?.councilState || 'Não informado'}</p>
              )}
            </div>
          </div>
        </div>

        {/* Dados da conta (somente leitura) */}
        <div className="bg-white border border-[#cfe0e8] rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-[#155b79] mb-2">Dados da conta</h3>
          <p className="text-sm text-[#4b6573] mb-6">
            Informações de acesso e plano:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div className="rounded-lg border border-[#cfe0e8] bg-[#f7fbfc] p-4">
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
