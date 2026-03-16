'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { VideoCallComponent } from '@/components/VideoCallComponent';

/**
 * Página de teleconsulta (para prof e paciente)
 * Rota pública: /room/[id]
 * - Profissional: acessa autenticado, pode gravar (role=professional)
 * - Paciente: acessa via link público, sem login (role=patient)
 */
export default function VideoRoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.id as string;
  
  const [roomData, setRoomData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'professional' | 'patient' | null>(null);

  // Carregar dados da sala e determinar role
  useEffect(() => {
    const loadRoom = async () => {
      try {
        setLoading(true);
        setError(null);

        // Obter token do URL se existir
        const token = new URLSearchParams(window.location.search).get('token');

        // URL base da requisição
        let url = `/api/videoconsultations/${roomId}`;
        
        // Se houver token público, usar ele primeiro
        if (token) {
          url += `?token=${token}`;
        }

        // Fazer requisição
        const response = await fetch(url);

        if (!response.ok) {
          if (response.status === 404) {
            setError('Sala de teleconsulta não encontrada ou expirou.');
            return;
          }
          throw new Error(`Erro ao carregar sala (${response.status})`);
        }

        const data = await response.json();
        setRoomData(data.room);

        // Determinar role do usuário
        const queryRole = new URLSearchParams(window.location.search).get('role');
        if (queryRole === 'professional' || queryRole === 'patient') {
          setUserRole(queryRole as 'professional' | 'patient');
        } else {
          // Default: paciente se não especificado (acesso público)
          setUserRole('patient');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar sala';
        console.error('Erro ao carregar sala:', message);
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    if (roomId) {
      loadRoom();
    }
  }, [roomId]);

  const handleEndCall = async (duration: number) => {
    try {
      if (userRole === 'professional' && roomData) {
        // Profissional finaliza
        await fetch(`/api/videoconsultations/${roomId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'end',
            duracaoSegundos: duration,
            foiGravada: false,
          }),
        });

        router.push('/teleconsulta');
      } else {
        // Paciente: apenas volta
        router.push('/');
      }
    } catch (err) {
      console.error('Erro ao finalizar chamada:', err);
      router.back();
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0c161c]">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#1ea58c] mb-4 animate-spin">
            <div className="h-8 w-8 rounded-full border-4 border-[#0c161c] border-t-white"></div>
          </div>
          <p className="text-white text-lg font-medium">Carregando sala de teleconsulta...</p>
          <p className="text-[#7b8d97] text-sm mt-2">Aguarde um momento...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0c161c] p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-white mb-2">Sala Indisponível</h2>
          <p className="text-[#7b8d97] mb-6">{error}</p>
          <button
            onClick={() => window.close()}
            className="px-6 py-2 bg-[#1ea58c] hover:bg-[#18956e] text-white font-medium rounded-lg transition"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  if (!roomData || !userRole) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0c161c]">
        <p className="text-white">Carregando...</p>
      </div>
    );
  }

  return (
    <VideoCallComponent
      roomId={roomId}
      roomToken={roomData.roomToken}
      role={userRole}
      professionalName={roomData.professionalUsername}
      patientName={roomData.patientName}
      onEndCall={handleEndCall}
    />
  );
}
