import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserFromRequest } from '@/lib/authSession';
import { updateUserProfile } from '@/lib/authUsers';

export const runtime = 'nodejs';

const VALID_UF = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
  'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC',
  'SP','SE','TO',
];

export async function PUT(request: NextRequest) {
  const user = await getAuthenticatedUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const body = await request.json() as Record<string, unknown>;

  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : undefined;
  const dateOfBirth = typeof body.dateOfBirth === 'string' ? body.dateOfBirth.trim() : undefined;
  const cpf = typeof body.cpf === 'string' ? body.cpf.replace(/\D/g, '').trim() : undefined;
  const specialty = typeof body.specialty === 'string' ? body.specialty.trim() : undefined;
  const councilNumber = typeof body.councilNumber === 'string' ? body.councilNumber.trim() : undefined;
  const councilState = typeof body.councilState === 'string' ? body.councilState.trim().toUpperCase() : undefined;

  if (fullName !== undefined && fullName.length === 0) {
    return NextResponse.json({ error: 'Nome completo não pode ser vazio' }, { status: 400 });
  }

  if (cpf !== undefined && cpf.length > 0 && cpf.length !== 11) {
    return NextResponse.json({ error: 'CPF deve conter 11 dígitos' }, { status: 400 });
  }

  if (dateOfBirth !== undefined && dateOfBirth.length > 0 && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    return NextResponse.json({ error: 'Data de nascimento inválida (formato: AAAA-MM-DD)' }, { status: 400 });
  }

  if (councilState !== undefined && councilState.length > 0 && !VALID_UF.includes(councilState)) {
    return NextResponse.json({ error: 'Estado do conselho inválido' }, { status: 400 });
  }

  const updated = await updateUserProfile(user.username, {
    fullName: fullName || undefined,
    dateOfBirth: dateOfBirth || undefined,
    cpf: cpf || undefined,
    specialty: specialty || undefined,
    councilNumber: councilNumber || undefined,
    councilState: councilState || undefined,
  });

  return NextResponse.json({ user: updated });
}
