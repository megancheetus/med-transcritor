'use client';

import { useEffect, useState } from 'react';
import { MedicalRecord } from '@/lib/types';
import { X } from 'lucide-react';

interface AddMedicalRecordModalProps {
  isOpen: boolean;
  patientId: string;
  onClose: () => void;
  onAdd: (record: Omit<MedicalRecord, 'id'>) => void;
}

type TipoDocumento = 'Consulta' | 'Exame' | 'Procedimento' | 'Prescrição' | 'Internação';
type ModalTab = 'resumo' | 'soap' | 'diagnostico' | 'bioimpedancia' | 'revisao';

function parseOptionalNumber(value: string): number | undefined {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

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
    bioMeasuredAt: '',
    bioSource: '',
    bioScore: '',
    bioAlturaCm: '',
    bioPesoKg: '',
    bioImc: '',
    bioGorduraPercent: '',
    bioMassaGorduraKg: '',
    bioMassaMagraKg: '',
    bioMusculoEsqueleticoKg: '',
    bioAguaCorporalL: '',
    bioGorduraVisceral: '',
    bioTmbKcal: '',
    bioLeanLeftArmKg: '',
    bioLeanRightArmKg: '',
    bioLeanTrunkKg: '',
    bioLeanLeftLegKg: '',
    bioLeanRightLegKg: '',
    bioFatLeftArmKg: '',
    bioFatRightArmKg: '',
    bioFatTrunkKg: '',
    bioFatLeftLegKg: '',
    bioFatRightLegKg: '',
    bioObservacoes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const peso = parseOptionalNumber(formData.bioPesoKg);
    const alturaCm = parseOptionalNumber(formData.bioAlturaCm);

    if (!peso || !alturaCm || alturaCm <= 0) {
      if (formData.bioImc !== '') {
        setFormData((prev) => ({ ...prev, bioImc: '' }));
      }
      return;
    }

    const alturaM = alturaCm / 100;
    const calculatedImc = peso / (alturaM * alturaM);
    const normalizedImc = calculatedImc.toFixed(2).replace('.', ',');

    if (formData.bioImc !== normalizedImc) {
      setFormData((prev) => ({ ...prev, bioImc: normalizedImc }));
    }
  }, [formData.bioAlturaCm, formData.bioPesoKg, formData.bioImc]);

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
      bioimpedance: {
        measuredAt: formData.bioMeasuredAt || undefined,
        source: formData.bioSource.trim() || undefined,
        score: parseOptionalNumber(formData.bioScore),
        alturaCm: parseOptionalNumber(formData.bioAlturaCm),
        pesoKg: parseOptionalNumber(formData.bioPesoKg),
        imc: parseOptionalNumber(formData.bioImc),
        gorduraCorporalPercent: parseOptionalNumber(formData.bioGorduraPercent),
        massaGorduraKg: parseOptionalNumber(formData.bioMassaGorduraKg),
        massaMagraKg: parseOptionalNumber(formData.bioMassaMagraKg),
        musculoEsqueleticoKg: parseOptionalNumber(formData.bioMusculoEsqueleticoKg),
        aguaCorporalTotalL: parseOptionalNumber(formData.bioAguaCorporalL),
        gorduraVisceralNivel: parseOptionalNumber(formData.bioGorduraVisceral),
        taxaMetabolicaBasalKcal: parseOptionalNumber(formData.bioTmbKcal),
        segmentalLean: {
          leftArmKg: parseOptionalNumber(formData.bioLeanLeftArmKg),
          rightArmKg: parseOptionalNumber(formData.bioLeanRightArmKg),
          trunkKg: parseOptionalNumber(formData.bioLeanTrunkKg),
          leftLegKg: parseOptionalNumber(formData.bioLeanLeftLegKg),
          rightLegKg: parseOptionalNumber(formData.bioLeanRightLegKg),
        },
        segmentalFat: {
          leftArmKg: parseOptionalNumber(formData.bioFatLeftArmKg),
          rightArmKg: parseOptionalNumber(formData.bioFatRightArmKg),
          trunkKg: parseOptionalNumber(formData.bioFatTrunkKg),
          leftLegKg: parseOptionalNumber(formData.bioFatLeftLegKg),
          rightLegKg: parseOptionalNumber(formData.bioFatRightLegKg),
        },
        observacoes: formData.bioObservacoes.trim() || undefined,
      },
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
      bioMeasuredAt: '',
      bioSource: '',
      bioScore: '',
      bioAlturaCm: '',
      bioPesoKg: '',
      bioImc: '',
      bioGorduraPercent: '',
      bioMassaGorduraKg: '',
      bioMassaMagraKg: '',
      bioMusculoEsqueleticoKg: '',
      bioAguaCorporalL: '',
      bioGorduraVisceral: '',
      bioTmbKcal: '',
      bioLeanLeftArmKg: '',
      bioLeanRightArmKg: '',
      bioLeanTrunkKg: '',
      bioLeanLeftLegKg: '',
      bioLeanRightLegKg: '',
      bioFatLeftArmKg: '',
      bioFatRightArmKg: '',
      bioFatTrunkKg: '',
      bioFatLeftLegKg: '',
      bioFatRightLegKg: '',
      bioObservacoes: '',
    });
    setActiveTab('resumo');
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-lg">
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-slate-200 bg-white p-4 sm:p-6">
          <h2 className="min-w-0 text-lg sm:text-xl font-bold leading-tight break-words text-slate-900">Novo Registro Médico</h2>
          <button
            onClick={onClose}
            className="h-9 w-9 inline-flex items-center justify-center rounded-md text-slate-400 transition hover:text-slate-600 shrink-0"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-6">
          <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1 md:grid-cols-4">
            <button
              type="button"
              onClick={() => setActiveTab('resumo')}
              className={`min-h-11 rounded-md px-3 py-2 text-xs font-semibold text-center leading-tight whitespace-normal transition ${
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
              className={`min-h-11 rounded-md px-3 py-2 text-xs font-semibold text-center leading-tight whitespace-normal transition ${
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
              className={`min-h-11 rounded-md px-3 py-2 text-xs font-semibold text-center leading-tight whitespace-normal transition ${
                activeTab === 'diagnostico'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Diagnóstico/Conduta
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('bioimpedancia')}
              className={`min-h-11 rounded-md px-3 py-2 text-xs font-semibold text-center leading-tight whitespace-normal transition ${
                activeTab === 'bioimpedancia'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bioimpedancia
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('revisao')}
              className={`min-h-11 rounded-md px-3 py-2 text-xs font-semibold text-center leading-tight whitespace-normal transition ${
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          {activeTab === 'bioimpedancia' && (
            <>
              <div className="rounded-lg border border-[#cfe0e8] bg-[#f7fbfc] p-4">
                <p className="text-sm font-semibold text-[#155b79]">Composicao corporal e bioimpedancia</p>
                <p className="mt-1 text-xs text-[#4b6573]">Preencha os campos disponiveis conforme o laudo. Todos os campos sao opcionais.</p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Data/hora da medicao</label>
                  <input
                    type="text"
                    value={formData.bioMeasuredAt}
                    onChange={(e) => setFormData({ ...formData, bioMeasuredAt: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="10/12/2025 12:30"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Equipamento/Fonte</label>
                  <input
                    type="text"
                    value={formData.bioSource}
                    onChange={(e) => setFormData({ ...formData, bioSource: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="InBody 120"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Score InBody</label>
                  <input
                    type="text"
                    value={formData.bioScore}
                    onChange={(e) => setFormData({ ...formData, bioScore: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="53"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div><label className="mb-1 block text-sm font-medium text-slate-700">Altura (cm)</label><input type="text" value={formData.bioAlturaCm} onChange={(e) => setFormData({ ...formData, bioAlturaCm: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></div>
                <div><label className="mb-1 block text-sm font-medium text-slate-700">Peso (kg)</label><input type="text" value={formData.bioPesoKg} onChange={(e) => setFormData({ ...formData, bioPesoKg: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">IMC (automático)</label>
                  <input
                    type="text"
                    value={formData.bioImc}
                    readOnly
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-700"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">Calculado por $peso / (altura em metros)^2$.</p>
                </div>
                <div><label className="mb-1 block text-sm font-medium text-slate-700">PGC (%)</label><input type="text" value={formData.bioGorduraPercent} onChange={(e) => setFormData({ ...formData, bioGorduraPercent: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div><label className="mb-1 block text-sm font-medium text-slate-700">Massa de gordura (kg)</label><input type="text" value={formData.bioMassaGorduraKg} onChange={(e) => setFormData({ ...formData, bioMassaGorduraKg: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></div>
                <div><label className="mb-1 block text-sm font-medium text-slate-700">Massa magra (kg)</label><input type="text" value={formData.bioMassaMagraKg} onChange={(e) => setFormData({ ...formData, bioMassaMagraKg: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></div>
                <div><label className="mb-1 block text-sm font-medium text-slate-700">Musculo esqueletico (kg)</label><input type="text" value={formData.bioMusculoEsqueleticoKg} onChange={(e) => setFormData({ ...formData, bioMusculoEsqueleticoKg: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></div>
                <div><label className="mb-1 block text-sm font-medium text-slate-700">Agua corporal total (L)</label><input type="text" value={formData.bioAguaCorporalL} onChange={(e) => setFormData({ ...formData, bioAguaCorporalL: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div><label className="mb-1 block text-sm font-medium text-slate-700">Gordura visceral (nivel)</label><input type="text" value={formData.bioGorduraVisceral} onChange={(e) => setFormData({ ...formData, bioGorduraVisceral: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></div>
                <div><label className="mb-1 block text-sm font-medium text-slate-700">Taxa metabolica basal (kcal)</label><input type="text" value={formData.bioTmbKcal} onChange={(e) => setFormData({ ...formData, bioTmbKcal: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-700 mb-3">Massa magra segmentar (kg)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <input type="text" value={formData.bioLeanLeftArmKg} onChange={(e) => setFormData({ ...formData, bioLeanLeftArmKg: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Braco E" />
                    <input type="text" value={formData.bioLeanRightArmKg} onChange={(e) => setFormData({ ...formData, bioLeanRightArmKg: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Braco D" />
                    <input type="text" value={formData.bioLeanLeftLegKg} onChange={(e) => setFormData({ ...formData, bioLeanLeftLegKg: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Perna E" />
                    <input type="text" value={formData.bioLeanRightLegKg} onChange={(e) => setFormData({ ...formData, bioLeanRightLegKg: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Perna D" />
                    <input type="text" value={formData.bioLeanTrunkKg} onChange={(e) => setFormData({ ...formData, bioLeanTrunkKg: e.target.value })} className="col-span-2 w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Tronco" />
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-700 mb-3">Gordura segmentar (kg)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <input type="text" value={formData.bioFatLeftArmKg} onChange={(e) => setFormData({ ...formData, bioFatLeftArmKg: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Braco E" />
                    <input type="text" value={formData.bioFatRightArmKg} onChange={(e) => setFormData({ ...formData, bioFatRightArmKg: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Braco D" />
                    <input type="text" value={formData.bioFatLeftLegKg} onChange={(e) => setFormData({ ...formData, bioFatLeftLegKg: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Perna E" />
                    <input type="text" value={formData.bioFatRightLegKg} onChange={(e) => setFormData({ ...formData, bioFatRightLegKg: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Perna D" />
                    <input type="text" value={formData.bioFatTrunkKg} onChange={(e) => setFormData({ ...formData, bioFatTrunkKg: e.target.value })} className="col-span-2 w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Tronco" />
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Observacoes</label>
                <textarea
                  value={formData.bioObservacoes}
                  onChange={(e) => setFormData({ ...formData, bioObservacoes: e.target.value })}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
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
                  <p><span className="font-medium">Bioimpedancia:</span> {formData.bioPesoKg || formData.bioImc || formData.bioGorduraPercent ? 'Preenchida' : 'Nao preenchida'}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:flex-1 min-h-11 rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 text-center leading-tight whitespace-normal transition hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="w-full sm:flex-1 min-h-11 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white text-center leading-tight whitespace-normal transition hover:bg-blue-700"
            >
              Adicionar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
