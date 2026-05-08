import { NextResponse } from 'next/server';
import { z } from 'zod';

function formatZodIssues(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
}

export function parseWithSchema<T>(schema: z.ZodType<T>, payload: unknown):
  | { success: true; data: T }
  | { success: false; response: NextResponse } {
  const result = schema.safeParse(payload);

  if (!result.success) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: 'Payload inválido',
          details: formatZodIssues(result.error),
        },
        { status: 400 }
      ),
    };
  }

  return {
    success: true,
    data: result.data,
  };
}
