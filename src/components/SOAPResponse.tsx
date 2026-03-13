'use client';

interface SOAPResponseProps {
  content: string;
  isLoading?: boolean;
  errorMessage?: string;
}

export default function SOAPResponse({ content, isLoading = false, errorMessage = '' }: SOAPResponseProps) {
  // Parse o conteúdo em secções SOAP
  const parseSOAP = (text: string) => {
    const sections = {
      S: '',
      O: '',
      A: '',
      P: '',
    };

    const soapRegex = /([SOAP])\s*\(([^)]+)\):\s*([\s\S]*?)(?=[SOAP]\s*\([^)]+\)|$)/g;
    let match;

    while ((match = soapRegex.exec(text)) !== null) {
      const letter = match[1];
      const content = match[3].trim();
      if (letter in sections) {
        sections[letter as keyof typeof sections] = content;
      }
    }

    return sections;
  };

  const soap = parseSOAP(content);

  const soapFields = [
    { key: 'S', label: 'Subjetivo — Queixa e HDA' },
    { key: 'O', label: 'Objetivo — Sinais vitais e exames' },
    { key: 'A', label: 'Avaliação — Diagnóstico' },
    { key: 'P', label: 'Plano — Conduta' },
  ];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copiado para a área de transferência!');
  };

  return (
    <div className="w-full bg-white rounded-xl border border-[#cfe0e8] p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6 flex-col sm:flex-row gap-3">
        <p className="text-xs font-semibold text-[#4b6573] tracking-widest uppercase">
          Resultado SOAP
        </p>
        {!isLoading && content && (
          <button
            onClick={() => copyToClipboard(content)}
            className="w-full sm:w-auto px-4 py-2 bg-[#1a6a8d] hover:bg-[#155b79] text-white rounded-md transition font-medium text-sm tracking-wide"
          >
            Copiar tudo
          </button>
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
        <div className="space-y-6 w-full">
          {soapFields.map(({ key, label }) => (
            <div
              key={key}
              className="border border-[#cfe0e8] bg-[#f7fbfc] rounded-lg overflow-visible hover:border-[#1a6a8d] transition w-full"
            >
              {/* Header da seção */}
              <div className="bg-[#edf4f6] border-b border-[#cfe0e8] px-5 py-3.5 flex items-center justify-between">
                <h3 className="font-semibold text-[#155b79] text-base tracking-tight">{label}</h3>
                <button
                  onClick={() =>
                    copyToClipboard(
                      soap[key as keyof typeof soap] || '(Não informado)'
                    )
                  }
                  className="text-xs border border-[#cfe0e8] text-[#4b6573] px-3 py-1.5 rounded-md hover:border-[#155b79] hover:text-[#155b79] hover:bg-white transition font-medium whitespace-nowrap flex-shrink-0"
                >
                  Copiar
                </button>
              </div>

              {/* Conteúdo - sem limite de altura */}
              <div className="p-5 w-full">
                <div className="text-[#0c161c] leading-relaxed text-base whitespace-pre-wrap break-words overflow-visible">
                  {soap[key as keyof typeof soap] ? (
                    <p className="text-justify m-0">{soap[key as keyof typeof soap]}</p>
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
        <div className="text-center py-12 bg-[#edf4f6] rounded-xl border border-[#cfe0e8]">
          <p className="text-[#4b6573] text-sm">Grave uma consulta e envie para receber a análise em SOAP aqui.</p>
        </div>
      )}
    </div>
  );
}
