'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { VideoConsultaRoom } from '@/lib/types';
import AppShell from '@/components/AppShell';
import { Phone, Copy, Clock, CheckCircle, X, Plus } from 'lucide-react';

export default function TeleconsultaDashboardPage() {
  const router = useRouter();
  const [consultations, setConsultations] = useState<VideoConsultaRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Carregar teleconsultas
  useEffect(() => {
    const loadConsultations = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/videoconsultations');

        if (!response.ok) {
          throw new Error('Erro ao carregar teleconsultas');
        }

        const data = await response.json();
        setConsultations(data.consultations || []);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    loadConsultations();
    // Atualizar a cada 10 segundos
    const interval = setInterval(loadConsultations, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleCopyLink = (consultation: VideoConsultaRoom) => {
    const link = `${window.location.origin}/room/${consultation.id}?token=${consultation.roomToken}`;
    navigator.clipboard.writeText(link);
    setCopiedId(consultation.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleJoinCall = (consultation: VideoConsultaRoom) => {
    router.push(`/room/${consultation.id}?role=professional`);
  };

  const handleNewConsultation = () => {
    router.push('/prontuario');
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR');
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'active':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'ended':
        return 'bg-gray-50 text-gray-700 border-gray-200';
      case 'expired':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'waiting':
        return 'Aguardando';
      case 'active':
        return 'Em andamento';
      case 'ended':
        return 'Finalizada';
      case 'expired':
        return 'Expirada';
      default:
        return status;
    }
  };

  // Separar consultas ativas e histórico
  const activeCons = consultations.filter((c) => c.status === 'active' || c.status === 'waiting');
  const historyCons = consultations.filter((c) => c.status === 'ended' || c.status === 'expired');

  return (
    <AppShell
      title="Teleconsultas"
      subtitle="Gerencie suas salas de videoconsulta com pacientes"
    >
      <div className="space-y-6">
        {/* Error message */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleNewConsultation}
            className="flex items-center gap-2 px-4 py-2 bg-[#1ea58c] hover:bg-[#18956e] text-white font-medium rounded-lg transition"
          >
            <Plus size={18} />
            Nova Teleconsulta
          </button>
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-xl bg-white shadow-sm border border-[#cfe0e8]">
            <div className="text-center">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 mb-3 animate-spin">
                <div className="h-6 w-6 rounded-full border-2 border-blue-600 border-t-transparent"></div>
              </div>
              <p className="text-slate-600">Carregando teleconsultas...</p>
            </div>
          </div>
        ) : consultations.length === 0 ? (
          <div className="rounded-xl bg-white shadow-sm border border-[#cfe0e8] p-12 text-center">
            <Phone size={48} className="mx-auto mb-4 text-[#cfe0e8]" />
            <h3 className="text-lg font-semibold text-[#155b79] mb-2">Nenhuma teleconsulta</h3>
            <p className="text-[#7b8d97] mb-6">
              Comece criando uma nova teleconsulta com um paciente
            </p>
            <button
              onClick={handleNewConsultation}
              className="px-6 py-2 bg-[#1ea58c] hover:bg-[#18956e] text-white font-medium rounded-lg transition inline-flex items-center gap-2"
            >
              <Plus size={18} />
              Criar Teleconsulta
            </button>
          </div>
        ) : (
          <>
            {/* Active consultations */}
            {activeCons.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-bold text-[#155b79]">Ativas</h2>
                <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
                  {activeCons.map((consultation) => (
                    <div
                      key={consultation.id}
                      className="rounded-lg bg-white shadow-sm border-2 border-[#1ea58c] p-4 hover:shadow-md transition"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-[#155b79]">
                            {consultation.patientName}
                          </h3>
                          <p className="text-xs text-[#7b8d97]">
                            Prof: {consultation.professionalUsername}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded border ${getStatusColor(
                            consultation.status
                          )}`}
                        >
                          {getStatusLabel(consultation.status)}
                        </span>
                      </div>

                      <div className="space-y-2 text-sm text-[#7b8d97] mb-4 pb-4 border-b border-[#cfe0e8]">
                        <div className="flex items-center gap-2">
                          <Clock size={14} />
                          Criada: {formatDate(consultation.createdAt)}
                        </div>
                        {consultation.startedAt && (
                          <div className="flex items-center gap-2">
                            <Clock size={14} />
                            Iniciada: {formatDate(consultation.startedAt)}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleJoinCall(consultation)}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#1ea58c] hover:bg-[#18956e] text-white text-sm font-medium rounded transition"
                        >
                          <Phone size={16} />
                          Entrar
                        </button>
                        <button
                          onClick={() => handleCopyLink(consultation)}
                          className={`px-3 py-2 rounded border-2 transition text-sm font-medium ${
                            copiedId === consultation.id
                              ? 'bg-green-50 border-green-200 text-green-700'
                              : 'bg-white border-[#cfe0e8] text-[#155b79] hover:bg-slate-50'
                          }`}
                        >
                          {copiedId === consultation.id ? (
                            <CheckCircle size={16} />
                          ) : (
                            <Copy size={16} />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* History */}
            {historyCons.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-bold text-[#155b79]">Histórico</h2>
                <div className="rounded-lg bg-white shadow-sm border border-[#cfe0e8] overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-[#f3f7f9] border-b border-[#cfe0e8]">
                      <tr className="text-left text-xs font-bold text-[#155b79] uppercase">
                        <th className="px-4 py-3">Paciente</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Data</th>
                        <th className="px-4 py-3">Duração</th>
                        <th className="px-4 py-3">Gravada</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#cfe0e8]">
                      {historyCons.map((consultation) => (
                        <tr key={consultation.id} className="hover:bg-[#f8fafc] transition">
                          <td className="px-4 py-3 text-sm font-medium text-[#155b79]">
                            {consultation.patientName}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded border ${getStatusColor(
                                consultation.status
                              )}`}
                            >
                              {getStatusLabel(consultation.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-[#7b8d97]">
                            {formatDate(consultation.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-sm text-[#7b8d97]">
                            {formatDuration(consultation.duracaoSegundos)}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {consultation.foiGravada ? (
                              <span className="text-green-600 font-medium">✓ Sim</span>
                            ) : (
                              <span className="text-[#7b8d97]">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
