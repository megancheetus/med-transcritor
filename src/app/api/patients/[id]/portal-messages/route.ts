import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUserFromRequest } from '@/lib/authSession';
import { getPatientById } from '@/lib/patientManager';
import { getPatientPortalUserById } from '@/lib/patientPortalAuth';
import { sendPatientPortalMessage } from '@/lib/patientPortalMessageManager';
import { rateLimitMiddleware } from '@/lib/rateLimit';
import { parseWithSchema } from '@/lib/schemas/apiValidation';
import { routeIdSchema } from '@/lib/schemas/patients';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const sendPortalMessageSchema = z.object({
  title: z.string().trim().min(3, 'Título deve ter ao menos 3 caracteres.').max(160, 'Título deve ter no máximo 160 caracteres.'),
  body: z.string().trim().min(5, 'Mensagem deve ter ao menos 5 caracteres.').max(5000, 'Mensagem deve ter no máximo 5000 caracteres.'),
  attachmentUrl: z.string().url('URL do anexo inválida.').optional(),
  attachmentName: z.string().trim().min(1, 'Nome do anexo inválido.').max(255, 'Nome do anexo muito grande.').optional(),
  attachmentMimeType: z.string().trim().min(1).max(120).optional(),
  attachmentSizeBytes: z.coerce.number().int().min(1).max(20 * 1024 * 1024).optional(),
});

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, 'patients:id:portal-messages:post', {
      windowMs: 60_000,
      maxRequests: 60,
      message: 'Muitas mensagens enviadas em pouco tempo. Tente novamente em instantes.',
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const user = await getAuthenticatedUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!user.isAdmin && !user.moduleAccess.prontuario) {
      return NextResponse.json({ error: 'Seu plano não possui acesso ao módulo de prontuário' }, { status: 403 });
    }

    const idValidation = parseWithSchema(routeIdSchema, await params);
    if (!idValidation.success) {
      return idValidation.response;
    }

    const payloadValidation = parseWithSchema(sendPortalMessageSchema, await request.json());
    if (!payloadValidation.success) {
      return payloadValidation.response;
    }

    const { id: patientId } = idValidation.data;
    const patient = await getPatientById(patientId, user.username);

    if (!patient) {
      return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 });
    }

    const patientPortalUser = await getPatientPortalUserById(patientId);

    if (!patientPortalUser) {
      return NextResponse.json(
        { error: 'Paciente ainda não ativou acesso ao Painel de Pacientes.' },
        { status: 400 }
      );
    }

    const message = await sendPatientPortalMessage({
      patientId,
      professionalUsername: user.username,
      professionalDisplayName: user.fullName || user.username,
      title: payloadValidation.data.title,
      body: payloadValidation.data.body,
      attachmentUrl: payloadValidation.data.attachmentUrl,
      attachmentName: payloadValidation.data.attachmentName,
      attachmentMimeType: payloadValidation.data.attachmentMimeType,
      attachmentSizeBytes: payloadValidation.data.attachmentSizeBytes,
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error('[patients/:id/portal-messages] POST error:', error);
    return NextResponse.json(
      { error: 'Erro ao enviar mensagem para o painel do paciente.' },
      { status: 500 }
    );
  }
}
