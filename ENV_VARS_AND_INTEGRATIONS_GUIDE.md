# Environment Variables & Third-Party Integration Guide

## Current Environment Variables (.env.local)

### AI/LLM Services
```
GEMINI_API_KEY=your_gemini_api_key_here
```
- **Purpose**: Google Generative AI for audio transcription processing
- **Scope**: Server-side only (NOT exposed via NEXT_PUBLIC_)
- **Used in**: `src/app/api/transcribe/route.ts`, `src/lib/emailService.ts`
- **Access Pattern**: `process.env.GEMINI_API_KEY`

### Authentication
```
AUTH_TOKEN_SECRET=your_auth_token_secret_here
```
- **Purpose**: JWT token signing for user authentication
- **Scope**: Server-side only
- **Used in**: `src/lib/auth.ts`
- **Access Pattern**: `process.env.AUTH_TOKEN_SECRET`

### Database
```
DATABASE_URL=postgresql://postgres.your-project-ref:your_db_password@aws-0-us-west-2.pooler.supabase.com:6543/postgres
POSTGRES_SSL=true
POSTGRES_SSL_REJECT_UNAUTHORIZED=false
```
- **Purpose**: PostgreSQL/Supabase connection
- **Scope**: Server-side only
- **Used in**: `src/lib/postgres.ts`
- **SSL Configuration**: Supports both production SSL and development

### Jitsi as a Service (JaaS/Teleconsulta)
```
JAAS_APP_ID=your_jaas_app_id_here
JAAS_KEY_ID=your_jaas_key_id_here
JAAS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
JAAS_DOMAIN=8x8.vc
```
- **Purpose**: Video conferencing for teleconsulta (remote consultations)
- **Scope**: JAAS_* are server-side; NEXT_PUBLIC_JAAS_DOMAIN is public
- **Used in**: `src/lib/jaas.ts`, `src/app/api/videoconsultations/route.ts`
- **Access Pattern**: `process.env.JAAS_APP_ID`, `process.env.JAAS_PRIVATE_KEY`, etc.

### Email Service (Resend)
```
RESEND_API_KEY=re_your_resend_api_key_here
EMAIL_FROM=OmniNote <no-reply@notifications.omninote.com.br>
```
- **Purpose**: Transactional email sending (trial verification, appointment confirmations)
- **Scope**: Server-side only
- **Used in**: `src/lib/emailService.ts`
- **Access Pattern**: `process.env.RESEND_API_KEY`, `process.env.EMAIL_FROM`

### Storage (Vercel Blob)
```
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_your_blob_token_here
```
- **Purpose**: Direct audio file uploads (workaround for 4.5MB API limits)
- **Scope**: Server-side only
- **Used in**: `src/app/api/blob/upload/route.ts`
- **Access Pattern**: `process.env.BLOB_READ_WRITE_TOKEN`

### Security (reCAPTCHA)
```
RECAPTCHA_SITE_KEY=your_recaptcha_site_key_here
RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key_here
```
- **Purpose**: Bot prevention on trial registration
- **Scope**: SITE_KEY is public (NEXT_PUBLIC_); SECRET_KEY is server-side
- **Used in**: `src/app/api/auth/register-trial/route.ts`
- **Access Pattern**: `process.env.RECAPTCHA_SITE_KEY`, `process.env.RECAPTCHA_SECRET_KEY`

### App Configuration
```
APP_URL=http://localhost:3000
```
- **Purpose**: Base URL for generating absolute links in emails, etc.
- **Scope**: Server-side only
- **Used in**: `src/app/api/videoconsultations/route.ts`, `src/app/api/auth/register-trial/route.ts`
- **Access Pattern**: `process.env.APP_URL || 'http://localhost:3000'`

---

## Integration Pattern: Resend Email Service

### Pattern Overview
The Resend integration serves as the gold standard for third-party API integration in this project:

```typescript
// 1. Define interfaces for parameters
interface TrialVerificationEmailParams {
  to: string;
  fullName?: string | null;
  verificationUrl: string;
}

// 2. Create config getter function with validation
function getEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    throw new Error('EMAIL_PROVIDER_NOT_CONFIGURED');
  }

  return { apiKey, from };
}

// 3. Implement service function with error handling
export async function sendTrialVerificationEmail(
  params: TrialVerificationEmailParams
): Promise<void> {
  const { apiKey, from } = getEmailConfig();
  
  // Build request
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: '...',
      html: '...',
      text: '...',
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`EMAIL_SEND_FAILED: ${details}`);
  }
}
```

### Key Principles
1. **Environment Isolation**: Sensitive credentials stored in .env.local, not in code
2. **Configuration Retrieval**: Centralized getter function validates required vars exist
3. **Type Safety**: TypeScript interfaces for all parameters
4. **Error Handling**: Clear error messages for configuration issues and API failures
5. **Fetch-based API**: Uses native `fetch()` instead of external SDK
6. **Server-side Only**: All API calls happen in server routes or lib functions

---

## JaaS Integration Pattern (Alternative Model)

```typescript
// 1. Environment validation function
export function getJaasEnvironmentStatus(): JaasEnvironmentStatus {
  const appId = process.env.JAAS_APP_ID?.trim();
  const keyId = process.env.JAAS_KEY_ID?.trim();
  const privateKey = process.env.JAAS_PRIVATE_KEY?.trim();
  const domain = process.env.JAAS_DOMAIN?.trim() || JAAS_DEFAULT_DOMAIN;

  const missingVars = [
    !appId ? 'JAAS_APP_ID' : null,
    !keyId ? 'JAAS_KEY_ID' : null,
    !privateKey ? 'JAAS_PRIVATE_KEY' : null,
  ].filter((value): value is string => Boolean(value));

  return {
    configured: missingVars.length === 0,
    missingVars,
    appId: appId || undefined,
    domain,
  };
}

// 2. Private config getter (throws if incomplete)
function getRequiredJaasConfig() {
  const status = getJaasEnvironmentStatus();

  if (!status.configured || !status.appId) {
    throw new Error(
      `Configuração do JaaS incompleta. Defina: ${status.missingVars.join(', ')}`
    );
  }

  return {
    appId: status.appId,
    domain: status.domain,
    keyId: process.env.JAAS_KEY_ID!.trim(),
    privateKey: normalizePrivateKey(process.env.JAAS_PRIVATE_KEY!),
  };
}

// 3. Service function uses config
export async function createJaasMeetingToken({
  roomId,
  displayName,
  email,
  isModerator,
}: CreateJaasMeetingTokenInput): Promise<JaasMeetingToken> {
  const { appId, domain, keyId, privateKey } = getRequiredJaasConfig();
  // ... implementation
}
```

### Key Differences from Resend
1. **Dual Status Functions**: Separate `getStatus()` for validation and `getRequired()` for strict mode
2. **Cryptographic Handling**: Uses `jose` library for JWT signing with private keys
3. **Helper Utilities**: `normalizePrivateKey()` handles escaped newlines in env vars
4. **Type Exports**: Exports `JaasEnvironmentStatus` interface for health checks

---

## Structure for Adding Twilio Integration

### Step 1: Add to .env.local
```
# Twilio SMS Integration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+55XXXXXXXXXX
```

### Step 2: Create src/lib/twilioService.ts (Following Resend Pattern)

```typescript
import type { PhoneNumberValidator } from './types';

interface SendSMSParams {
  to: string;
  message: string;
}

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
}

// Centralized config getter with validation
function getTwilioConfig(): TwilioConfig {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER?.trim();

  if (!accountSid || !authToken || !phoneNumber) {
    throw new Error('TWILIO_NOT_CONFIGURED');
  }

  return { accountSid, authToken, phoneNumber };
}

// Optional: Status function for health checks (JaaS pattern)
export function getTwilioEnvironmentStatus() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER?.trim();

  const missingVars = [
    !accountSid ? 'TWILIO_ACCOUNT_SID' : null,
    !authToken ? 'TWILIO_AUTH_TOKEN' : null,
    !phoneNumber ? 'TWILIO_PHONE_NUMBER' : null,
  ].filter((value): value is string => Boolean(value));

  return {
    configured: missingVars.length === 0,
    missingVars,
    phoneNumber: phoneNumber || undefined,
  };
}

// Main service function
export async function sendSMS(params: SendSMSParams): Promise<void> {
  const { accountSid, authToken, phoneNumber } = getTwilioConfig();

  const encodedMessage = encodeURIComponent(params.message);
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `To=${encodeURIComponent(params.to)}&From=${encodeURIComponent(phoneNumber)}&Body=${encodedMessage}`,
    }
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`SMS_SEND_FAILED: ${details}`);
  }
}

// Appointment reminder SMS example
interface AppointmentReminderSMSParams {
  patientPhone: string;
  patientName?: string | null;
  professionalName: string;
  appointmentDate: Date;
  appointmentTime: string;
}

export async function sendAppointmentReminderSMS(
  params: AppointmentReminderSMSParams
): Promise<void> {
  const patientName = params.patientName?.trim() || 'Paciente';
  const dateStr = params.appointmentDate.toLocaleDateString('pt-BR');
  
  const message = `Olá ${patientName}! Lembrete: Sua consulta com ${params.professionalName} está agendada para ${dateStr} às ${params.appointmentTime}. Acesse a plataforma OmniNote para conectar.`;

  await sendSMS({
    to: params.patientPhone,
    message,
  });
}
```

### Step 3: Use in API Routes

Example: `src/app/api/appointments/[id]/confirm/route.ts`

```typescript
import { sendAppointmentConfirmationEmail } from '@/lib/emailService';
import { sendAppointmentConfirmationSMS } from '@/lib/twilioService';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  // ... fetch appointment details
  
  try {
    // Send both email and SMS
    await Promise.all([
      sendAppointmentConfirmationEmail({
        to: appointment.patient.email,
        patientName: appointment.patient.name,
        professionalName: appointment.professional.name,
        appointmentDate: appointment.date,
        appointmentType: appointment.type,
        appointmentDuration: appointment.duration,
      }),
      sendAppointmentConfirmationSMS({
        patientPhone: appointment.patient.phone,
        patientName: appointment.patient.name,
        professionalName: appointment.professional.name,
        appointmentDate: appointment.date,
        appointmentTime: appointment.time,
      }),
    ]);

    return Response.json({ success: true });
  } catch (error) {
    console.error('Notification error:', error);
    return Response.json({ error: 'NOTIFICATION_FAILED' }, { status: 500 });
  }
}
```

### Step 4: Add Health Check Endpoint

Example: `src/app/api/health/integrations/route.ts`

```typescript
import { getEmailConfig } from '@/lib/emailService';
import { getTwilioEnvironmentStatus } from '@/lib/twilioService';
import { getJaasEnvironmentStatus } from '@/lib/jaas';

export async function GET() {
  const status = {
    email: {
      configured: !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM,
    },
    twilio: getTwilioEnvironmentStatus(),
    jaas: getJaasEnvironmentStatus(),
  };

  return Response.json(status);
}
```

---

## Environment Variable Naming Convention

### Patterns Used in Project
1. **Server-side Sensitive**: No prefix (e.g., `GEMINI_API_KEY`, `RESEND_API_KEY`)
2. **Public Client Config**: `NEXT_PUBLIC_` prefix (e.g., `NEXT_PUBLIC_JAAS_DOMAIN`)
3. **Grouped Services**: `SERVICE_` prefix (e.g., `JAAS_APP_ID`, `TWILIO_ACCOUNT_SID`)
4. **Database**: `DATABASE_URL`, `POSTGRES_SSL`, etc.
5. **Auth**: `AUTH_TOKEN_SECRET`, `AUTH_USERS`, `AUTH_ADMIN_USERNAME`

### For Twilio Integration
- ✅ `TWILIO_ACCOUNT_SID` (server-side)
- ✅ `TWILIO_AUTH_TOKEN` (server-side)
- ✅ `TWILIO_PHONE_NUMBER` (server-side)
- ❌ Never `NEXT_PUBLIC_TWILIO_*` (security risk)

---

## Dependencies

### Current Integration Libraries
- **@google/generative-ai**: Google Gemini AI API client
- **@vercel/blob**: File storage (already added for audio)
- **jose**: JWT signing for JaaS (already added)
- **pg**: PostgreSQL database client

### For Twilio
Add to package.json:
```bash
npm install twilio
```

Or use native `fetch()` pattern (as emailService does) to avoid extra dependencies.

---

## Security Considerations

1. **Never commit .env.local**: Already in .gitignore
2. **API Keys rotation**: Store in production environment manager (Vercel, etc.)
3. **HTTPS only**: All API calls in production use HTTPS
4. **Error messages**: Never expose full error details in client responses
5. **Rate limiting**: Implement on SMS/email endpoints to prevent abuse
6. **Phone validation**: Validate phone numbers before sending SMS
