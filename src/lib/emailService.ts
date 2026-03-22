interface TrialVerificationEmailParams {
  to: string;
  fullName?: string | null;
  verificationUrl: string;
}

function getEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    throw new Error('EMAIL_PROVIDER_NOT_CONFIGURED');
  }

  return { apiKey, from };
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
