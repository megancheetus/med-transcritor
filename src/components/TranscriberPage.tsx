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
    <main className="min-h-screen bg-[#f4f6f9]">

      {/* Header slim */}
      <header className="bg-white border-b border-[#dde2e8]">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-[#1a2e45] rounded-md flex items-center justify-center">
              <span className="text-white text-[10px] font-bold tracking-widest">MT</span>
            </div>
            <span className="font-semibold text-[#1a2e45] text-sm tracking-tight">MedTranscritor</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-[#607080] hover:text-red-600 transition"
          >
            Sair
          </button>
        </div>
      </header>

      {/* Título da página — proeminente */}
      <div className="max-w-5xl mx-auto px-6 pt-10 sm:pt-14 pb-8">
        <h1 className="text-2xl sm:text-[1.75rem] leading-snug font-semibold text-[#1a2e45] tracking-tight mb-2">
          Inicie sua transcrição
        </h1>
        <p className="text-sm text-[#607080] leading-relaxed">
          Grave a consulta e receba o prontuário formatado em SOAP em segundos.
        </p>
      </div>

      {/* Painéis principais */}
      <div className="max-w-5xl mx-auto px-6 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <AudioRecorder onRecordingComplete={handleRecordingComplete} isLoading={isLoading} />
          <SOAPResponse content={soapContent} isLoading={isLoading} errorMessage={processingError} />
        </div>
      </div>

      {/* Como usar — passos horizontais */}
      <div className="max-w-5xl mx-auto px-6 pb-14">
        <div className="bg-white border border-[#dde2e8] rounded-xl p-6 sm:p-8">
          <p className="text-xs font-semibold text-[#607080] mb-6 tracking-widest uppercase">Como usar</p>
          <ol className="flex flex-col sm:flex-row gap-5">
            {[
              'Escolha entre consulta presencial e teleconsulta.',
              'Autorize o microfone — na teleconsulta, compartilhe também a aba com áudio.',
              'Inicie a gravação e conduza a consulta normalmente.',
              'Pare ao final e aguarde o SOAP gerado.',
              'Copie o conteúdo para o prontuário eletrônico.',
            ].map((step, i) => (
              <li key={i} className="flex gap-3 flex-1">
                <span className="flex-shrink-0 w-5 h-5 mt-0.5 rounded-full bg-[#1a2e45] text-white text-[10px] font-semibold flex items-center justify-center">
                  {i + 1}
                </span>
                <p className="text-sm text-[#607080] leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
        </div>

        {lastRecordingTime && (
          <p className="text-xs text-[#607080] text-right mt-4">
            Último processamento: {lastRecordingTime}
          </p>
        )}
      </div>

    </main>
  );
}