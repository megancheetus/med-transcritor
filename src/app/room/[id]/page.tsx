'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import JitsiRoom from '@/components/JitsiRoom';
import { VideoConsultaRoom } from '@/lib/types';

type LeaveDetails = {
  durationSeconds: number;
  reason: 'manual-hangup' | 'conference-left' | 'ready-to-close' | 'initialization-error';
};

type CpfGateState = 'idle' | 'checking' | 'denied';

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
  
  const [roomData, setRoomData] = useState<VideoConsultaRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'professional' | 'patient' | null>(null);
  const [publicAccessToken, setPublicAccessToken] = useState<string | null>(null);
  const [cpfVerified, setCpfVerified] = useState(false);
  const [cpfInput, setCpfInput] = useState('');
  const [cpfGateState, setCpfGateState] = useState<CpfGateState>('idle');
  const joinReportedRef = useRef(false);

  // Carregar dados da sala e determinar role
  useEffect(() => {
    const loadRoom = async () => {
      try {
        setLoading(true);
        setError(null);

        // Obter token do URL se existir
        const token = new URLSearchParams(window.location.search).get('token');
        setPublicAccessToken(token);

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

  const handleJoinCall = useCallback(async (role: 'professional' | 'patient') => {
    if (joinReportedRef.current) {
      return;
    }

    joinReportedRef.current = true;

    try {
      if (role === 'professional') {
        if (roomData?.status !== 'active') {
          const response = await fetch(`/api/videoconsultations/${roomId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'start' }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.room) {
              setRoomData(data.room);
            }
          }
        }

        return;
      }

      await fetch(`/api/videoconsultations/${roomId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'log_patient_joined',
          token: publicAccessToken,
        }),
      });
    } catch (err) {
      console.error('Erro ao registrar entrada na teleconsulta:', err);
    }
  }, [publicAccessToken, roomData?.status, roomId]);

  const handleVerifyCpf = async () => {
    if (!cpfInput.trim() || !publicAccessToken || !roomId) return;
    setCpfGateState('checking');
    try {
      const res = await fetch(`/api/videoconsultations/${roomId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: publicAccessToken, cpf: cpfInput.trim() }),
      });
      const data = await res.json() as { valid?: boolean };
      if (data.valid) {
        setCpfVerified(true);
      } else {
        setCpfGateState('denied');
      }
    } catch {
      setCpfGateState('denied');
    }
  };

  const handleEndCall = async (duration: number, reason?: LeaveDetails['reason']) => {    try {
      console.log('[VideoRoomPage] Encerrando chamada', { roomId, duration, reason, userRole });

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

  // CPF gate — apenas para pacientes (acesso por token público)
  if (userRole === 'patient' && !cpfVerified) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0c161c] p-4">
        <div className="w-full max-w-md rounded-xl border border-[#26414f] bg-[#10202a] p-6 text-white shadow-xl">
          <h2 className="text-xl font-bold text-[#1ea58c]">Verificação de identidade</h2>
          <p className="mt-1 text-sm text-slate-300">
            Para garantir a segurança da consulta, informe seu CPF para confirmar sua identidade.
          </p>

          <div className="mt-5">
            <label htmlFor="cpf-input" className="block text-xs font-semibold text-slate-400 mb-1">
              CPF (somente números ou com pontuação)
            </label>
            <input
              id="cpf-input"
              type="text"
              inputMode="numeric"
              maxLength={14}
              value={cpfInput}
              onChange={(e) => {
                setCpfInput(e.target.value);
                if (cpfGateState === 'denied') setCpfGateState('idle');
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleVerifyCpf(); }}
              placeholder="000.000.000-00"
              className="w-full rounded-lg border border-[#37627a] bg-[#0c161c] px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-[#1ea58c] focus:outline-none"
            />
            {cpfGateState === 'denied' && (
              <p className="mt-2 text-xs font-medium text-red-400">
                CPF não corresponde ao cadastro desta teleconsulta. Verifique e tente novamente.
              </p>
            )}
          </div>

          <button
            onClick={() => void handleVerifyCpf()}
            disabled={cpfGateState === 'checking' || !cpfInput.trim()}
            className="mt-4 w-full rounded-lg bg-[#1ea58c] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#18956e] disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {cpfGateState === 'checking' ? 'Verificando...' : 'Confirmar e entrar'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <JitsiRoom
      roomId={roomId}
      role={userRole}
      patientId={roomData.patientId}
      displayName={
        userRole === 'professional'
          ? roomData.professionalUsername
          : roomData.patientName || 'Paciente'
      }
      publicAccessToken={publicAccessToken}
      onJoin={async ({ role }) => {
        await handleJoinCall(role);
      }}
      onLeave={async ({ durationSeconds, reason }) => {
        await handleEndCall(durationSeconds, reason);
      }}
    />
  );
}
