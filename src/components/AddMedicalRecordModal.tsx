'use client';

import { useState } from 'react';
import { MedicalRecord } from '@/lib/types';
import { X } from 'lucide-react';

interface AddMedicalRecordModalProps {
  isOpen: boolean;
  patientId: string;
  onClose: () => void;
  onAdd: (record: Omit<MedicalRecord, 'id'>) => void;
}

type TipoDocumento = 'Consulta' | 'Exame' | 'Procedimento' | 'Prescrição' | 'Internação';

export function AddMedicalRecordModal({
  isOpen,
  patientId,
  onClose,
  onAdd,
}: AddMedicalRecordModalProps) {
  const [formData, setFormData] = useState({
    data: new Date().toISOString().split('T')[0],
    tipoDocumento: 'Consulta' as TipoDocumento,
    profissional: '',
    especialidade: '',
    conteudo: '',
    resumo: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.data) newErrors.data = 'Data é obrigatória';
    if (!formData.profissional.trim())
      newErrors.profissional = 'Profissional é obrigatório';
    if (!formData.especialidade.trim())
      newErrors.especialidade = 'Especialidade é obrigatória';
    if (!formData.conteudo.trim()) newErrors.conteudo = 'Conteúdo é obrigatório';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    onAdd({
      patientId,
      data: formData.data,
      tipoDocumento: formData.tipoDocumento,
      profissional: formData.profissional,
      especialidade: formData.especialidade,
      conteudo: formData.conteudo,
      resumo: formData.resumo || undefined,
    });

    setFormData({
      data: new Date().toISOString().split('T')[0],
      tipoDocumento: 'Consulta',
      profissional: '',
      especialidade: '',
      conteudo: '',
      resumo: '',
    });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-slate-200 bg-white">
          <h2 className="text-xl font-bold text-slate-900">Novo Registro Médico</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Data *
              </label>
              <input
                type="date"
                value={formData.data}
                onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  errors.data
                    ? 'border-red-500 focus:ring-red-200'
                    : 'border-slate-300 focus:ring-blue-200'
                }`}
              />
              {errors.data && <p className="text-xs text-red-600 mt-1">{errors.data}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Tipo de Documento *
              </label>
              <select
                value={formData.tipoDocumento}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    tipoDocumento: e.target.value as TipoDocumento,
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="Consulta">Consulta</option>
                <option value="Exame">Exame</option>
                <option value="Procedimento">Procedimento</option>
                <option value="Prescrição">Prescrição</option>
                <option value="Internação">Internação</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Profissional *
              </label>
              <input
                type="text"
                value={formData.profissional}
                onChange={(e) =>
                  setFormData({ ...formData, profissional: e.target.value })
                }
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  errors.profissional
                    ? 'border-red-500 focus:ring-red-200'
                    : 'border-slate-300 focus:ring-blue-200'
                }`}
                placeholder="Dr. João Silva"
              />
              {errors.profissional && (
                <p className="text-xs text-red-600 mt-1">{errors.profissional}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Especialidade *
              </label>
              <input
                type="text"
                value={formData.especialidade}
                onChange={(e) =>
                  setFormData({ ...formData, especialidade: e.target.value })
                }
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  errors.especialidade
                    ? 'border-red-500 focus:ring-red-200'
                    : 'border-slate-300 focus:ring-blue-200'
                }`}
                placeholder="Cardiologia"
              />
              {errors.especialidade && (
                <p className="text-xs text-red-600 mt-1">{errors.especialidade}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Resumo
            </label>
            <input
              type="text"
              value={formData.resumo}
              onChange={(e) => setFormData({ ...formData, resumo: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Resumo breve do registro"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Conteúdo *
            </label>
            <textarea
              value={formData.conteudo}
              onChange={(e) => setFormData({ ...formData, conteudo: e.target.value })}
              rows={6}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 resize-none ${
                errors.conteudo
                  ? 'border-red-500 focus:ring-red-200'
                  : 'border-slate-300 focus:ring-blue-200'
              }`}
              placeholder="Descreva o conteúdo do registro médico..."
            />
            {errors.conteudo && (
              <p className="text-xs text-red-600 mt-1">{errors.conteudo}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              Adicionar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
