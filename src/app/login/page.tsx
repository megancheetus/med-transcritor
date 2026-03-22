'use client';

import { Suspense, useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { CookieConsentBanner, useCookieConsent } from '@/components/CookieConsentBanner';

const NAV_LINKS = [
  { href: '/planos', label: 'Planos' },
  { href: '/funcionamento', label: 'Como funciona' },
  { href: '/criar-conta', label: 'Criar conta' },
];

function LoginPageContent() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const cookiesAccepted = useCookieConsent();
  const router = useRouter();
  const searchParams = useSearchParams();
  const verifiedStatus = searchParams.get('verified');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!cookiesAccepted) return;
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
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#155b79] via-[#1a6a8d] to-[#0c161c]">
      {/* Public nav */}
      <header className="w-full px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image src="/favicon.png" alt="OmniNote" width={32} height={32} className="w-8 h-8" priority />
          <span className="text-white font-bold text-lg tracking-tight">OmniNote</span>
        </div>
        <nav className="hidden sm:flex items-center gap-2 rounded-xl bg-white px-2 py-2 shadow-lg ring-1 ring-black/5">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
            >
              {link.label}
            </Link>
          ))}
          <span className="rounded-lg bg-[#155b79] px-3 py-1.5 text-sm font-semibold text-white cursor-default">
            Entrar
          </span>
        </nav>
      </header>

      {/* Login card */}
      <div className="flex-1 flex items-center justify-center p-4">
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
          {verifiedStatus === 'success' && (
            <div className="border border-emerald-200 bg-emerald-50 text-emerald-700 px-4 py-3 rounded-lg text-sm font-medium">
              E-mail confirmado com sucesso. Faça login para continuar.
            </div>
          )}

          {verifiedStatus === 'sent' && (
            <div className="border border-blue-200 bg-blue-50 text-blue-700 px-4 py-3 rounded-lg text-sm font-medium">
              Enviamos um link de confirmação para seu e-mail. Ative sua conta antes de entrar.
            </div>
          )}

          {verifiedStatus === 'invalid' && (
            <div className="border border-amber-200 bg-amber-50 text-amber-700 px-4 py-3 rounded-lg text-sm font-medium">
              Link de confirmação inválido ou expirado. Solicite um novo cadastro de teste.
            </div>
          )}

          {verifiedStatus === 'error' && (
            <div className="border border-red-200 bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm font-medium">
              Não foi possível confirmar seu e-mail no momento. Tente novamente.
            </div>
          )}

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

          {!cookiesAccepted && (
            <p className="text-xs text-[#7b8d97] text-center">
              Aceite os cookies para continuar
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !cookiesAccepted}
            className="w-full bg-[#1a6a8d] hover:bg-[#155b79] text-white text-sm font-bold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed tracking-wide shadow-md hover:shadow-lg"
          >
            {loading ? 'Autenticando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-[#7b8d97] text-xs mt-6">
          Acesso restrito para usuários autorizados
        </p>

        <div className="mt-4 text-center">
          <Link href="/criar-conta" className="text-xs font-semibold text-[#1a6a8d] hover:text-[#155b79]">
            Não tem conta? Crie seu teste de 3 dias
          </Link>
        </div>
      </div>
      </div>

      {/* Copyright footer */}
      <footer className="w-full text-center py-4 text-white/50 text-xs">
        &copy; {new Date().getFullYear()} OmniNote. Todos os direitos reservados.
      </footer>

      <CookieConsentBanner />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-[#155b79] via-[#1a6a8d] to-[#0c161c]" />}>
      <LoginPageContent />
    </Suspense>
  );
}
