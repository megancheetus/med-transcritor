'use client';

import { useState, useRef } from 'react';

interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void;
  isLoading?: boolean;
}

export default function AudioRecorder({ onRecordingComplete, isLoading = false }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);

      // Timer para contar o tempo
      timerIntervalRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Erro ao acessar o microfone:', error);
      alert('Não foi possível acessar o microfone. Verifique suas permissões.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        onRecordingComplete(audioBlob);
      };

      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);

      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow">
      <h2 className="text-xl sm:text-2xl font-bold mb-6 text-blue-900 flex items-center gap-2">
        <span className="text-2xl">🎤</span> Grava sua Consulta
      </h2>

      <div className="flex flex-col items-center gap-6">
        {isRecording && (
          <div className="w-full text-center bg-red-50 rounded-xl border border-red-200 p-6">
            <div className="flex justify-center mb-3">
              <div className="inline-block animate-pulse">
                <div className="w-5 h-5 bg-red-500 rounded-full"></div>
              </div>
            </div>
            <p className="text-lg font-semibold text-blue-900 mb-2">Gravando consulta...</p>
            <p className="text-4xl font-mono font-bold text-blue-600">{formatDuration(duration)}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          {!isRecording ? (
            <button
              onClick={startRecording}
              disabled={isLoading}
              className="flex-1 sm:flex-none px-6 py-3 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-lg disabled:bg-gray-400 transition-all shadow-sm hover:shadow-md disabled:shadow-none"
            >
              🎙️ Iniciar Gravação
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="flex-1 sm:flex-none px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg transition-all shadow-sm hover:shadow-md"
            >
              ⏹️ Parar Gravação
            </button>
          )}
        </div>

        {!isRecording && duration > 0 && (
          <div className="w-full bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <p className="text-sm text-green-700 font-medium">
              ✓ Gravação de {formatDuration(duration)} salva com sucesso
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
