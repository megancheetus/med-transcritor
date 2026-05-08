'use client';

import { useMemo, useState } from 'react';
import { getModelById, TranscriptionModelType } from '@/lib/transcriptionModels';

function parsePatientInstructions(text: string): { mainContent: string; instructions: string } {
  const marker = /ORIENTAÇÕES AO PACIENTE:\s*/i;
  const match = marker.exec(text);
  if (!match) {
    return { mainContent: text, instructions: '' };
  }
  const mainContent = text.slice(0, match.index).trimEnd();
  const instructions = text.slice(match.index + match[0].length).trim();
  return { mainContent, instructions };
}

interface TranscriptionResultProps {
  content: string;
  model: TranscriptionModelType;
  isLoading?: boolean;
  errorMessage?: string;
  onSendToMedicalRecord?: () => void;
}

export default function TranscriptionResult({
  content,
  model,
  isLoading = false,
  errorMessage = '',
  onSendToMedicalRecord,
}: TranscriptionResultProps) {
  const transcriptionModel = getModelById(model);

  const { mainContent, instructions } = useMemo(
    () => parsePatientInstructions(content),
    [content]
  );

  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field?: string) => {
    navigator.clipboard.writeText(text);
    if (field) {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } else {
      alert('Copiado para a área de transferência!');
    }
  };

  return (
    <div className="w-full bg-white rounded-xl border border-[#cfe0e8] p-6 sm:p-8">
      <div className="flex items-center justify-between mb-5 flex-col sm:flex-row gap-3">
        <div>
          <p className="text-xs font-semibold text-[#4b6573] tracking-widest uppercase">
            Resultado — {transcriptionModel.name}
          </p>
          <p className="text-xs text-[#4b6573] mt-1">{transcriptionModel.description}</p>
        </div>
        {!isLoading && content && (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {onSendToMedicalRecord && (
              <button
                onClick={onSendToMedicalRecord}
                className="w-full sm:w-auto rounded-md bg-[#1ea58c] px-4 py-2 text-sm font-medium tracking-wide text-white transition hover:bg-[#18956e]"
              >
                Enviar ao prontuario
              </button>
            )}
            <button
              onClick={() => copyToClipboard(mainContent)}
              className="w-full sm:w-auto px-4 py-2 bg-[#1a6a8d] hover:bg-[#155b79] text-white rounded-md transition font-medium text-sm tracking-wide"
            >
              Copiar tudo
            </button>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="text-center py-12">
          <div className="flex justify-center mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1a6a8d]"></div>
          </div>
          <p className="text-[#0c161c] font-medium">Processando áudio...</p>
          <p className="text-[#4b6573] text-sm mt-2">Isso pode levar alguns segundos</p>
        </div>
      )}

      {!isLoading && errorMessage && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">Falha ao processar o áudio</p>
          <p className="mt-2 text-sm text-red-700 whitespace-pre-wrap">{errorMessage}</p>
        </div>
      )}

      {!isLoading && !errorMessage && content && (
        <div className="space-y-5">
          <div className="w-full border border-[#cfe0e8] bg-[#f7fbfc] rounded-lg overflow-hidden">
            <div className="bg-[#edf4f6] border-b border-[#cfe0e8] px-5 py-3.5">
              <h3 className="font-semibold text-[#155b79] text-base tracking-tight">Transcrição completa</h3>
            </div>
            <div className="p-5">
              <div className="text-[#0c161c] leading-relaxed text-base whitespace-pre-wrap break-words min-h-[220px]">
                {mainContent}
              </div>
            </div>
          </div>

          {instructions && (
            <div className="w-full border-2 border-[#1ea58c]/40 bg-emerald-50/60 rounded-lg overflow-hidden">
              <div className="bg-emerald-100/80 border-b border-[#1ea58c]/30 px-5 py-3.5 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-emerald-900 text-base tracking-tight">
                    Orientações ao Paciente
                  </h3>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Extraído do áudio — copie para receituário ou documento ao paciente
                  </p>
                </div>
                <button
                  onClick={() => copyToClipboard(instructions, 'instructions')}
                  className="shrink-0 ml-3 px-4 py-2 bg-[#1ea58c] hover:bg-[#18956e] text-white rounded-md transition font-medium text-sm tracking-wide"
                >
                  {copiedField === 'instructions' ? '✓ Copiado' : 'Copiar orientações'}
                </button>
              </div>
              <div className="p-5">
                <div className="text-emerald-950 leading-relaxed text-base whitespace-pre-wrap break-words">
                  {instructions}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!isLoading && !errorMessage && !content && (
        <div className="text-center py-12 bg-[#edf4f6] rounded-xl border border-[#cfe0e8]">
          <p className="text-[#4b6573] text-sm">Grave uma consulta e envie para receber a análise aqui.</p>
        </div>
      )}
    </div>
  );
}
