import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';

/**
 * POST /api/videoconsultations/[id]/signal
 * Envia uma mensagem de sinalizacao WebRTC (offer, answer, ice-candidate)
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { type, signal, fromRole } = body;

    console.log(`📡 Signal recebido: ${type} de ${fromRole} para sala ${id}`);

    const pool = getPostgresPool();

    // Armazenar em tabela temporária de sinalizacao
    const query = `
      INSERT INTO videoconsulta_signals (room_id, type, signal, from_role)
      VALUES ($1, $2, $3, $4)
    `;

    await pool.query(query, [id, type, JSON.stringify(signal), fromRole]);

    console.log('✅ Signal armazenado');
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('❌ Erro na sinalizacao:', err);
    return NextResponse.json(
      { error: 'Erro ao processar sinal' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/videoconsultations/[id]/signal?fromRole=professional
 * Busca mensagens de sinalizacao para esta role
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const fromRole = request.nextUrl.searchParams.get('fromRole');

    console.log(`🔍 Buscando signals para ${fromRole} na sala ${id}`);

    // Buscar signals destinados a este role (que vieram do outro lado)
    const targetRole = fromRole === 'professional' ? 'patient' : 'professional';

    const pool = getPostgresPool();

    const query = `
      SELECT id, type, signal, from_role, created_at
      FROM videoconsulta_signals
      WHERE room_id = $1 AND from_role = $2
      ORDER BY created_at ASC
    `;

    const result = await pool.query(query, [id, targetRole]);
    const data = result.rows;

    console.log(`📨 ${data?.length || 0} signals encontrados`);

    // Converter os signals
    const signals = data?.map((s: any) => ({
      type: s.type,
      signal: s.signal ? (typeof s.signal === 'string' ? JSON.parse(s.signal) : s.signal) : null,
      createdAt: s.created_at,
    })) || [];

    // Deletar signals processados
    if (data && data.length > 0) {
      const deleteQuery = `
        DELETE FROM videoconsulta_signals
        WHERE room_id = $1 AND from_role = $2
      `;
      await pool.query(deleteQuery, [id, targetRole]);
    }

    return NextResponse.json({ signals });
  } catch (err) {
    console.error('❌ Erro ao buscar signals:', err);
    return NextResponse.json(
      { error: 'Erro ao buscar sinais' },
      { status: 500 }
    );
  }
}
