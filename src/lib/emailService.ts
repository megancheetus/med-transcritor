interface TrialVerificationEmailParams {
  to: string;
  fullName?: string | null;
  verificationUrl: string;
}

interface AppointmentConfirmationEmailParams {
  to: string;
  patientName?: string | null;
  professionalName: string;
  appointmentDate: Date;
  appointmentType: string;
  appointmentDuration: number;
  appointmentNotes?: string;
}

interface AppointmentReminderEmailParams {
  to: string;
  patientName?: string | null;
  professionalName: string;
  appointmentDate: Date;
  appointmentType: string;
  hoursUntilAppointment: number;
}

interface PatientPortalWelcomeEmailParams {
  to: string;
  patientName?: string | null;
  professionalName?: string | null;
  professionalSpecialty?: string | null;
  professionalCouncil?: string | null;
  firstAccessUrl: string;
  loginUrl: string;
}

interface PatientProfileUpdateEmailParams {
  to: string;
  patientName?: string | null;
  professionalName?: string | null;
  professionalSpecialty?: string | null;
  professionalCouncil?: string | null;
  loginUrl: string;
  dashboardUrl: string;
  recordDate?: string | Date;
  recordType?: string;
  summary?: string;
}

function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeOptionalDateLabel(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return undefined;
    }

    return value.toLocaleDateString('pt-BR');
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('pt-BR');
    }

    return trimmed;
  }

  return undefined;
}

function getEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    throw new Error('EMAIL_PROVIDER_NOT_CONFIGURED');
  }

  return { apiKey, from };
}

function normalizeBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function buildProfessionalDisplay(name: string, specialty?: string | null, council?: string | null): string {
  const parts = [name];
  if (specialty) {
    parts.push(specialty);
  }
  if (council) {
    parts.push(council);
  }
  return parts.join(' — ');
}

function isLocalUrl(url: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(url);
}

export function resolveEmailAppBaseUrl(): string {
  const appUrl = process.env.APP_URL?.trim();
  const publicAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const configured = appUrl || publicAppUrl;

  if (configured) {
    const normalizedConfigured = normalizeBaseUrl(configured);
    const isProd = process.env.NODE_ENV === 'production';

    // Em produção, ignora configuração local acidental (localhost).
    if (!(isProd && isLocalUrl(normalizedConfigured))) {
      return normalizedConfigured;
    }
  }

  const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProductionUrl) {
    return normalizeBaseUrl(vercelProductionUrl);
  }

  return 'https://omninote.com.br';
}

export async function sendTrialVerificationEmail(params: TrialVerificationEmailParams): Promise<void> {
  const { apiKey, from } = getEmailConfig();
  const greeting = params.fullName?.trim() ? `Olá, ${params.fullName.trim()}!` : 'Olá!';

  const subject = 'Confirme seu e-mail para ativar seu teste OmniNote';
  const text = `${greeting}\n\nPara ativar sua conta de teste de 3 dias no OmniNote, confirme seu e-mail clicando no link abaixo:\n${params.verificationUrl}\n\nSe você não solicitou este cadastro, ignore esta mensagem.`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0c161c;">
      <p>${greeting}</p>
      <p>Para ativar sua conta de teste de 3 dias no <strong>OmniNote</strong>, confirme seu e-mail clicando no botão abaixo:</p>
      <p>
        <a href="${params.verificationUrl}" style="display:inline-block;padding:10px 16px;background:#1a6a8d;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">
          Confirmar e-mail
        </a>
      </p>
      <p>Se preferir, copie e cole este link no navegador:</p>
      <p><a href="${params.verificationUrl}">${params.verificationUrl}</a></p>
      <p>Se você não solicitou este cadastro, ignore esta mensagem.</p>
    </div>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`EMAIL_SEND_FAILED: ${details}`);
  }
}

export async function sendAppointmentConfirmationEmail(params: AppointmentConfirmationEmailParams): Promise<void> {
  const { apiKey, from } = getEmailConfig();
  const greeting = params.patientName?.trim() ? `Olá, ${params.patientName.trim()}!` : 'Olá!';
  
  const formattedDate = params.appointmentDate.toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const subject = `Agendamento Confirmado - Consulta com ${params.professionalName}`;
  const text = `${greeting}\n\nSua consulta foi agendada com sucesso!\n\nData e hora: ${formattedDate}\nProfissional: ${params.professionalName}\nTipo de atendimento: ${params.appointmentType}\nDuração: ${params.appointmentDuration} minutos\n${params.appointmentNotes ? `\nAnotações: ${params.appointmentNotes}` : ''}\n\nAcesse a plataforma OmniNote para mais detalhes.`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0c161c; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1a6a8d 0%, #155b79 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 24px;">✓ Agendamento Confirmado</h1>
      </div>
      
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
        <p>${greeting}</p>
        <p>Sua consulta foi agendada com sucesso!</p>
        
        <div style="background: #fff; padding: 20px; border-left: 4px solid #1ea58c; margin: 20px 0; border-radius: 4px;">
          <h3 style="margin-top: 0; color: #1a6a8d;">Detalhes do Agendamento</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666; font-weight: 600; width: 140px;">📅 Data e hora:</td>
              <td style="padding: 8px 0; font-weight: 500;">${formattedDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666; font-weight: 600;">👨‍⚕️ Profissional:</td>
              <td style="padding: 8px 0; font-weight: 500;">${params.professionalName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666; font-weight: 600;">🏥 Tipo:</td>
              <td style="padding: 8px 0; font-weight: 500;">${params.appointmentType}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666; font-weight: 600;">⏱️ Duração:</td>
              <td style="padding: 8px 0; font-weight: 500;">${params.appointmentDuration} minutos</td>
            </tr>
            ${params.appointmentNotes ? `
            <tr>
              <td style="padding: 8px 0; color: #666; font-weight: 600; vertical-align: top;">📝 Anotações:</td>
              <td style="padding: 8px 0; font-weight: 500;">${params.appointmentNotes}</td>
            </tr>
            ` : ''}
          </table>
        </div>
        
        <p style="color: #666; font-size: 14px; margin: 20px 0;">
          <strong>💡 Dica:</strong> Acesse a plataforma OmniNote para consultar a sala de videoconsulta quando for o horário.
        </p>
        
        <p style="text-align: center;">
          <a href="https://omninote.com.br/inbox" style="display: inline-block; padding: 12px 24px; background: #1ea58c; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">
            Acessar Plataforma
          </a>
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
          Este é um e-mail automático. Por favor, não responda.
        </p>
      </div>
    </div>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`EMAIL_SEND_FAILED: ${details}`);
  }
}

export async function sendAppointmentReminderEmail(params: AppointmentReminderEmailParams): Promise<void> {
  const { apiKey, from } = getEmailConfig();
  const greeting = params.patientName?.trim() ? `Olá, ${params.patientName.trim()}!` : 'Olá!';
  
  const formattedDate = params.appointmentDate.toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const subject = `Lembrete: Sua consulta é em ${params.hoursUntilAppointment} horas`;
  const text = `${greeting}\n\nLembrete: Sua consulta é em ${params.hoursUntilAppointment} horas!\n\nData e hora: ${formattedDate}\nProfissional: ${params.professionalName}\nTipo de atendimento: ${params.appointmentType}\n\nAcesse a plataforma OmniNote para conectar à sala de videoconsulta.`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0c161c; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 24px;">⏰ Lembrete de Consulta</h1>
      </div>
      
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
        <p>${greeting}</p>
        <p style="font-size: 16px; color: #d97706; font-weight: 600;">Sua consulta é em ${params.hoursUntilAppointment} horas!</p>
        
        <div style="background: #fff; padding: 20px; border-left: 4px solid #f59e0b; margin: 20px 0; border-radius: 4px;">
          <h3 style="margin-top: 0; color: #1a6a8d;">Detalhes</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666; font-weight: 600; width: 140px;">📅 Data e hora:</td>
              <td style="padding: 8px 0; font-weight: 500;">${formattedDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666; font-weight: 600;">👨‍⚕️ Profissional:</td>
              <td style="padding: 8px 0; font-weight: 500;">${params.professionalName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666; font-weight: 600;">🏥 Tipo:</td>
              <td style="padding: 8px 0; font-weight: 500;">${params.appointmentType}</td>
            </tr>
          </table>
        </div>
        
        <p style="text-align: center;">
          <a href="https://omninote.com.br/agenda" style="display: inline-block; padding: 12px 24px; background: #f59e0b; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">
            Ver Agendamento
          </a>
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
          Este é um e-mail automático. Por favor, não responda.
        </p>
      </div>
    </div>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`EMAIL_SEND_FAILED: ${details}`);
  }
}

export async function sendPatientPortalWelcomeEmail(params: PatientPortalWelcomeEmailParams): Promise<void> {
  const { apiKey, from } = getEmailConfig();
  const greeting = params.patientName?.trim() ? `Olá, ${params.patientName.trim()}!` : 'Olá!';
  const profName = params.professionalName?.trim();
  const profSpecialty = params.professionalSpecialty?.trim();
  const profCouncil = params.professionalCouncil?.trim();
  const profDisplay = profName ? buildProfessionalDisplay(profName, profSpecialty, profCouncil) : null;
  const professionalLine = profDisplay
    ? `Seu profissional ${profDisplay} disponibilizou seu acesso ao portal.`
    : 'Seu profissional disponibilizou seu acesso ao portal.';

  const subject = 'Bem-vindo(a) ao Portal do Paciente OmniNote';
  const text = `${greeting}\n\n${professionalLine}\n\nPasso a passo para o primeiro acesso:\n1) Acesse: ${params.firstAccessUrl}\n2) Informe seu CPF cadastrado e crie sua senha\n3) Depois entre em: ${params.loginUrl}\n\nSempre que houver atualização no seu perfil clínico, você receberá um novo aviso por e-mail.`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0c161c; max-width: 620px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #155b79 0%, #1a6a8d 100%); padding: 28px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Portal do Paciente OmniNote</h1>
      </div>
      <div style="border: 1px solid #dbe7ed; border-top: none; border-radius: 0 0 10px 10px; padding: 24px; background: #f8fbfd;">
        <p>${greeting}</p>
        <p>${professionalLine}</p>
        <p style="margin: 18px 0 10px; font-weight: 700; color: #155b79;">Como acessar:</p>
        <ol style="padding-left: 18px; margin: 0 0 16px;">
          <li style="margin-bottom: 8px;">No primeiro acesso, clique em <a href="${params.firstAccessUrl}">Criar senha</a> e informe seu CPF.</li>
          <li style="margin-bottom: 8px;">Defina uma senha segura para ativar sua conta.</li>
          <li>Depois, faça login em <a href="${params.loginUrl}">${params.loginUrl}</a>.</li>
        </ol>
        <p style="margin-top: 16px;">Você receberá um novo aviso por e-mail quando seu prontuário for atualizado.</p>
      </div>
    </div>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`EMAIL_SEND_FAILED: ${details}`);
  }
}

export async function sendPatientProfileUpdatedEmail(params: PatientProfileUpdateEmailParams): Promise<void> {
  const { apiKey, from } = getEmailConfig();
  const patientName = normalizeOptionalText(params.patientName);
  const professionalName = normalizeOptionalText(params.professionalName);
  const profSpecialty = normalizeOptionalText(params.professionalSpecialty);
  const profCouncil = normalizeOptionalText(params.professionalCouncil);
  const recordType = normalizeOptionalText(params.recordType);
  const summary = normalizeOptionalText(params.summary);
  const dateLabel = normalizeOptionalDateLabel(params.recordDate);

  const greeting = patientName ? `Olá, ${patientName}!` : 'Olá!';
  const profDisplay = professionalName ? buildProfessionalDisplay(professionalName, profSpecialty, profCouncil) : null;
  const professionalLine = profDisplay
    ? `Seu profissional ${profDisplay} registrou novas informações no seu perfil.`
    : 'Novas informações foram registradas no seu perfil.';
  const updateLine = recordType
    ? `Tipo de atualização: ${recordType}`
    : 'Seu prontuário recebeu uma nova atualização.';
  const dateLine = dateLabel ? `Data do registro: ${dateLabel}` : undefined;

  const subject = 'Seu perfil clínico foi atualizado no OmniNote';
  const text = `${greeting}\n\n${professionalLine}\n${updateLine}${dateLine ? `\n${dateLine}` : ''}${summary ? `\nResumo: ${summary}` : ''}\n\nPara consultar os detalhes, acesse: ${params.dashboardUrl}\nCaso precise, faça login primeiro em: ${params.loginUrl}`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0c161c; max-width: 620px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1ea58c 0%, #178c74 100%); padding: 28px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Atualização no seu perfil</h1>
      </div>
      <div style="border: 1px solid #dbe7ed; border-top: none; border-radius: 0 0 10px 10px; padding: 24px; background: #f8fbfd;">
        <p>${greeting}</p>
        <p>${professionalLine}</p>
        <p><strong>${updateLine}</strong></p>
        ${dateLine ? `<p>${dateLine}</p>` : ''}
        ${summary ? `<p><strong>Resumo:</strong> ${summary}</p>` : ''}
        <p style="margin: 20px 0 12px; text-align: center;">
          <a href="${params.dashboardUrl}" style="display: inline-block; padding: 11px 18px; border-radius: 8px; background: #1ea58c; color: #fff; text-decoration: none; font-weight: 700;">
            Acessar meu perfil
          </a>
        </p>
        <p style="font-size: 13px; color: #4b6573; margin-top: 14px;">Se necessário, faça login antes em <a href="${params.loginUrl}">${params.loginUrl}</a>.</p>
      </div>
    </div>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`EMAIL_SEND_FAILED: ${details}`);
  }
}
