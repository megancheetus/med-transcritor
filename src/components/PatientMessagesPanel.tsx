'use client';

import { useEffect, useMemo, useState } from 'react';
import PatientPortalShell from '@/components/PatientPortalShell';

interface PatientMessagesPanelProps {
  patientName: string;
  patientCpf: string;
}

interface PatientPortalMessageItem {
  id: string;
  patientId: string;
  professionalUsername: string;
  professionalDisplayName: string;
  title: string;
  body: string;
  sentAt: string;
  readAt: string | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentMimeType: string | null;
  attachmentSizeBytes: number | null;
}

const formatBytes = (value: number | null) => {
  if (!value || value <= 0) {
    return '--';
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value));

export default function PatientMessagesPanel({ patientName, patientCpf }: PatientMessagesPanelProps) {
  const [messages, setMessages] = useState<PatientPortalMessageItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [markingRead, setMarkingRead] = useState<string | null>(null);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('patient-messages-unread-updated', {
        detail: { unreadCount },
      })
    );
  }, [unreadCount]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/paciente/messages?limit=100', { cache: 'no-store' });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || 'Falha ao carregar mensagens.');
      }

      setMessages((data?.messages || []) as PatientPortalMessageItem[]);
      const nextUnreadCount = typeof data?.unreadCount === 'number' ? data.unreadCount : 0;
      setUnreadCount(nextUnreadCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado ao buscar mensagens.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMessages();
  }, []);

  const handleMarkAsRead = async (messageId: string) => {
    try {
      setMarkingRead(messageId);
      setError('');

      const response = await fetch(`/api/paciente/messages/${encodeURIComponent(messageId)}/read`, {
        method: 'POST',
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || 'Não foi possível marcar a mensagem como lida.');
      }

      setMessages((prev) =>
        prev.map((message) =>
          message.id === messageId
            ? {
                ...message,
                readAt: data?.message?.readAt || new Date().toISOString(),
              }
            : message
        )
      );

      setUnreadCount((prev) => Math.max(prev - 1, 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado ao marcar mensagem como lida.');
    } finally {
      setMarkingRead(null);
    }
  };

  const hasMessages = useMemo(() => messages.length > 0, [messages]);

  return (
    <PatientPortalShell
      title="Mensagens"
      subtitle="Comunicados enviados pela sua equipe de saúde"
      patientName={patientName}
      patientCpf={patientCpf}
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-[#cfe0e8] bg-white p-5 shadow-sm">
          <h3 className="text-base font-bold text-[#155b79]">Caixa de mensagens</h3>
          <p className="mt-1 text-sm text-[#4b6573]">
            Aqui você recebe orientações e comunicados da equipe profissional.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-[#d7e6ed] bg-[#f7fbfc] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#4b6573]">Total de mensagens</p>
              <p className="mt-1 text-2xl font-bold text-[#155b79]">{messages.length}</p>
            </div>
            <div className="rounded-lg border border-[#d7e6ed] bg-[#fff8e8] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#4b6573]">Não lidas</p>
              <p className="mt-1 text-2xl font-bold text-[#d28a00]">{unreadCount}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {loading ? (
          <div className="rounded-xl border border-[#cfe0e8] bg-white p-6 text-sm text-[#4b6573] shadow-sm">
            Carregando mensagens...
          </div>
        ) : !hasMessages ? (
          <div className="rounded-xl border border-[#cfe0e8] bg-white p-6 text-sm text-[#4b6573] shadow-sm">
            Você ainda não possui mensagens da equipe.
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <article
                key={message.id}
                className={`rounded-xl border p-4 shadow-sm ${
                  message.readAt
                    ? 'border-[#cfe0e8] bg-white'
                    : 'border-[#f1d69a] bg-[#fffaf0]'
                }`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-[#155b79]">{message.title}</h4>
                    <p className="mt-1 text-xs text-[#4b6573]">
                      Enviado por {message.professionalDisplayName} em {formatDateTime(message.sentAt)}
                    </p>
                  </div>

                  {!message.readAt ? (
                    <button
                      type="button"
                      onClick={() => handleMarkAsRead(message.id)}
                      disabled={markingRead === message.id}
                      className="inline-flex items-center rounded-md bg-[#155b79] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#124a63] disabled:opacity-60"
                    >
                      {markingRead === message.id ? 'Marcando...' : 'Marcar como lida'}
                    </button>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-[#effaf7] px-2.5 py-1 text-[11px] font-semibold text-[#1f8b73]">
                      Lida em {formatDateTime(message.readAt)}
                    </span>
                  )}
                </div>

                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#0c161c]">
                  {message.body}
                </p>

                {message.attachmentUrl && (
                  <a
                    href={`/api/paciente/messages/${encodeURIComponent(message.id)}/attachment`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-2 rounded-md border border-[#cfe0e8] bg-[#f7fbfc] px-3 py-2 text-xs font-semibold text-[#155b79] hover:bg-[#eef6f9]"
                  >
                    <span>Abrir anexo</span>
                    <span className="text-[#7b8d97]">
                      {message.attachmentName || 'Arquivo'} ({formatBytes(message.attachmentSizeBytes)})
                    </span>
                  </a>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </PatientPortalShell>
  );
}
