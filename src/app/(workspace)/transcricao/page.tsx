'use client';

import { useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import AudioRecorder from '@/components/AudioRecorder';
import AudioFileUpload from '@/components/AudioFileUpload';
import TranscriptionResult from '@/components/TranscriptionResult';
import { SendToMedicalRecordModal } from '@/components/SendToMedicalRecordModal';
import { getAllModels } from '@/lib/transcriptionModels';
import { formatBytes } from '@/lib/audioUtils';
import { useTranscriptionWorkspace } from '@/components/TranscriptionWorkspaceProvider';

const ENABLE_LEGACY_TEST_UPLOAD = false;

export default function TranscricaoPage() {
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState('');

  const {
    selectedModel,
    setSelectedModel,
    transcriptionContent,
    setTranscriptionContent,
    isLoading,
    processingError,
    compressionStatus,
    processingMeta,
    history,
    handleRecordingComplete,
    handleFileUpload,
  } = useTranscriptionWorkspace();

  const latestHistoryEntryId = useMemo(() => history[0]?.id, [history]);

  return (
    <AppShell
      title="Transcrição"
      subtitle="Ferramenta de gravação e processamento de transcrição clínica"
    >
      <div className="space-y-5 max-w-5xl">
        <div className="bg-white rounded-xl border border-[#cfe0e8] p-6 shadow-sm">
          <label className="block text-xs font-bold text-[#155b79] tracking-widest uppercase mb-4">
            Selecione o modelo de transcrição
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {getAllModels().map((model) => (
              <button
                key={model.id}
                onClick={() => {
                  setSelectedModel(model.id);
                  setTranscriptionContent('');
                }}
                className={`text-left p-4 rounded-xl border-2 transition ${
                  selectedModel === model.id
                    ? 'border-[#1ea58c] bg-gradient-to-br from-[#effaf7] to-[#e5f4f8] shadow-sm'
                    : 'border-[#cfe0e8] bg-white hover:border-[#155b79]'
                }`}
              >
                <p className="font-semibold text-[#155b79] text-sm">{model.name}</p>
                <p className="text-xs text-[#4b6573] mt-1">{model.description}</p>
              </button>
            ))}
          </div>
        </div>

        <AudioRecorder onRecordingComplete={handleRecordingComplete} isLoading={isLoading} />

        {ENABLE_LEGACY_TEST_UPLOAD && (
          <AudioFileUpload onFileSelected={handleFileUpload} isLoading={isLoading} />
        )}

        {compressionStatus && (
          <div className={`rounded-xl border p-4 ${
            compressionStatus.includes('Erro')
              ? 'border-red-200 bg-red-50 text-red-700'
              : compressionStatus.includes('sucesso') || compressionStatus.includes('Processado')
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-blue-200 bg-blue-50 text-blue-700'
          }`}>
            <p className="text-sm font-medium">{compressionStatus}</p>
          </div>
        )}

        {processingMeta && (
          <div className="rounded-xl border border-[#cfe0e8] bg-[#f7fbfc] p-4">
            <p className="text-xs font-semibold text-[#4b6573] tracking-widest uppercase mb-3">Diagnóstico do processamento</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-[#0c161c]">
              <p>Tamanho original: <strong>{formatBytes(processingMeta.originalBytes)}</strong></p>
              <p>Tamanho enviado: <strong>{formatBytes(processingMeta.sentBytes)}</strong></p>
              <p>Compressão aplicada: <strong>{processingMeta.compressed ? 'Sim' : 'Não'}</strong></p>
              <p>Chunking no servidor: <strong>{processingMeta.chunked ? `Sim (${processingMeta.chunksProcessed} partes)` : 'Não'}</strong></p>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-xs font-semibold text-amber-900 tracking-widest uppercase mb-2">Aviso importante</p>
          <p className="text-sm text-amber-900 leading-relaxed">
            As informações transcritas podem conter erros. Todo conteúdo deve ser obrigatoriamente revisado e validado
            pelo profissional de saúde antes de qualquer uso clínico.
          </p>
        </div>

        {saveFeedback && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            {saveFeedback}
          </div>
        )}

        <TranscriptionResult
          content={transcriptionContent}
          model={selectedModel}
          isLoading={isLoading}
          errorMessage={processingError}
          onSendToMedicalRecord={
            transcriptionContent && !processingError
              ? () => {
                  setSaveFeedback('');
                  setIsSendModalOpen(true);
                }
              : undefined
          }
        />

        <SendToMedicalRecordModal
          isOpen={isSendModalOpen}
          transcriptionContent={transcriptionContent}
          sourceRefId={latestHistoryEntryId}
          onClose={() => setIsSendModalOpen(false)}
          onSaved={() => {
            setSaveFeedback('Registro criado com sucesso no prontuario do paciente.');
          }}
        />
      </div>
    </AppShell>
  );
}
