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
    if (!formData.profissional.trim())
      newErrors.profissional = 'Profissional é obrigatório';
    if (!formData.especialidade.trim())
      newErrors.especialidade = 'Especialidade é obrigatória';

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
                    </>
                  )}

                  {activeTab === 'soap' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Subjetivo</label>
                        <textarea
                          value={formData.soapSubjetivo}
                          onChange={(e) => setFormData({ ...formData, soapSubjetivo: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
                          placeholder="Queixas principais, história e percepção do paciente"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Objetivo</label>
                        <textarea
                          value={formData.soapObjetivo}
                          onChange={(e) => setFormData({ ...formData, soapObjetivo: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
                          placeholder="Achados de exame físico e dados observáveis"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Avaliação</label>
                        <textarea
                          value={formData.soapAvaliacao}
                          onChange={(e) => setFormData({ ...formData, soapAvaliacao: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
                          placeholder="Hipóteses diagnósticas e raciocínio clínico"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Plano</label>
                        <textarea
                          value={formData.soapPlano}
                          onChange={(e) => setFormData({ ...formData, soapPlano: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
                          placeholder="Conduta, exames, prescrições e orientações"
                        />
                      </div>
                    </>
                  )}

                  {activeTab === 'diagnostico' && (
                    <>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            CIDs (separados por vírgula)
                          </label>
                          <input
                            type="text"
                            value={formData.cid10Codes}
                            onChange={(e) => setFormData({ ...formData, cid10Codes: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                            placeholder="Ex.: I10, E11"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Follow-up
                          </label>
                          <input
                            type="date"
                            value={formData.followUpDate}
                            onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Medicações (separadas por vírgula)
                        </label>
                        <input
                          type="text"
                          value={formData.medications}
                          onChange={(e) => setFormData({ ...formData, medications: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                          placeholder="Ex.: Enalapril 10mg 1x/dia, Sinvastatina 20mg à noite"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Alergias (separadas por vírgula)
                        </label>
                        <input
                          type="text"
                          value={formData.allergies}
                          onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                          placeholder="Ex.: Dipirona, Penicilina"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Conteúdo livre
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
                          placeholder="Campo narrativo opcional; se vazio, o conteúdo será montado a partir do SOAP"
                        />
                        {errors.conteudo && (
                          <p className="text-xs text-red-600 mt-1">{errors.conteudo}</p>
                        )}
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

                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        Revise os campos clínicos antes de salvar. Campos SOAP e metadados são opcionais e
                        serão armazenados sem quebrar registros legados.
                      </div>
                    </div>
                  )}
