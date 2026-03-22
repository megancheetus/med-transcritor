'use client';

import AppShell from '@/components/AppShell';
import { useTranscriptionWorkspace } from '@/components/TranscriptionWorkspaceProvider';
import { getModelById } from '@/lib/transcriptionModels';

const formatDurationLabel = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function HistoricoPage() {
  const { history } = useTranscriptionWorkspace();

  return (
    <AppShell
      title="Histórico"
      subtitle="Histórico de uso do transcritor e modelos utilizados"
    >
      <div className="bg-white border border-[#cfe0e8] rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#edf4f6] flex items-center justify-between">
          <h4 className="text-base font-bold text-[#155b79]">Histórico da conta</h4>
          <span className="text-xs px-3 py-1 rounded-full bg-[#effaf7] text-[#1ea58c] font-semibold">
            {history.length} registro(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#f7fbfc]">
                <th className="px-6 py-3 text-xs font-semibold text-[#4b6573] uppercase tracking-wider">Modelo</th>
                <th className="px-6 py-3 text-xs font-semibold text-[#4b6573] uppercase tracking-wider">Data</th>
                <th className="px-6 py-3 text-xs font-semibold text-[#4b6573] uppercase tracking-wider">Duração</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf4f6]">
              {history.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-6 text-sm text-[#4b6573]">
                    Nenhum uso foi registrado ainda.
                  </td>
                </tr>
              )}

              {history.map((entry) => (
                <tr key={entry.id} className="hover:bg-[#f7fbfc] transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-[#0c161c]">{getModelById(entry.model).name}</td>
                  <td className="px-6 py-4 text-sm text-[#4b6573]">{entry.timestamp}</td>
                  <td className="px-6 py-4 text-sm text-[#4b6573]">{formatDurationLabel(entry.duration)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
