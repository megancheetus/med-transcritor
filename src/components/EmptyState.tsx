'use client';

import { AlertCircle } from 'lucide-react';

export function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="text-center">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
          <AlertCircle className="h-8 w-8 text-blue-600" />
        </div>
        <h2 className="mb-2 text-2xl font-semibold text-slate-900">Nenhum paciente selecionado</h2>
        <p className="text-slate-600">
          Selecione um paciente na lista ao lado para visualizar seu prontuário eletrônico.
        </p>
      </div>
    </div>
  );
}
