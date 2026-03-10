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
    <div className="w-full bg-white rounded-xl border border-[#dde2e8] p-6 sm:p-8">
      <div className="flex items-center justify-between mb-5 flex-col sm:flex-row gap-3">
        <p className="text-xs font-semibold text-[#607080] tracking-widest uppercase">
          Resultado SOAP
        </p>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {soapFields.map(({ key, label }) => (
            <div
              key={key}
              className="border border-[#dde2e8] bg-white rounded-lg p-4 hover:border-[#4a7fa5] transition"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-medium text-[#1a2e45] text-sm tracking-tight">{label}</h3>
                <button
                  onClick={() =>
                    copyToClipboard(
                      soap[key as keyof typeof soap] || '(Não informado)'
                    )
                  }
                  className="text-xs border border-[#dde2e8] text-[#607080] px-2.5 py-1.5 rounded-md hover:border-[#1a2e45] hover:text-[#1a2e45] transition font-medium whitespace-nowrap ml-2 flex-shrink-0"
                >
                  Copiar
                </button>
              </div>
              <p className="text-[#1a2e45] whitespace-pre-wrap text-sm min-h-24 leading-relaxed bg-[#f4f6f9] p-3 rounded-md">
                {soap[key as keyof typeof soap] || '—'}
              </p>
            </div>
          ))}
        </div>
      )}

      {!isLoading && !errorMessage && !content && (
        <div className="text-center py-12 bg-[#f4f6f9] rounded-xl border border-[#dde2e8]">
          <p className="text-[#607080] text-sm">Grave uma consulta e envie para receber a análise em SOAP aqui.</p>
        </div>
      )}
    </div>
  );
}
