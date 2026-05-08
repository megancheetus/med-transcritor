import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { createAuthToken, getUsernameFromAuthToken } from '@/lib/auth';
import { getPatientPortalUserById, PatientPortalUser } from '@/lib/patientPortalAuth';

const PATIENT_TOKEN_PREFIX = 'patient:';

export async function createPatientAuthToken(patientId: string): Promise<string> {
  return createAuthToken(`${PATIENT_TOKEN_PREFIX}${patientId}`);
}

async function getPatientIdFromAuthToken(authToken?: string): Promise<string | null> {
  const subject = await getUsernameFromAuthToken(authToken);
  if (!subject || !subject.startsWith(PATIENT_TOKEN_PREFIX)) {
    return null;
  }

  const patientId = subject.slice(PATIENT_TOKEN_PREFIX.length).trim();
  return patientId.length > 0 ? patientId : null;
}

async function getAuthenticatedPatientFromToken(authToken?: string): Promise<PatientPortalUser | null> {
  const patientId = await getPatientIdFromAuthToken(authToken);
  if (!patientId) {
    return null;
  }

  return getPatientPortalUserById(patientId);
}

export async function getAuthenticatedPatientFromRequest(request: NextRequest): Promise<PatientPortalUser | null> {
  return getAuthenticatedPatientFromToken(request.cookies.get('patient_auth_token')?.value);
}

export async function getAuthenticatedPatientFromCookies(): Promise<PatientPortalUser | null> {
  const cookieStore = await cookies();
  return getAuthenticatedPatientFromToken(cookieStore.get('patient_auth_token')?.value);
}