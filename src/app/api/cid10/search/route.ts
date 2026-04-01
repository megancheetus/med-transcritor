import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserFromRequest } from '@/lib/authSession';
import { searchCID10 } from '@/lib/cid10Data';

export const runtime = 'nodejs';

/**
 * GET /api/cid10/search?q=diabetes&limit=20
 * Search CID-10 codes by code or name (PT-BR).
 * Requires authentication.
 */
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const query = searchParams.get('q') || '';
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 20, 1), 50) : 20;

  if (!query.trim()) {
    return NextResponse.json({ results: [] });
  }

  const results = searchCID10(query, limit);
  return NextResponse.json({ results });
}
