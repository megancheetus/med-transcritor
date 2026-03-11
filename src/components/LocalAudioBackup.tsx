'use client';

import { useEffect, useState } from 'react';
import { audioStorageManager, type StoredAudio } from '@/lib/audioStorageManager';

interface LocalAudioBackupProps {
  refreshTrigger?: number;
}

export default function LocalAudioBackup({ refreshTrigger = 0 }: LocalAudioBackupProps) {
  const [savedAudios, setSavedAudios] = useState<StoredAudio[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [storageInfo, setStorageInfo] = useState<{ used: number; quota: number }>({ used: 0, quota: 0 });
  const [error, setError] = useState('');

  const loadAudios = async () => {
    try {
      setIsLoading(true);
      setError('');
      const audios = await audioStorageManager.getAllAudios();
      setSavedAudios(audios);
      
      const info = await audioStorageManager.getStorageInfo();
      setStorageInfo(info);
    } catch (err) {
      console.error('Erro ao carregar áudios:', err);
      setError('Não foi possível carregar os áudios salvos.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAudios();
  }, [refreshTrigger]);

  const handleDelete = async (audioId: string) => {
    try {
      await audioStorageManager.deleteAudio(audioId);
      setSavedAudios((prev) => prev.filter((a) => a.id !== audioId));
    } catch (err) {
      console.error('Erro ao deletar áudio:', err);
      setError('Não foi possível deletar o áudio.');
    }
  };

  const handleDownload = async (audio: StoredAudio) => {
    try {
      const timestamp = new Date(audio.timestamp).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).replace(/[/:]/g, '-');
      const filename = `consulta_${timestamp}.wav`;
      
      await audioStorageManager.downloadAudio(audio.id, filename);
    } catch (err) {
      console.error('Erro ao fazer download:', err);
      setError('Não foi possível fazer o download do áudio.');
    }
  };

  const handleCleanup = async () => {
    if (window.confirm('Deseja deletar todos os áudios processados com sucesso?')) {
      try {
        const cleaned = await audioStorageManager.cleanupCompleted();
        await loadAudios();
      } catch (err) {
        console.error('Erro ao fazer limpeza:', err);
        setError('Não foi possível limpar os áudios.');
      }
    }
  };

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'failed':
        return 'bg-red-100 text-red-700';
      case 'processing':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return '✅ Processado';
      case 'failed':
        return '❌ Falha';
      case 'processing':
        return '🔄 Processando';
      default:
        return '⏳ Pendente';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="bg-white border border-[#dde2e8] rounded-xl p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <p className="text-xs font-semibold text-[#607080] tracking-widest uppercase">
          💾 Backup Local de Áudios
        </p>
        {savedAudios.length > 0 && (
          <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium">
            {savedAudios.length} arquivo{savedAudios.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Informação de Armazenamento */}
      {storageInfo.quota > 0 && (
        <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-900">Espaço de Armazenamento</p>
            <p className="text-xs text-slate-600">
              {formatFileSize(storageInfo.used)} / {formatFileSize(storageInfo.quota)}
            </p>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-500 h-full rounded-full"
              style={{ width: `${(storageInfo.used / storageInfo.quota) * 100}%` }}
            />
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8">
          <p className="text-sm text-[#607080]">Carregando áudios...</p>
        </div>
      ) : savedAudios.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-sm text-[#607080] mb-2">Nenhum áudio salvo ainda.</p>
          <p className="text-xs text-[#607080]">
            Todos os áudios gravados serão salvos automaticamente como backup.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3 mb-4">
            {savedAudios.map((audio) => (
              <div
                key={audio.id}
                className="border border-[#dde2e8] rounded-lg p-4 bg-[#f9fafb] hover:bg-[#f4f6f9] transition"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusBadgeClass(audio.status)}`}>
                        {statusLabel(audio.status)}
                      </span>
                      {audio.error && (
                        <span className="text-xs text-red-600 font-mono">{audio.error.substring(0, 50)}</span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-[#1a2e45] mb-1">
                      {new Date(audio.timestamp).toLocaleString('pt-BR')}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-[#607080]">
                      <span>📏 {audio.duration} segundos ({Math.floor(audio.duration / 60)}m)</span>
                      <span>💾 {formatFileSize(audio.blob.size)}</span>
                      <span>🏷️ {audio.model}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleDownload(audio)}
                    disabled={audio.status === 'processing'}
                    className="flex-1 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    📥 Download
                  </button>
                  <button
                    onClick={() => handleDelete(audio.id)}
                    disabled={audio.status === 'processing'}
                    className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-medium rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>

          {savedAudios.some((a) => a.status === 'completed') && (
            <button
              onClick={handleCleanup}
              className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition"
            >
              🧹 Limpar processados
            </button>
          )}
        </>
      )}

      <p className="text-xs text-[#607080] mt-6 pt-4 border-t border-[#dde2e8]">
        <strong>ℹ️ Como usar:</strong> Os áudios são salvos automaticamente no seu navegador como backup. 
        Se a transcrição falhar, você poderá recuperá-los aqui. Os arquivos são armazenados localmente e nunca 
        enviados para servidor externo.
      </p>
    </div>
  );
}
