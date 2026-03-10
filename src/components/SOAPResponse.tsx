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
    { key: 'S', label: 'Subjetivo (Queixa e HDA)', icon: '👤' },
    { key: 'O', label: 'Objetivo (Sinais Vitais e Exames)', icon: '📊' },
    { key: 'A', label: 'Avaliação (Diagnóstico)', icon: '🔍' },
    { key: 'P', label: 'Plano (Conduta)', icon: '📋' },
  ];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copiado para a área de transferência!');
  };

  return (
    <div className="w-full bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-6 flex-col sm:flex-row gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-blue-900 flex items-center gap-2">
          <span className="text-2xl">📋</span> Resultado SOAP
        </h2>
        {!isLoading && content && (
          <button
            onClick={() => copyToClipboard(content)}
            className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-semibold text-sm shadow-sm hover:shadow-md"
          >
            📋 Copiar Tudo
          </button>
        )}
      </div>

      {isLoading && (
        <div className="text-center py-12">
          <div className="flex justify-center mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
          <p className="text-blue-900 font-medium">Processando áudio com IA...</p>
          <p className="text-blue-600 text-sm mt-2">Isso pode levar alguns segundos</p>
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
          {soapFields.map(({ key, label, icon }) => (
            <div
              key={key}
              className="border border-gray-200 bg-gradient-to-br from-pink-50 to-white rounded-xl p-4 hover:shadow-md hover:border-blue-300 transition"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-bold text-blue-900 text-sm">
                  <span className="text-lg mr-2">{icon}</span>{label}
                </h3>
                <button
                  onClick={() =>
                    copyToClipboard(
                      soap[key as keyof typeof soap] || '(Não informado)'
                    )
                  }
                  className="text-xs bg-blue-600 text-white px-2.5 py-1.5 rounded-md hover:bg-blue-700 transition font-medium whitespace-nowrap ml-2 flex-shrink-0"
                >
                  Copiar
                </button>
              </div>
              <p className="text-blue-900 whitespace-pre-wrap text-sm min-h-24 leading-relaxed bg-white/70 p-3 rounded-lg">
                {soap[key as keyof typeof soap] || '(Não informado na consulta)'}
              </p>
            </div>
          ))}
        </div>
      )}

      {!isLoading && !errorMessage && !content && (
        <div className="text-center py-12 bg-pink-50 rounded-xl border border-gray-200">
          <p className="text-blue-700 font-medium">Grave uma consulta e envie para receber a análise em SOAP aqui.</p>
        </div>
      )}
    </div>
  );
}
