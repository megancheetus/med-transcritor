'use client';

import { useState } from 'react';
import { Patient } from '@/lib/types';
import { X } from 'lucide-react';

interface AddPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (patient: Omit<Patient, 'id'>) => void;
}

export function AddPatientModal({ isOpen, onClose, onAdd }: AddPatientModalProps) {
  const [formData, setFormData] = useState({
    nome: '',
    nomeCompleto: '',
    idade: '',
    sexo: 'M' as 'M' | 'F' | 'Outro',
    cpf: '',
    dataNascimento: '',
    telefone: '',
    email: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.nome.trim()) newErrors.nome = 'Nome é obrigatório';
    if (!formData.nomeCompleto.trim()) newErrors.nomeCompleto = 'Nome completo é obrigatório';
    if (!formData.idade || parseInt(formData.idade) < 0 || parseInt(formData.idade) > 150)
      newErrors.idade = 'Idade deve estar entre 0 e 150';
    if (!formData.cpf.trim()) newErrors.cpf = 'CPF é obrigatório';
    if (!formData.dataNascimento) newErrors.dataNascimento = 'Data de nascimento é obrigatória';
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      newErrors.email = 'Email inválido';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    onAdd({
      nome: formData.nome,
      nomeCompleto: formData.nomeCompleto,
      idade: parseInt(formData.idade),
      sexo: formData.sexo,
      cpf: formData.cpf,
      dataNascimento: formData.dataNascimento,
      telefone: formData.telefone || undefined,
      email: formData.email || undefined,
    });

    setFormData({
      nome: '',
      nomeCompleto: '',
      idade: '',
      sexo: 'M',
      cpf: '',
      dataNascimento: '',
      telefone: '',
      email: '',
    });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 flex items-start justify-between gap-3 p-4 sm:p-6 border-b border-slate-200 bg-white">
          <h2 className="min-w-0 text-lg sm:text-xl font-bold leading-tight break-words text-slate-900">Adicionar Paciente</h2>
          <button
            onClick={onClose}
            className="h-9 w-9 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 transition shrink-0"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
            <input
              type="text"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                errors.nome ? 'border-red-500 focus:ring-red-200' : 'border-slate-300 focus:ring-blue-200'
              }`}
              placeholder="Ex: João Silva"
            />
            {errors.nome && <p className="text-xs text-red-600 mt-1">{errors.nome}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo *</label>
            <input
              type="text"
              value={formData.nomeCompleto}
              onChange={(e) => setFormData({ ...formData, nomeCompleto: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                errors.nomeCompleto ? 'border-red-500 focus:ring-red-200' : 'border-slate-300 focus:ring-blue-200'
              }`}
              placeholder="Ex: João Carlos Silva Santos"
            />
            {errors.nomeCompleto && <p className="text-xs text-red-600 mt-1">{errors.nomeCompleto}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Idade *</label>
              <input
                type="number"
                min="0"
                max="150"
                value={formData.idade}
                onChange={(e) => setFormData({ ...formData, idade: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  errors.idade ? 'border-red-500 focus:ring-red-200' : 'border-slate-300 focus:ring-blue-200'
                }`}
                placeholder="45"
              />
              {errors.idade && <p className="text-xs text-red-600 mt-1">{errors.idade}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sexo *</label>
              <select
                value={formData.sexo}
                onChange={(e) => setFormData({ ...formData, sexo: e.target.value as 'M' | 'F' | 'Outro' })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">CPF *</label>
            <input
              type="text"
              value={formData.cpf}
              onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                errors.cpf ? 'border-red-500 focus:ring-red-200' : 'border-slate-300 focus:ring-blue-200'
              }`}
              placeholder="123.456.789-00"
            />
            {errors.cpf && <p className="text-xs text-red-600 mt-1">{errors.cpf}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Data de Nascimento *</label>
            <input
              type="date"
              value={formData.dataNascimento}
              onChange={(e) => setFormData({ ...formData, dataNascimento: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                errors.dataNascimento ? 'border-red-500 focus:ring-red-200' : 'border-slate-300 focus:ring-blue-200'
              }`}
            />
            {errors.dataNascimento && <p className="text-xs text-red-600 mt-1">{errors.dataNascimento}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
            <input
              type="tel"
              value={formData.telefone}
              onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="(11) 98765-4321"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                errors.email ? 'border-red-500 focus:ring-red-200' : 'border-slate-300 focus:ring-blue-200'
              }`}
              placeholder="joao@email.com"
            />
            {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:flex-1 min-h-11 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition font-medium text-center leading-tight whitespace-normal"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="w-full sm:flex-1 min-h-11 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-center leading-tight whitespace-normal"
            >
              Adicionar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
