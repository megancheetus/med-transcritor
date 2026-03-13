'use client';

import { useRef, useState } from 'react';
import { formatBytes } from '@/lib/audioUtils';

interface AudioFileUploadProps {
  onFileSelected: (file: File, duration: number) => void;
  isLoading?: boolean;
}

interface WindowWithWebkitAudioContext extends Window {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

export default function AudioFileUpload({ onFileSelected, isLoading = false }: AudioFileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [estimatedDuration, setEstimatedDuration] = useState<number>(0);
  const [error, setError] = useState('');

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');

    // Validar tipo
    if (!file.type.startsWith('audio/')) {
      setError('Selecione um arquivo de áudio válido');
      return;
    }

    // Validar tamanho (máximo 200MB para testes)
    const maxSize = 200 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`Arquivo muito grande (${formatBytes(file.size)}). Máximo: ${formatBytes(maxSize)}`);
      return;
    }

    try {
      // Estimar duração analisando o arquivo
      const duration = await estimateAudioDuration(file);
      setSelectedFile(file);
      setEstimatedDuration(duration);
      console.log(`✓ Arquivo selecionado: ${file.name} (${formatBytes(file.size)}) - ~${duration}s`);
    } catch (err) {
      console.error('Erro ao analisar arquivo:', err);
      setError('Não foi possível analisar o arquivo de áudio');
    }
  };

  const estimateAudioDuration = async (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const audioWindow = window as WindowWithWebkitAudioContext;
      const AudioContextClass = audioWindow.AudioContext || audioWindow.webkitAudioContext;

      if (!AudioContextClass) {
        reject(new Error('AudioContext não suportado neste navegador'));
        return;
      }

      const audioContext = new AudioContextClass();
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          resolve(Math.round(audioBuffer.duration));
        } catch (error) {
          console.warn('Não conseguiu estimar duração exata, usando aproximação:', error);
          // Aproximação: assumir tipicamente 100KB por segundo em formato comprimido
          const estimatedSeconds = Math.round((file.size / 100000) * 0.8);
          resolve(Math.max(estimatedSeconds, 1));
        } finally {
          audioContext.close();
        }
      };

      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  };

  const handleSendFile = () => {
    if (selectedFile && estimatedDuration > 0) {
      onFileSelected(selectedFile, estimatedDuration);
      setSelectedFile(null);
      setEstimatedDuration(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setEstimatedDuration(0);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full bg-white rounded-xl border border-[#cfe0e8] p-6 sm:p-8">
      <p className="text-xs font-semibold text-[#4b6573] mb-5 tracking-widest uppercase">
        📤 Upload de Áudio para Teste
      </p>

      <div className="space-y-4">
        {/* Input de Arquivo */}
        <div>
          <label className="block text-sm font-medium text-[#0c161c] mb-3">
            Selecione um arquivo de áudio (.wav, .mp3, .webm, etc)
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileSelect}
            disabled={isLoading || !!selectedFile}
            className="block w-full text-sm text-[#4b6573]
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-medium
              file:bg-[#1a6a8d] file:text-white
              hover:file:bg-[#155b79]
              disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <p className="text-xs text-[#4b6573] mt-2">
            💡 Máximo: 200 MB | Recomendado: &lt; 50 MB (para teste rápido)
          </p>
        </div>

        {/* Erro */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            ❌ {error}
          </div>
        )}

        {/* Arquivo Selecionado */}
        {selectedFile && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <p className="text-sm font-medium text-blue-900 mb-1">
                  ✓ Arquivo selecionado
                </p>
                <div className="space-y-1 text-xs text-blue-700">
                  <p>
                    <strong>Nome:</strong> {selectedFile.name}
                  </p>
                  <p>
                    <strong>Tamanho:</strong> {formatBytes(selectedFile.size)}
                  </p>
                  <p>
                    <strong>Tipo:</strong> {selectedFile.type}
                  </p>
                  <p>
                    <strong>Duração estimada:</strong> ~{estimatedDuration} segundos ({Math.floor(estimatedDuration / 60)}m{estimatedDuration % 60}s)
                  </p>
                </div>
              </div>
            </div>

            {/* Aviso se arquivo é grande */}
            {selectedFile.size > 15 * 1024 * 1024 && (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <p className="font-medium mb-1">⚠️ Arquivo Grande Detectado</p>
                <p>
                  O sistema tentará comprimir antes do envio. Se ainda passar do limite, aí sim será dividido em partes.
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSendFile}
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isLoading ? '🔄 Processando...' : '🚀 Enviar para Processar'}
              </button>
              <button
                onClick={handleClearFile}
                disabled={isLoading}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 text-sm font-medium rounded-md transition disabled:cursor-not-allowed"
              >
                ✕ Limpar
              </button>
            </div>
          </div>
        )}

        {!selectedFile && !isLoading && (
          <div className="rounded-lg border-2 border-dashed border-[#cfe0e8] bg-[#f7fbfc] p-6 text-center">
            <p className="text-sm text-[#4b6573]">Clique no campo acima para selecionar um arquivo</p>
          </div>
        )}

        {isLoading && !selectedFile && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 text-center">
            <div className="flex justify-center mb-3">
              <div className="inline-block animate-spin">
                <div className="text-2xl">⏳</div>
              </div>
            </div>
            <p className="text-sm text-blue-700 font-medium">Processando arquivo...</p>
          </div>
        )}
      </div>

      <p className="text-xs text-[#4b6573] mt-6 pt-4 border-t border-[#cfe0e8]">
        <strong>ℹ️ Como funciona:</strong> Selecione um arquivo de áudio pré-gravado para testar a transcrição sem
        precisar gravar novamente. O app tenta comprimir primeiro e só usa divisão em partes como último recurso.
      </p>
    </div>
  );
}
