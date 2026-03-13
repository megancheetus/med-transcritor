'use client';

import AppShell from '@/components/AppShell';
import { useTranscriptionWorkspace } from '@/components/TranscriptionWorkspaceProvider';
import { getModelById } from '@/lib/transcriptionModels';

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const formatDurationLabel = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const getDayKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getHistoryDate = (entryId: string, fallbackTimestamp: string) => {
  const parsedId = Number(entryId);
  if (Number.isFinite(parsedId) && parsedId > 0) {
    return new Date(parsedId);
  }

  const parsedFallback = new Date(fallbackTimestamp);
  if (!Number.isNaN(parsedFallback.getTime())) {
    return parsedFallback;
  }

  return new Date();
};

export default function DashboardPage() {
  const { history, recordingDuration, lastRecordingTime, selectedModel, isLoading } = useTranscriptionWorkspace();

  const totalSessionDuration = history.reduce((sum, entry) => sum + entry.duration, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const chartSeries = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return {
      dayKey: getDayKey(date),
      label: WEEKDAY_LABELS[date.getDay()],
      count: 0,
    };
  });

  const chartMap = new Map(chartSeries.map((item) => [item.dayKey, item]));

  for (const entry of history) {
    const entryDate = getHistoryDate(entry.id, entry.timestamp);
    entryDate.setHours(0, 0, 0, 0);
    const key = getDayKey(entryDate);
    const chartDay = chartMap.get(key);
    if (chartDay) {
      chartDay.count += 1;
    }
  }

  const maxCount = Math.max(...chartSeries.map((item) => item.count), 0);
  const chartWidth = 800;
  const chartHeight = 200;
  const topPadding = 20;
  const bottomPadding = 30;
  const usableHeight = chartHeight - topPadding - bottomPadding;
  const baselineY = chartHeight - bottomPadding;
  const stepX = chartWidth / (chartSeries.length - 1);

  const points = chartSeries.map((item, index) => {
    const ratio = maxCount === 0 ? 0 : item.count / maxCount;
    const y = baselineY - ratio * usableHeight;
    return {
      x: index * stepX,
      y,
      count: item.count,
      label: item.label,
    };
  });

  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = `${linePath} L ${chartWidth} ${baselineY} L 0 ${baselineY} Z`;
  const weeklyTotal = chartSeries.reduce((sum, item) => sum + item.count, 0);

  return (
    <AppShell
      title="Dashboard OmniNote"
      subtitle="Visão executiva da conta e atividade de transcrição"
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-[#cfe0e8] rounded-xl p-5 shadow-sm">
            <p className="text-sm text-[#4b6573]">Usos registrados</p>
            <p className="text-2xl font-bold text-[#155b79] mt-1">{history.length}</p>
            <p className="text-xs text-[#1ea58c] mt-2">Somente metadados de uso, sem conteúdo transcrito salvo</p>
          </div>

          <div className="bg-white border border-[#cfe0e8] rounded-xl p-5 shadow-sm">
            <p className="text-sm text-[#4b6573]">Última gravação</p>
            <p className="text-2xl font-bold text-[#155b79] mt-1">{recordingDuration > 0 ? formatDurationLabel(recordingDuration) : '--:--'}</p>
            <p className="text-xs text-[#1ea58c] mt-2">Duração da gravação mais recente</p>
          </div>

          <div className="bg-white border border-[#cfe0e8] rounded-xl p-5 shadow-sm">
            <p className="text-sm text-[#4b6573]">Tempo total acumulado</p>
            <p className="text-2xl font-bold text-[#155b79] mt-1">{formatDurationLabel(totalSessionDuration)}</p>
            <p className="text-xs text-[#1ea58c] mt-2">Soma das gravações salvas no histórico</p>
          </div>
        </div>

        <div className="bg-white border border-[#cfe0e8] rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-[#155b79]">Atividade de transcrição</h3>
              <p className="text-sm text-[#4b6573]">Últimos 7 dias: {weeklyTotal} transcrição(ões) registradas</p>
            </div>
            <span className="text-xs px-3 py-1 rounded-full bg-[#effaf7] text-[#1ea58c] font-semibold">
              Modelo ativo: {getModelById(selectedModel).name}
            </span>
          </div>

          <div className="h-52 w-full">
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 800 200">
              <defs>
                <linearGradient id="omniDashboardGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#1a6a8d" stopOpacity="0.2"></stop>
                  <stop offset="100%" stopColor="#1a6a8d" stopOpacity="0"></stop>
                </linearGradient>
              </defs>
              <path d={areaPath} fill="url(#omniDashboardGradient)"></path>
              <path d={linePath} fill="none" stroke="#1a6a8d" strokeWidth="3" strokeLinecap="round"></path>
              {points.map((point) => (
                <g key={`${point.x}-${point.label}`}>
                  <circle cx={point.x} cy={point.y} r="4" fill="#1a6a8d"></circle>
                  <title>{`${point.label}: ${point.count} transcrição(ões)`}</title>
                </g>
              ))}
            </svg>
            <div className="flex justify-between mt-3 px-1 text-xs text-[#4b6573] font-medium">
              {chartSeries.map((item) => (
                <span key={item.dayKey}>{item.label}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#cfe0e8] rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#edf4f6] flex items-center justify-between">
            <h4 className="text-base font-bold text-[#155b79]">Transcrições recentes</h4>
            <span className="text-xs text-[#4b6573]">{isLoading ? 'Processando...' : 'Atualizado'}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#f7fbfc]">
                  <th className="px-6 py-3 text-xs font-semibold text-[#4b6573] uppercase tracking-wider">Modelo</th>
                  <th className="px-6 py-3 text-xs font-semibold text-[#4b6573] uppercase tracking-wider">Data</th>
                  <th className="px-6 py-3 text-xs font-semibold text-[#4b6573] uppercase tracking-wider">Duração</th>
                  <th className="px-6 py-3 text-xs font-semibold text-[#4b6573] uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf4f6]">
                {history.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-6 text-sm text-[#4b6573]">
                      Ainda não há transcrições para exibir.
                    </td>
                  </tr>
                )}

                {history.slice(0, 6).map((entry) => (
                  <tr key={entry.id} className="hover:bg-[#f7fbfc] transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-[#0c161c]">{getModelById(entry.model).name}</td>
                    <td className="px-6 py-4 text-sm text-[#4b6573]">{entry.timestamp}</td>
                    <td className="px-6 py-4 text-sm text-[#4b6573]">{formatDurationLabel(entry.duration)}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#effaf7] text-[#1ea58c]">
                        Concluído
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {lastRecordingTime && (
            <div className="px-6 py-3 border-t border-[#edf4f6] text-xs text-[#4b6573]">
              Último processamento: {lastRecordingTime}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
