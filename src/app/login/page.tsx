'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Usuário ou senha incorretos');
        setLoading(false);
        return;
      }

      // Login bem-sucedido
      router.push('/');
    } catch (err) {
      setError('Erro ao fazer login. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1a2e45] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-[#1a2e45] rounded-lg mb-5">
            <span className="text-white text-xs font-bold tracking-widest">MT</span>
          </div>
          <h1 className="text-2xl font-semibold text-[#1a2e45] tracking-tight">
            MedTranscritor
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Transcrição de consultas médicas
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="username" className="block text-xs font-medium text-[#607080] uppercase tracking-wider mb-1.5">
              Usuário
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Insira seu usuário"
              className="w-full px-3.5 py-2.5 text-sm border border-[#dde2e8] rounded-md focus:outline-none focus:ring-2 focus:ring-[#4a7fa5] focus:border-[#4a7fa5] transition text-[#1a2e45]"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-[#607080] uppercase tracking-wider mb-1.5">
              Senha
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Insira sua senha"
              className="w-full px-3.5 py-2.5 text-sm border border-[#dde2e8] rounded-md focus:outline-none focus:ring-2 focus:ring-[#4a7fa5] focus:border-[#4a7fa5] transition text-[#1a2e45]"
              required
              disabled={loading}
            />
          </div>

          {error && (
            <div className="border border-red-200 text-red-700 px-3.5 py-2.5 rounded-md text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1a2e45] hover:bg-[#234060] text-white text-sm font-medium py-2.5 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed tracking-wide"
          >
            {loading ? 'Aguarde...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-slate-400 text-xs mt-6">
          Acesso restrito para usuários autorizados
        </p>
      </div>
    </div>
  );
}
