'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

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
      console.error('Erro no request de login:', err);
      setError('Erro ao fazer login. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#155b79] via-[#1a6a8d] to-[#0c161c] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-block">
            <Image
              src="/logo.png"
              alt="OmniNote Logo"
              width={300}
              height={100}
              priority
              className="w-80 h-auto"
            />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="username" className="block text-xs font-semibold text-[#155b79] uppercase tracking-wider mb-2">
              Usuário
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Insira seu usuário"
              className="w-full px-4 py-3 text-sm border-2 border-[#cfe0e8] rounded-lg focus:outline-none focus:border-[#1ea58c] focus:ring-2 focus:ring-[#1ea58c] focus:ring-opacity-20 transition text-[#0c161c] placeholder-[#7b8d97]"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-[#155b79] uppercase tracking-wider mb-2">
              Senha
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Insira sua senha"
              className="w-full px-4 py-3 text-sm border-2 border-[#cfe0e8] rounded-lg focus:outline-none focus:border-[#1ea58c] focus:ring-2 focus:ring-[#1ea58c] focus:ring-opacity-20 transition text-[#0c161c] placeholder-[#7b8d97]"
              required
              disabled={loading}
            />
          </div>

          {error && (
            <div className="border border-red-200 bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1a6a8d] hover:bg-[#155b79] text-white text-sm font-bold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed tracking-wide shadow-md hover:shadow-lg"
          >
            {loading ? 'Autenticando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-[#7b8d97] text-xs mt-6">
          Acesso restrito para usuários autorizados
        </p>
      </div>
    </div>
  );
}
