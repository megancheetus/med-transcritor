import { NextRequest, NextResponse } from 'next/server';
import { getUsernameFromAuthToken } from '@/lib/auth';
import { HistoryEntry } from '@/lib/history';
import { getUserHistory, saveUserHistoryEntries, saveUserHistoryEntry } from '@/lib/transcriptionHistoryStore';
import { getModelById } from '@/lib/transcriptionModels';

export const runtime = 'nodejs';

async function getAuthenticatedUsername(request: NextRequest): Promise<string | null> {
  const authToken = request.cookies.get('auth_token')?.value;
  return getUsernameFromAuthToken(authToken);
}

function isHistoryEntry(payload: unknown): payload is HistoryEntry {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const candidate = payload as Partial<HistoryEntry>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.timestamp === 'string' &&
    typeof candidate.duration === 'number' &&
    typeof candidate.model === 'string'
  );
}

function isHistoryEntryArray(payload: unknown): payload is HistoryEntry[] {
  return Array.isArray(payload) && payload.every((entry) => isHistoryEntry(entry));
}

export async function GET(request: NextRequest) {
  const username = await getAuthenticatedUsername(request);

  if (!username) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  try {
    const history = await getUserHistory(username);
    return NextResponse.json({ history });
  } catch (error) {
    console.error('Erro ao carregar histórico:', error);
    return NextResponse.json({ error: 'Não foi possível carregar o histórico' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const username = await getAuthenticatedUsername(request);

  if (!username) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  try {
    const payload = await request.json();

    if (isHistoryEntryArray(payload)) {
      for (const entry of payload) {
        getModelById(entry.model);
      }

      const history = await saveUserHistoryEntries(username, payload);
      return NextResponse.json({ history });
    }

    if (!isHistoryEntry(payload)) {
      return NextResponse.json({ error: 'Entrada de histórico inválida' }, { status: 400 });
    }

    getModelById(payload.model);

    const history = await saveUserHistoryEntry(username, payload);
    return NextResponse.json({ history });
  } catch (error) {
    console.error('Erro ao salvar histórico:', error);
    return NextResponse.json({ error: 'Não foi possível salvar o histórico' }, { status: 500 });
  }
}