'use client';

import { useState, useMemo } from 'react';
import { Search, Users, Plus } from 'lucide-react';
import { Patient } from '@/lib/types';

interface PatientListProps {
  patients: Patient[];
  selectedPatient: Patient | null;
  onSelectPatient: (patient: Patient) => void;
  onAddClick?: () => void;
}

export function PatientList({ patients, selectedPatient, onSelectPatient, onAddClick }: PatientListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPatients = useMemo(() => {
    const lowerQuery = searchQuery.toLowerCase();
    return patients.filter(
      (patient) =>
        patient.nome.toLowerCase().includes(lowerQuery) ||
        patient.nomeCompleto.toLowerCase().includes(lowerQuery) ||
        patient.cpf.includes(searchQuery)
    );
  }, [patients, searchQuery]);

  return (
    <div className="flex h-full flex-col border-r border-slate-200 bg-white">
      {/* Header */}
      <div className="border-b border-slate-200 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900">Pacientes</h2>
          </div>
          {onAddClick && (
            <button
              onClick={onAddClick}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition"
              title="Adicionar novo paciente"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Novo</span>
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou CPF..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2 pl-9 pr-3 text-sm placeholder-slate-500 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-200"
          />
        </div>
      </div>

      {/* Patient List */}
      <div className="flex-1 overflow-y-auto">
        {filteredPatients.length === 0 ? (
          <div className="flex h-32 items-center justify-center px-4 py-8 text-center">
            <p className="text-sm text-slate-500">Nenhum paciente encontrado</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {filteredPatients.map((patient) => (
              <li key={patient.id}>
                <button
                  onClick={() => onSelectPatient(patient)}
                  className={`w-full px-4 py-3 text-left transition-colors hover:bg-blue-50 ${
                    selectedPatient?.id === patient.id
                      ? 'border-l-4 border-blue-600 bg-blue-50'
                      : 'border-l-4 border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">{patient.nome}</p>
                      <p className="truncate text-xs text-slate-500">{patient.cpf}</p>
                    </div>
                    <div className="ml-2 flex-shrink-0 text-right">
                      <p className="text-xs font-medium text-slate-600">{patient.idade}</p>
                      <p className="text-xs text-slate-500">{patient.sexo === 'M' ? 'M' : 'F'}</p>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-xs text-slate-500">
          {filteredPatients.length} de {patients.length} paciente(s)
        </p>
      </div>
    </div>
  );
}
