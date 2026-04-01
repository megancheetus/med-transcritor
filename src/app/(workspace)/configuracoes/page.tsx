'use client';

import AppShell from '@/components/AppShell';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface PatientPortalAccountItem {
  patientId: string;
  nomeCompleto: string;
  email: string | null;
  telefone: string | null;
  portalAccountCreatedAt: string;
  lastLoginAt: string | null;
}

interface PatientPortalSummary {
  totalPatients: number;
  patientsWithPortalAccount: number;
  patientsWithoutPortalAccount: number;
}

interface MessageAttachment {
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

interface ProfessionalPortalMessageItem {
  id: string;
  patientId: string;
  patientName: string;
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

const formatDateTime = (value: string | null) => {
  if (!value) {
    return 'Nunca acessou';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value));
};

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

export default function ConfiguracoesPage() {
  const [accounts, setAccounts] = useState<PatientPortalAccountItem[]>([]);
  const [summary, setSummary] = useState<PatientPortalSummary>({
    totalPatients: 0,
    patientsWithPortalAccount: 0,
    patientsWithoutPortalAccount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedPatientForMessage, setSelectedPatientForMessage] = useState<PatientPortalAccountItem | null>(null);
  const [messageTitle, setMessageTitle] = useState('Mensagem da equipe');
  const [messageBody, setMessageBody] = useState('');
  const [messageAttachment, setMessageAttachment] = useState<MessageAttachment | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [messageFeedback, setMessageFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [historyMessages, setHistoryMessages] = useState<ProfessionalPortalMessageItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [historyReadStatus, setHistoryReadStatus] = useState<'all' | 'read' | 'unread'>('all');
  const [historyPatientFilter, setHistoryPatientFilter] = useState('all');

  useEffect(() => {
    let isMounted = true;

    const loadPortalAccounts = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await fetch('/api/patients/portal-accounts', {
          cache: 'no-store',
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error || 'Falha ao buscar dados do portal de pacientes.');
        }

        const data = await response.json();

        if (!isMounted) {
          return;
        }

        setAccounts((data.accounts || []) as PatientPortalAccountItem[]);
        setSummary((data.summary || {
          totalPatients: 0,
          patientsWithPortalAccount: 0,
          patientsWithoutPortalAccount: 0,
        }) as PatientPortalSummary);
      } catch (err) {
        if (!isMounted) {
          return;
        }

        setError(err instanceof Error ? err.message : 'Erro inesperado ao carregar configurações.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadPortalAccounts();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredAccounts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return accounts;
    }

    return accounts.filter((account) => {
      const fields = [
        account.nomeCompleto,
        account.email || '',
        account.telefone || '',
      ];

      return fields.some((field) => field.toLowerCase().includes(query));
    });
  }, [accounts, search]);

  const openMessageModal = (patient: PatientPortalAccountItem) => {
    setSelectedPatientForMessage(patient);
    setMessageFeedback(null);
    setMessageTitle('Mensagem da equipe');
    setMessageBody('');
    setMessageAttachment(null);
  };

  const closeMessageModal = () => {
    setSelectedPatientForMessage(null);
    setMessageFeedback(null);
    setMessageTitle('Mensagem da equipe');
    setMessageBody('');
    setMessageAttachment(null);
  };

  const loadHistoryMessages = useCallback(async () => {
    try {
      setHistoryLoading(true);
      setHistoryError('');

      const params = new URLSearchParams();
      params.set('limit', '200');

      if (historySearch.trim()) {
        params.set('search', historySearch.trim());
      }

      if (historyReadStatus !== 'all') {
        params.set('readStatus', historyReadStatus);
      }

      if (historyPatientFilter !== 'all') {
        params.set('patientId', historyPatientFilter);
      }

      const response = await fetch(`/api/patients/portal-messages?${params.toString()}`, {
        cache: 'no-store',
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || 'Falha ao buscar histórico de mensagens.');
      }

      setHistoryMessages((data?.messages || []) as ProfessionalPortalMessageItem[]);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Erro inesperado ao carregar histórico de mensagens.');
    } finally {
      setHistoryLoading(false);
    }
  }, [historyPatientFilter, historyReadStatus, historySearch]);

  useEffect(() => {
    void loadHistoryMessages();
  }, [loadHistoryMessages]);

  const handleAttachmentSelected = async (file: File) => {
    try {
      setUploadingAttachment(true);
      setMessageFeedback(null);

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/patients/portal-messages/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || 'Falha ao fazer upload do anexo.');
      }

      const attachment = data?.attachment as MessageAttachment | undefined;
      if (!attachment) {
        throw new Error('Resposta de upload inválida.');
      }

      setMessageAttachment(attachment);
      setMessageFeedback({
        type: 'success',
        text: 'Anexo enviado com sucesso. A mensagem será enviada com esse arquivo.',
      });
    } catch (err) {
      setMessageFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erro inesperado ao enviar anexo.',
      });
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedPatientForMessage) {
      return;
    }

    setSendingMessage(true);
    setMessageFeedback(null);

    try {
      const response = await fetch(`/api/patients/${encodeURIComponent(selectedPatientForMessage.patientId)}/portal-messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: messageTitle,
          body: messageBody,
          attachmentUrl: messageAttachment?.url,
          attachmentName: messageAttachment?.fileName,
          attachmentMimeType: messageAttachment?.mimeType,
          attachmentSizeBytes: messageAttachment?.sizeBytes,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || 'Falha ao enviar mensagem para o paciente.');
      }

      setMessageFeedback({
        type: 'success',
        text: 'Mensagem enviada com sucesso para o painel do paciente.',
      });

      setMessageTitle('Mensagem da equipe');
      setMessageBody('');
      setMessageAttachment(null);
      await loadHistoryMessages();
    } catch (err) {
      setMessageFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erro inesperado ao enviar mensagem.',
      });
    } finally {
      setSendingMessage(false);
    }
  };

  return (
    <AppShell
      title="Painel de Pacientes"
      subtitle="Acompanhe adoção do Painel de Pacientes e prepare comunicação futura"
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-[#cfe0e8] bg-white p-5 shadow-sm">
          <h3 className="text-base font-bold text-[#155b79]">Painel de Pacientes</h3>
          <p className="mt-1 text-sm text-[#4b6573]">
            Veja quais pacientes já ativaram a conta no painel e acompanhe o último acesso.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-[#d7e6ed] bg-[#f7fbfc] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#4b6573]">Pacientes totais</p>
              <p className="mt-1 text-2xl font-bold text-[#155b79]">{summary.totalPatients}</p>
            </div>
            <div className="rounded-lg border border-[#d7e6ed] bg-[#effaf7] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#4b6573]">Com conta criada</p>
              <p className="mt-1 text-2xl font-bold text-[#1ea58c]">{summary.patientsWithPortalAccount}</p>
            </div>
            <div className="rounded-lg border border-[#d7e6ed] bg-[#fff8e8] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#4b6573]">Ainda sem conta</p>
              <p className="mt-1 text-2xl font-bold text-[#d28a00]">{summary.patientsWithoutPortalAccount}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#cfe0e8] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h4 className="text-sm font-bold text-[#155b79]">Pacientes com conta no painel</h4>
              <p className="text-xs text-[#4b6573]">Clique no nome para abrir o prontuário.</p>
            </div>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, e-mail ou telefone"
              className="w-full rounded-lg border border-[#cfe0e8] bg-white px-3 py-2 text-sm text-[#0c161c] md:w-80"
            />
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="mt-4 rounded-lg border border-[#d7e6ed] bg-[#f7fbfc] p-6 text-sm text-[#4b6573]">
              Carregando status do painel de pacientes...
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="mt-4 rounded-lg border border-[#d7e6ed] bg-[#f7fbfc] p-6 text-sm text-[#4b6573]">
              Nenhum paciente com conta ativa no painel foi encontrado.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-lg border border-[#d7e6ed]">
              <table className="min-w-full text-left">
                <thead className="bg-[#f7fbfc]">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#4b6573]">Paciente</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#4b6573]">Contato</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#4b6573]">Conta criada em</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#4b6573]">Último acesso</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#4b6573]">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf4f6] bg-white">
                  {filteredAccounts.map((account) => (
                    <tr key={account.patientId} className="hover:bg-[#f9fcfd]">
                      <td className="px-4 py-3 text-sm font-medium text-[#0c161c]">
                        <Link
                          href={`/prontuario?patientId=${encodeURIComponent(account.patientId)}`}
                          className="text-[#155b79] hover:text-[#0f4e68] hover:underline"
                        >
                          {account.nomeCompleto}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#4b6573]">
                        <div>{account.email || 'Sem e-mail'}</div>
                        <div className="text-xs text-[#7b8d97]">{account.telefone || 'Sem telefone'}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#4b6573]">{formatDateTime(account.portalAccountCreatedAt)}</td>
                      <td className="px-4 py-3 text-sm text-[#4b6573]">{formatDateTime(account.lastLoginAt)}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => openMessageModal(account)}
                          className="rounded-md border border-[#b8d4df] bg-white px-3 py-1.5 text-xs font-semibold text-[#155b79] hover:bg-[#f2f8fa]"
                        >
                          Enviar mensagem
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#cfe0e8] bg-white p-5 shadow-sm">
          <h4 className="text-sm font-bold text-[#155b79]">Mensageria do painel do paciente</h4>
          <p className="mt-1 text-sm text-[#4b6573]">
            As mensagens enviadas aqui aparecem no painel do paciente e podem ser marcadas como lidas por ele.
          </p>
        </div>

        <div className="rounded-xl border border-[#cfe0e8] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h4 className="text-sm font-bold text-[#155b79]">Histórico de mensagens enviadas</h4>
              <p className="text-xs text-[#4b6573]">Filtre por paciente, status de leitura e texto.</p>
            </div>

            <div className="grid w-full grid-cols-1 gap-2 md:w-auto md:grid-cols-3">
              <select
                value={historyPatientFilter}
                onChange={(e) => setHistoryPatientFilter(e.target.value)}
                className="rounded-lg border border-[#cfe0e8] bg-white px-3 py-2 text-sm text-[#0c161c]"
              >
                <option value="all">Todos os pacientes</option>
                {accounts.map((account) => (
                  <option key={account.patientId} value={account.patientId}>
                    {account.nomeCompleto}
                  </option>
                ))}
              </select>

              <select
                value={historyReadStatus}
                onChange={(e) => setHistoryReadStatus(e.target.value as 'all' | 'read' | 'unread')}
                className="rounded-lg border border-[#cfe0e8] bg-white px-3 py-2 text-sm text-[#0c161c]"
              >
                <option value="all">Todos os status</option>
                <option value="unread">Não lidas</option>
                <option value="read">Lidas</option>
              </select>

              <input
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Buscar título, mensagem ou paciente"
                className="rounded-lg border border-[#cfe0e8] bg-white px-3 py-2 text-sm text-[#0c161c]"
              />
            </div>
          </div>

          {historyError && (
            <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {historyError}
            </div>
          )}

          {historyLoading ? (
            <div className="mt-4 rounded-lg border border-[#d7e6ed] bg-[#f7fbfc] p-6 text-sm text-[#4b6573]">
              Carregando histórico de mensagens...
            </div>
          ) : historyMessages.length === 0 ? (
            <div className="mt-4 rounded-lg border border-[#d7e6ed] bg-[#f7fbfc] p-6 text-sm text-[#4b6573]">
              Nenhuma mensagem encontrada para os filtros selecionados.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-lg border border-[#d7e6ed]">
              <table className="min-w-full text-left">
                <thead className="bg-[#f7fbfc]">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#4b6573]">Paciente</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#4b6573]">Mensagem</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#4b6573]">Anexo</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#4b6573]">Enviada em</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#4b6573]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf4f6] bg-white">
                  {historyMessages.map((message) => (
                    <tr key={message.id} className="hover:bg-[#f9fcfd]">
                      <td className="px-4 py-3 text-sm font-medium text-[#0c161c]">{message.patientName}</td>
                      <td className="px-4 py-3 text-sm text-[#4b6573]">
                        <div className="font-semibold text-[#155b79]">{message.title}</div>
                        <div className="line-clamp-2 text-xs">{message.body}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#4b6573]">
                        {message.attachmentUrl ? (
                          <a
                            href={`/api/patients/portal-messages/${encodeURIComponent(message.id)}/attachment`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#155b79] hover:underline"
                          >
                            {message.attachmentName || 'Arquivo'} ({formatBytes(message.attachmentSizeBytes)})
                          </a>
                        ) : (
                          <span className="text-xs text-[#7b8d97]">Sem anexo</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#4b6573]">{formatDateTime(message.sentAt)}</td>
                      <td className="px-4 py-3 text-sm">
                        {message.readAt ? (
                          <span className="inline-flex rounded-full bg-[#effaf7] px-2 py-1 text-xs font-semibold text-[#1f8b73]">
                            Lida em {formatDateTime(message.readAt)}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-[#fff8e8] px-2 py-1 text-xs font-semibold text-[#d28a00]">
                            Não lida
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedPatientForMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c161c]/45 p-4">
          <div className="w-full max-w-xl rounded-xl border border-[#cfe0e8] bg-white shadow-2xl">
            <div className="border-b border-[#edf4f6] px-5 py-4">
              <h4 className="text-base font-bold text-[#155b79]">Nova mensagem para paciente</h4>
              <p className="mt-1 text-sm text-[#4b6573]">
                Destinatário: <span className="font-semibold text-[#0c161c]">{selectedPatientForMessage.nomeCompleto}</span>
              </p>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#4b6573]">Título</label>
                <input
                  value={messageTitle}
                  onChange={(e) => setMessageTitle(e.target.value)}
                  maxLength={160}
                  className="w-full rounded-lg border border-[#cfe0e8] bg-white px-3 py-2 text-sm text-[#0c161c]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#4b6573]">Mensagem</label>
                <textarea
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  rows={6}
                  maxLength={5000}
                  className="w-full resize-none rounded-lg border border-[#cfe0e8] bg-white px-3 py-2 text-sm text-[#0c161c]"
                  placeholder="Escreva uma orientação para o paciente..."
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#4b6573]">Anexo (opcional)</label>
                <input
                  type="file"
                  accept=".pdf,.txt,.md,.doc,.docx,application/pdf,text/plain,text/markdown,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      void handleAttachmentSelected(file);
                    }
                  }}
                  className="w-full rounded-lg border border-[#cfe0e8] bg-white px-3 py-2 text-sm text-[#0c161c]"
                />

                {uploadingAttachment && (
                  <p className="mt-2 text-xs text-[#4b6573]">Enviando anexo...</p>
                )}

                {messageAttachment && (
                  <div className="mt-2 flex items-center justify-between rounded-md border border-[#d7e6ed] bg-[#f7fbfc] px-3 py-2 text-xs text-[#4b6573]">
                    <span>{messageAttachment.fileName} ({formatBytes(messageAttachment.sizeBytes)})</span>
                    <button
                      type="button"
                      onClick={() => setMessageAttachment(null)}
                      className="font-semibold text-[#155b79] hover:underline"
                    >
                      Remover
                    </button>
                  </div>
                )}
              </div>

              {messageFeedback && (
                <div
                  className={`rounded-lg border p-3 text-sm ${
                    messageFeedback.type === 'success'
                      ? 'border-green-300 bg-green-50 text-green-700'
                      : 'border-red-300 bg-red-50 text-red-700'
                  }`}
                >
                  {messageFeedback.text}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-[#edf4f6] px-5 py-4">
              <button
                type="button"
                onClick={closeMessageModal}
                className="rounded-md border border-[#cfe0e8] px-3 py-2 text-sm font-medium text-[#4b6573] hover:bg-[#f7fbfc]"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handleSendMessage}
                disabled={sendingMessage || uploadingAttachment || messageTitle.trim().length < 3 || messageBody.trim().length < 5}
                className="rounded-md bg-[#155b79] px-3 py-2 text-sm font-semibold text-white hover:bg-[#124a63] disabled:opacity-60"
              >
                {sendingMessage ? 'Enviando...' : 'Enviar mensagem'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
