import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const recaptchaSiteKey = process.env.RECAPTCHA_SITE_KEY?.trim() || '';

  return NextResponse.json(
    {
      recaptchaSiteKey,
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
