'use client';

import { getModelById, TranscriptionModelType } from '@/lib/transcriptionModels';

interface TranscriptionResultProps {
  content: string;
  model: TranscriptionModelType;
  isLoading?: boolean;
  errorMessage?: string;
}

export default function TranscriptionResult({
  content,
  model,
  isLoading = false,
  errorMessage = '',
}: TranscriptionResultProps) {
  const parseContent = (text: string, modelType: TranscriptionModelType) => {
    const sections: Record<string, string> = {};
    const transcriptionModel = getModelById(modelType);

    transcriptionModel.sections.forEach((section) => {
      const regex = new RegExp(`${section}\\s*\\([^)]*\\):\\s*([\\s\\S]*?)(?=${
        transcriptionModel.sections.filter((s) => s !== section).join('|')}\\s*\\(|$)`, 'g'
      );

      const match = regex.exec(text);
      if (match) {
        sections[section] = match[1].trim();
      } else {
        // Fallback: try simpler regex
        const simpleRegex = new RegExp(`^${section}\\s*(?:\\([^)]*\\))?:\\s*([\\s\\S]*?)$`, 'm');
        const simpleMatch = simpleRegex.exec(text);
        if (simpleMatch) {
          sections[section] = simpleMatch[1].trim();
        }
      }
    });

    return sections;
  };

  const transcriptionModel = getModelById(model);
  const sections = parseContent(content, model);

  const sectionLabels: Record<string, string> = {
    S: 'Subjetivo',
    O: 'Objetivo',
    A: 'Avaliação',
    P: 'Plano',
    QP: 'Queixa Principal e Duração',
    HDA: 'História da Doença Atual',
    HP: 'Histórico Pessoal',
    HF: 'Histórico Familiar',
    EF: 'Exame Físico',
    HD: 'Hipóteses Diagnósticas',
    CONDUTA: 'Conduta',
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copiado para a área de transferência!');
  };

  return (
    <div className="w-full bg-white rounded-xl border border-[#dde2e8] p-6 sm:p-8">
      <div className="flex items-center justify-between mb-5 flex-col sm:flex-row gap-3">
        <div>
          <p className="text-xs font-semibold text-[#607080] tracking-widest uppercase">
            Resultado — {transcriptionModel.name}
          </p>
          <p className="text-xs text-[#607080] mt-1">{transcriptionModel.description}</p>
        </div>
        {!isLoading && content && (
          <button
            onClick={() => copyToClipboard(content)}
            className="w-full sm:w-auto px-4 py-2 bg-[#1a2e45] hover:bg-[#234060] text-white rounded-md transition font-medium text-sm tracking-wide"
          >
            Copiar tudo
          </button>
        )}
      </div>

      {isLoading && (
        <div className="text-center py-12">
          <div className="flex justify-center mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1a2e45]"></div>
          </div>
          <p className="text-[#1a2e45] font-medium">Processando áudio...</p>
          <p className="text-[#607080] text-sm mt-2">Isso pode levar alguns segundos</p>
        </div>
      )}

      {!isLoading && errorMessage && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">Falha ao processar o áudio</p>
          <p className="mt-2 text-sm text-red-700 whitespace-pre-wrap">{errorMessage}</p>
        </div>
      )}

      {!isLoading && !errorMessage && content && (
        <div className="space-y-6 w-full">
          {transcriptionModel.sections.map((section) => (
            <div
              key={section}
              className="border border-[#dde2e8] bg-[#f9fafb] rounded-lg overflow-visible hover:border-[#4a7fa5] transition w-full"
            >
              {/* Header da seção */}
              <div className="bg-[#f4f6f9] border-b border-[#dde2e8] px-5 py-3.5 flex items-center justify-between">
                <h3 className="font-semibold text-[#003f87] text-base tracking-tight">
                  {sectionLabels[section] || section}
                </h3>
                <button
                  onClick={() =>
                    copyToClipboard(sections[section] || '(Não informado)')
                  }
                  className="text-xs border border-[#dde2e8] text-[#607080] px-3 py-1.5 rounded-md hover:border-[#003f87] hover:text-[#003f87] hover:bg-white transition font-medium whitespace-nowrap flex-shrink-0"
                >
                  Copiar
                </button>
              </div>

              {/* Conteúdo - sem limite de altura */}
              <div className="p-5 w-full">
                <div className="text-[#1a2e45] leading-relaxed text-base whitespace-pre-wrap break-words overflow-visible">
                  {sections[section] ? (
                    <p className="text-justify m-0">{sections[section]}</p>
                  ) : (
                    <p className="text-[#9ca3af] italic">— Não informado</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && !errorMessage && !content && (
        <div className="text-center py-12 bg-[#f4f6f9] rounded-xl border border-[#dde2e8]">
          <p className="text-[#607080] text-sm">Grave uma consulta e envie para receber a análise aqui.</p>
        </div>
      )}
    </div>
  );
}
