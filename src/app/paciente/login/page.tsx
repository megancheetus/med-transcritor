"use client";
import { Suspense, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { CookieConsentBanner, useCookieConsent } from '@/components/CookieConsentBanner';

function PacienteLoginContent() {
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const cookiesAccepted = useCookieConsent();
  const router = useRouter();

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!cookiesAccepted) return;
    setErro('');
    setLoading(true);
    try {
      const res = await fetch('/api/paciente/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf, senha })
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error || 'Erro ao fazer login.');
      } else {
        router.push('/paciente/dashboard');
      }
    } catch (err) {
      setErro('Erro de conexão. Tente novamente.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#155b79] via-[#1a6a8d] to-[#0c161c]">
      <header className="w-full px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Image src="/favicon.png" alt="OmniNote" width={32} height={32} className="w-8 h-8" priority />
          <span className="text-white font-bold text-base min-[360px]:text-lg tracking-tight">OmniNote</span>
        </div>
        <Link
          href="/login-escolha"
          className="inline-flex items-center rounded-lg border border-white/50 bg-white/10 px-3 py-1.5 text-xs sm:text-sm font-semibold text-white hover:bg-white/20 transition"
        >
          Voltar para seleção de perfil
        </Link>
      </header>

      {/* Login card */}
      <div className="flex-1 flex items-center justify-center p-3 min-[360px]:p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-4 min-[360px]:p-6 sm:p-8 w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-7 min-[360px]:mb-10">
            <div className="inline-block">
              <Image
                src="/logo.png"
                alt="OmniNote Logo"
                width={300}
                height={100}
                priority
                className="w-64 min-[360px]:w-72 sm:w-80 h-auto"
              />
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 min-[360px]:space-y-5">
            <h2 className="text-xl min-[360px]:text-2xl font-bold text-center text-[#155b79] mb-2">Login do Paciente</h2>
            <div>
              <label htmlFor="cpf" className="block text-[11px] min-[360px]:text-xs font-semibold text-[#155b79] uppercase tracking-wider mb-2">
                CPF
              </label>
              <input
                type="text"
                id="cpf"
                value={cpf}
                onChange={e => setCpf(e.target.value)}
                placeholder="Digite seu CPF"
                className="w-full px-3 min-[360px]:px-4 py-2.5 min-[360px]:py-3 text-xs min-[360px]:text-sm border-2 border-[#cfe0e8] rounded-lg focus:outline-none focus:border-[#1ea58c] focus:ring-2 focus:ring-[#1ea58c] focus:ring-opacity-20 transition text-[#0c161c] placeholder-[#7b8d97]"
                required
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="senha" className="block text-[11px] min-[360px]:text-xs font-semibold text-[#155b79] uppercase tracking-wider mb-2">
                Senha
              </label>
              <input
                type="password"
                id="senha"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                placeholder="Digite sua senha"
                className="w-full px-3 min-[360px]:px-4 py-2.5 min-[360px]:py-3 text-xs min-[360px]:text-sm border-2 border-[#cfe0e8] rounded-lg focus:outline-none focus:border-[#1ea58c] focus:ring-2 focus:ring-[#1ea58c] focus:ring-opacity-20 transition text-[#0c161c] placeholder-[#7b8d97]"
                required
                disabled={loading}
              />
            </div>
            {erro && (
              <div className="border border-red-200 bg-red-50 text-red-700 px-3 min-[360px]:px-4 py-2.5 min-[360px]:py-3 rounded-lg text-xs min-[360px]:text-sm font-medium leading-relaxed">
                {erro}
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
              className="w-full min-h-11 bg-[#1ea58c] hover:bg-[#178c74] text-white text-xs min-[360px]:text-sm font-bold py-2.5 min-[360px]:py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed tracking-wide shadow-md hover:shadow-lg"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="mt-4 space-y-3 text-center">
            <Link href="/paciente/primeiro-acesso" className="block text-xs font-semibold text-[#1a6a8d] hover:text-[#155b79]">
              Primeiro acesso?
            </Link>
            <Link href="/login-escolha" className="inline-flex w-full justify-center rounded-lg border border-[#cfe0e8] px-3 py-2 text-xs font-semibold text-[#4b6573] hover:bg-[#f7fbfc] transition sm:hidden">
              Voltar para seleção de perfil
            </Link>
          </div>
        </div>
      </div>

      {/* Copyright footer */}
      <footer className="w-full text-center py-4 text-white/50 text-[11px] min-[360px]:text-xs">
        &copy; {new Date().getFullYear()} OmniNote. Todos os direitos reservados.
      </footer>

      <CookieConsentBanner />
    </div>
  );
}

export default function PacienteLogin() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-[#155b79] via-[#1a6a8d] to-[#0c161c]" />}>
      <PacienteLoginContent />
    </Suspense>
  );
}
