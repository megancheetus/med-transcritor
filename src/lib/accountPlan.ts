export type AccountPlan = 'basic' | 'clinical' | 'pro' | 'trial';
export type AppModule = 'transcricao' | 'teleconsulta' | 'prontuario';

export interface ModuleAccess {
  transcricao: boolean;
  teleconsulta: boolean;
  prontuario: boolean;
}

const PLAN_ACCESS_MAP: Record<AccountPlan, ModuleAccess> = {
  basic: {
    transcricao: true,
    teleconsulta: false,
    prontuario: false,
  },
  clinical: {
    transcricao: true,
    teleconsulta: true,
    prontuario: false,
  },
  pro: {
    transcricao: true,
    teleconsulta: true,
    prontuario: true,
  },
  trial: {
    transcricao: true,
    teleconsulta: true,
    prontuario: true,
  },
};

export function normalizeAccountPlan(value: unknown): AccountPlan {
  if (value === 'clinical' || value === 'pro' || value === 'trial') {
    return value;
  }

  return 'basic';
}

export function getModuleAccessForPlan(plan: AccountPlan): ModuleAccess {
  return PLAN_ACCESS_MAP[plan];
}

export function getAccountPlanLabel(plan: AccountPlan): string {
  switch (plan) {
    case 'clinical':
      return 'Clínico';
    case 'pro':
      return 'Pró';
    case 'trial':
      return 'Teste (3 dias)';
    default:
      return 'Básico';
  }
}
