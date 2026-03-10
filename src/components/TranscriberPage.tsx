'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AudioRecorder from '@/components/AudioRecorder';
import SOAPResponse from '@/components/SOAPResponse';

export default function TranscriberPage() {
  const router = useRouter();
  const [soapContent, setSOAPContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastRecordingTime, setLastRecordingTime] = useState<string>('');
  const [processingError, setProcessingError] = useState('');

  const handleRecordingComplete = async (audioBlob: Blob) => {
    setIsLoading(true);
    setSOAPContent('');
    setProcessingError('');

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.details || data?.error || `API error: ${response.statusText}`);
      }

      setSOAPContent(data.soap);
      setLastRecordingTime(new Date().toLocaleString('pt-BR'));
    } catch (error) {
      console.error('Error:', error);
      setProcessingError((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout');
    router.push('/login');
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-8 sm:py-12">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-900 to-blue-800 rounded-lg flex items-center justify-center">
                <span className="text-white text-xl">📋</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-blue-900">MedTranscritor</h1>
            </div>
            <p className="text-blue-600 text-sm sm:text-base ml-13">
              Transcrição inteligente de consultas em formato SOAP
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            Sair
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 mb-8">
          <div>
            <AudioRecorder onRecordingComplete={handleRecordingComplete} isLoading={isLoading} />
          </div>

          <div>
            <SOAPResponse content={soapContent} isLoading={isLoading} errorMessage={processingError} />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 max-w-4xl mx-auto mb-8 shadow-sm">
          <h2 className="text-xl sm:text-2xl font-bold text-blue-900 mb-6 flex items-center gap-2">
            <span className="text-2xl">📖</span> Como Usar
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-900 text-white rounded-full flex items-center justify-center font-bold text-sm">
                1
              </div>
              <div>
                <p className="text-blue-900">Escolha entre consulta presencial e teleconsulta</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-900 text-white rounded-full flex items-center justify-center font-bold text-sm">
                2
              </div>
              <div>
                <p className="text-blue-900">Autorize o microfone e, na teleconsulta, compartilhe a aba ou janela com áudio</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-900 text-white rounded-full flex items-center justify-center font-bold text-sm">
                3
              </div>
              <div>
                <p className="text-blue-900">Inicie a gravação e conduza a consulta normalmente</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-900 text-white rounded-full flex items-center justify-center font-bold text-sm">
                4
              </div>
              <div>
                <p className="text-blue-900">Pare a gravação ao final da conversa</p>
              </div>
            </div>
            <div className="flex gap-3 sm:col-span-2">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-900 text-white rounded-full flex items-center justify-center font-bold text-sm">
                5
              </div>
              <div>
                <p className="text-blue-900">Receba o SOAP automaticamente e copie para o prontuário eletrônico</p>
              </div>
            </div>
          </div>
        </div>

        {lastRecordingTime && (
          <div className="text-center mb-4">
            <p className="text-xs sm:text-sm text-blue-600 bg-white px-4 py-2 rounded-lg inline-block border border-gray-200">
              ✓ Última processamento: {lastRecordingTime}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}