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
type ModalTab = 'resumo' | 'soap' | 'diagnostico' | 'revisao';

function parseCsvField(value: string): string[] | undefined {
  const parsed = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return parsed.length > 0 ? parsed : undefined;
}

function buildConteudoFromSoap(fields: {
  soapSubjetivo: string;
  soapObjetivo: string;
  soapAvaliacao: string;
  soapPlano: string;
}): string {
  const sections: Array<{ title: string; value: string }> = [
    { title: 'Subjetivo', value: fields.soapSubjetivo.trim() },
    { title: 'Objetivo', value: fields.soapObjetivo.trim() },
    { title: 'Avaliação', value: fields.soapAvaliacao.trim() },
    { title: 'Plano', value: fields.soapPlano.trim() },
  ];

  return sections
    .filter((section) => section.value.length > 0)
    .map((section) => `${section.title}:\n${section.value}`)
    .join('\n\n');
}

export function AddMedicalRecordModal({
  isOpen,
  patientId,
  onClose,
  onAdd,
}: AddMedicalRecordModalProps) {
  const [activeTab, setActiveTab] = useState<ModalTab>('resumo');
  const [formData, setFormData] = useState({
    data: new Date().toISOString().split('T')[0],
    tipoDocumento: 'Consulta' as TipoDocumento,
    profissional: '',
    especialidade: '',
    conteudo: '',
    resumo: '',
    soapSubjetivo: '',
    soapObjetivo: '',
    soapAvaliacao: '',
    soapPlano: '',
    cid10Codes: '',
    medications: '',
    allergies: '',
    followUpDate: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.data) newErrors.data = 'Data é obrigatória';
    if (!formData.profissional.trim()) {
      newErrors.profissional = 'Profissional é obrigatório';
    }
    if (!formData.especialidade.trim()) {
      newErrors.especialidade = 'Especialidade é obrigatória';
    }

    const generatedConteudo = buildConteudoFromSoap({
      soapSubjetivo: formData.soapSubjetivo,
      soapObjetivo: formData.soapObjetivo,
      soapAvaliacao: formData.soapAvaliacao,
      soapPlano: formData.soapPlano,
    });

    if (!formData.conteudo.trim() && !generatedConteudo.trim()) {
      newErrors.conteudo = 'Preencha o conteúdo livre ou ao menos uma seção SOAP';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const generatedConteudo = buildConteudoFromSoap({
      soapSubjetivo: formData.soapSubjetivo,
      soapObjetivo: formData.soapObjetivo,
      soapAvaliacao: formData.soapAvaliacao,
      soapPlano: formData.soapPlano,
    });

    const finalConteudo = formData.conteudo.trim() || generatedConteudo;

    onAdd({
      patientId,
      data: formData.data,
      tipoDocumento: formData.tipoDocumento,
      profissional: formData.profissional,
      especialidade: formData.especialidade,
      conteudo: finalConteudo,
      resumo: formData.resumo || undefined,
      soapSubjetivo: formData.soapSubjetivo.trim() || undefined,
      soapObjetivo: formData.soapObjetivo.trim() || undefined,
      soapAvaliacao: formData.soapAvaliacao.trim() || undefined,
      soapPlano: formData.soapPlano.trim() || undefined,
      cid10Codes: parseCsvField(formData.cid10Codes),
      medications: parseCsvField(formData.medications),
      allergies: parseCsvField(formData.allergies),
      followUpDate: formData.followUpDate || undefined,
    });

    setFormData({
      data: new Date().toISOString().split('T')[0],
      tipoDocumento: 'Consulta',
      profissional: '',
      especialidade: '',
      conteudo: '',
      resumo: '',
      soapSubjetivo: '',
      soapObjetivo: '',
      soapAvaliacao: '',
      soapPlano: '',
      cid10Codes: '',
      medications: '',
      allergies: '',
      followUpDate: '',
    });
    setActiveTab('resumo');
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-lg">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white p-6">
          <h2 className="text-xl font-bold text-slate-900">Novo Registro Médico</h2>
          <button
            onClick={onClose}
            className="text-slate-400 transition hover:text-slate-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1 md:grid-cols-4">
            <button
              type="button"
              onClick={() => setActiveTab('resumo')}
              className={`rounded-md px-3 py-2 text-xs font-semibold transition ${
                activeTab === 'resumo'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Resumo
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('soap')}
              className={`rounded-md px-3 py-2 text-xs font-semibold transition ${
                activeTab === 'soap'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              SOAP
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('diagnostico')}
              className={`rounded-md px-3 py-2 text-xs font-semibold transition ${
                activeTab === 'diagnostico'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Diagnóstico/Conduta
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('revisao')}
              className={`rounded-md px-3 py-2 text-xs font-semibold transition ${
                activeTab === 'revisao'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Revisão final
            </button>
          </div>

          {activeTab === 'resumo' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Data *</label>
                  <input
                    type="date"
                    value={formData.data}
                    onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                    className={`w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 ${
                      errors.data
                        ? 'border-red-500 focus:ring-red-200'
                        : 'border-slate-300 focus:ring-blue-200'
                    }`}
                  />
                  {errors.data && <p className="mt-1 text-xs text-red-600">{errors.data}</p>}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Tipo de Documento *</label>
                  <select
                    value={formData.tipoDocumento}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        tipoDocumento: e.target.value as TipoDocumento,
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
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
                  <label className="mb-1 block text-sm font-medium text-slate-700">Profissional *</label>
                  <input
                    type="text"
                    value={formData.profissional}
                    onChange={(e) => setFormData({ ...formData, profissional: e.target.value })}
                    className={`w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 ${
                      errors.profissional
                        ? 'border-red-500 focus:ring-red-200'
                        : 'border-slate-300 focus:ring-blue-200'
                    }`}
                    placeholder="Dr. João Silva"
                  />
                  {errors.profissional && (
                    <p className="mt-1 text-xs text-red-600">{errors.profissional}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Especialidade *</label>
                  <input
                    type="text"
                    value={formData.especialidade}
                    onChange={(e) => setFormData({ ...formData, especialidade: e.target.value })}
                    className={`w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 ${
                      errors.especialidade
                        ? 'border-red-500 focus:ring-red-200'
                        : 'border-slate-300 focus:ring-blue-200'
                    }`}
                    placeholder="Cardiologia"
                  />
                  {errors.especialidade && (
                    <p className="mt-1 text-xs text-red-600">{errors.especialidade}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Resumo</label>
                <input
                  type="text"
                  value={formData.resumo}
                  onChange={(e) => setFormData({ ...formData, resumo: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="Resumo breve do registro"
                />
              </div>
            </>
          )}

          {activeTab === 'soap' && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Subjetivo</label>
                <textarea
                  value={formData.soapSubjetivo}
                  onChange={(e) => setFormData({ ...formData, soapSubjetivo: e.target.value })}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Objetivo</label>
                <textarea
                  value={formData.soapObjetivo}
                  onChange={(e) => setFormData({ ...formData, soapObjetivo: e.target.value })}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Avaliação</label>
                <textarea
                  value={formData.soapAvaliacao}
                  onChange={(e) => setFormData({ ...formData, soapAvaliacao: e.target.value })}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Plano</label>
                <textarea
                  value={formData.soapPlano}
                  onChange={(e) => setFormData({ ...formData, soapPlano: e.target.value })}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </>
          )}

          {activeTab === 'diagnostico' && (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">CIDs (separados por vírgula)</label>
                  <input
                    type="text"
                    value={formData.cid10Codes}
                    onChange={(e) => setFormData({ ...formData, cid10Codes: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Follow-up</label>
                  <input
                    type="date"
                    value={formData.followUpDate}
                    onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Medicações (separadas por vírgula)</label>
                <input
                  type="text"
                  value={formData.medications}
                  onChange={(e) => setFormData({ ...formData, medications: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Alergias (separadas por vírgula)</label>
                <input
                  type="text"
                  value={formData.allergies}
                  onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Conteúdo livre</label>
                <textarea
                  value={formData.conteudo}
                  onChange={(e) => setFormData({ ...formData, conteudo: e.target.value })}
                  rows={6}
                  className={`w-full resize-none rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 ${
                    errors.conteudo
                      ? 'border-red-500 focus:ring-red-200'
                      : 'border-slate-300 focus:ring-blue-200'
                  }`}
                  placeholder="Opcional: se vazio, será gerado a partir do SOAP"
                />
                {errors.conteudo && <p className="mt-1 text-xs text-red-600">{errors.conteudo}</p>}
              </div>
            </>
          )}

          {activeTab === 'revisao' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resumo da revisão</p>
                <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-slate-700 md:grid-cols-2">
                  <p><span className="font-medium">Data:</span> {formData.data || '-'}</p>
                  <p><span className="font-medium">Documento:</span> {formData.tipoDocumento}</p>
                  <p><span className="font-medium">Profissional:</span> {formData.profissional || '-'}</p>
                  <p><span className="font-medium">Especialidade:</span> {formData.especialidade || '-'}</p>
                  <p><span className="font-medium">CIDs:</span> {formData.cid10Codes || '-'}</p>
                  <p><span className="font-medium">Follow-up:</span> {formData.followUpDate || '-'}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700"
            >
              Adicionar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
