'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Script from 'next/script';

declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

export default function CriarContaPage() {
  const router = useRouter();
  const [recaptchaSiteKey, setRecaptchaSiteKey] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recaptchaStatus, setRecaptchaStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  useEffect(() => {
    let isMounted = true;

    async function loadPublicConfig() {
      try {
        const response = await fetch('/api/public-config', {
          method: 'GET',
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error('PUBLIC_CONFIG_NOT_AVAILABLE');
        }

        const data = (await response.json()) as { recaptchaSiteKey?: string };
        const key = typeof data.recaptchaSiteKey === 'string' ? data.recaptchaSiteKey.trim() : '';

        if (!isMounted) {
          return;
        }

        if (!key) {
          setRecaptchaStatus('error');
          return;
        }

        setRecaptchaSiteKey(key);
        setRecaptchaStatus('loading');
      } catch {
        if (isMounted) {
          setRecaptchaStatus('error');
        }
      }
    }

    loadPublicConfig();

    return () => {
      isMounted = false;
    };
  }, []);

  const waitForRecaptcha = async (): Promise<NonNullable<Window['grecaptcha']>> => {
    const timeoutAt = Date.now() + 8000;

    while (Date.now() < timeoutAt) {
      if (window.grecaptcha) {
        return window.grecaptcha;
      }

      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    throw new Error('reCAPTCHA não ficou disponível na página. Recarregue e tente novamente.');
  };

  const getRecaptchaToken = async (): Promise<string> => {
    if (!recaptchaSiteKey) {
      throw new Error('reCAPTCHA indisponível no momento. Tente novamente mais tarde.');
    }

    if (recaptchaStatus === 'error') {
      throw new Error('Falha ao carregar o reCAPTCHA. Verifique bloqueadores do navegador e recarregue a página.');
    }

    const grecaptcha = await waitForRecaptcha();

    return new Promise((resolve, reject) => {
      grecaptcha.ready(async () => {
        try {
          const token = await grecaptcha.execute(recaptchaSiteKey, { action: 'trial_register' });
          if (!token) {
            reject(new Error('Não foi possível validar o reCAPTCHA.'));
            return;
          }
          resolve(token);
        } catch {
          reject(new Error('Falha ao validar reCAPTCHA.'));
        }
      });
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setIsSubmitting(true);

    try {
      const recaptchaToken = await getRecaptchaToken();

      const response = await fetch('/api/auth/register-trial', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fullName, username, email, password, recaptchaToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível criar sua conta de teste');
      }

      setSuccessMessage('Conta criada com sucesso. Verifique seu e-mail para ativar o acesso.');
      setTimeout(() => {
        router.push('/login?verified=sent');
      }, 900);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível criar sua conta de teste');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#155b79] via-[#1a6a8d] to-[#0c161c] px-6 py-10">
      {recaptchaSiteKey ? (
        <Script
          src={`https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(recaptchaSiteKey)}`}
          strategy="afterInteractive"
          onLoad={() => setRecaptchaStatus(window.grecaptcha ? 'ready' : 'loading')}
          onError={() => setRecaptchaStatus('error')}
        />
      ) : null}
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">OmniNote</p>
            <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">Crie sua conta de teste gratuita</h1>
            <p className="mt-3 max-w-2xl text-sm text-white/80">
              Ative seu período de teste e avalie a transcrição clínica, a teleconsulta e o prontuário
              eletrônico em um fluxo unificado.
            </p>
          </div>

          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-white px-5 text-sm font-semibold text-[#155b79] transition hover:bg-slate-100"
          >
            Voltar ao login
          </Link>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="space-y-4 text-white">
            <div className="rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-sm">
              <h2 className="text-xl font-bold">O que está incluído no teste</h2>
              <ul className="mt-4 space-y-3 text-sm text-white/90">
                <li>Transcrição clínica completa em modelo SOAP e em modelo clínico tradicional</li>
                <li>Teleconsulta com sala dedicada para atendimentos remotos</li>
                <li>Prontuário eletrônico e gestão de pacientes em um único ambiente</li>
                <li>3 dias de acesso para validar o fluxo completo da plataforma</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-white/20 bg-[#0c161c]/25 p-6 backdrop-blur-sm">
              <h2 className="text-lg font-bold">Como funciona após o cadastro</h2>
              <ol className="mt-4 space-y-3 text-sm text-white/85">
                <li>1. Você cria sua conta com nome, e-mail e senha.</li>
                <li>2. Enviamos um link de confirmação para ativar o acesso.</li>
                <li>3. Após a validação, o ambiente já fica liberado para teste.</li>
                <li>4. Ao final do período, você pode evoluir para um plano definitivo.</li>
              </ol>
            </div>

            <div className="grid gap-4 sm:grid-cols-1">
              <article className="rounded-2xl border border-white/15 bg-white/8 p-5 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65">Ambiente clínico</p>
                <p className="mt-3 text-sm leading-relaxed text-white/90">
                  Ideal para validar a rotina real de transcrição, teleconsulta e organização do atendimento.
                </p>
              </article>
            </div>

            <div className="rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65">Planos</p>
                  <h2 className="mt-2 text-lg font-bold"></h2>
                </div>
                <Link
                  href="/planos"
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-white px-4 text-xs font-semibold text-[#155b79] transition hover:bg-slate-100"
                >
                  Ver detalhes
                </Link>
              </div>

              <div className="mt-5 grid gap-3">
                <article className="rounded-xl border border-white/15 bg-[#0c161c]/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-bold text-white">Plano Básico</h3>
                    <span className="text-sm font-semibold text-white/85">R$ 49,90/mês</span>
                  </div>
                  <p className="mt-2 text-sm text-white/80">
                    Indicado para quem quer focar apenas na transcrição clínica com agilidade operacional.
                  </p>
                </article>

                <article className="rounded-xl border border-[#7de4d0]/40 bg-[#117a69]/18 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-bold text-white">Plano Clínico</h3>
                    <span className="text-sm font-semibold text-white/90">R$ 74,90/mês</span>
                  </div>
                  <p className="mt-2 text-sm text-white/85">
                    Libera transcrição e teleconsulta para profissionais que atendem presencial e remoto.
                  </p>
                </article>

                <article className="rounded-xl border border-white/15 bg-[#0c161c]/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-bold text-white">Plano Pró</h3>
                    <span className="text-sm font-semibold text-white/85">R$ 99,90/mês</span>
                  </div>
                  <p className="mt-2 text-sm text-white/80">
                    Estrutura completa com transcrição, teleconsulta, pacientes e prontuário eletrônico.
                  </p>
                </article>
              </div>

              <p className="mt-4 text-xs leading-relaxed text-white/70">
                O período de teste ajuda a validar a plataforma no seu contexto real antes da contratação de um plano.
              </p>
            </div>
          </section>

          <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div>
              <label htmlFor="trial-full-name" className="block text-xs font-semibold text-[#4b6573] uppercase tracking-wide mb-2">
                Nome completo
              </label>
              <input
                id="trial-full-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="w-full rounded-lg border border-[#cfe0e8] px-4 py-3 text-sm focus:border-[#1ea58c] focus:outline-none"
                placeholder="Ex.: Ana Souza"
                minLength={3}
                required
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="trial-username" className="block text-xs font-semibold text-[#4b6573] uppercase tracking-wide mb-2">
                Usuário
              </label>
              <input
                id="trial-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="w-full rounded-lg border border-[#cfe0e8] px-4 py-3 text-sm focus:border-[#1ea58c] focus:outline-none"
                placeholder="Ex.: anasouza"
                minLength={3}
                required
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="trial-email" className="block text-xs font-semibold text-[#4b6573] uppercase tracking-wide mb-2">
                E-mail
              </label>
              <input
                id="trial-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-lg border border-[#cfe0e8] px-4 py-3 text-sm focus:border-[#1ea58c] focus:outline-none"
                placeholder="ana@clinica.com"
                required
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="trial-password" className="block text-xs font-semibold text-[#4b6573] uppercase tracking-wide mb-2">
                Senha
              </label>
              <input
                id="trial-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-[#cfe0e8] px-4 py-3 text-sm focus:border-[#1ea58c] focus:outline-none"
                placeholder="Mínimo de 8 caracteres"
                minLength={8}
                required
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="trial-confirm-password" className="block text-xs font-semibold text-[#4b6573] uppercase tracking-wide mb-2">
                Confirmar senha
              </label>
              <input
                id="trial-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-lg border border-[#cfe0e8] px-4 py-3 text-sm focus:border-[#1ea58c] focus:outline-none"
                placeholder="Repita a senha"
                minLength={8}
                required
                disabled={isSubmitting}
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {successMessage}
              </div>
            )}

            {recaptchaStatus === 'loading' && !error && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                Preparando validação reCAPTCHA...
              </div>
            )}

            {recaptchaStatus === 'error' && !error && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                O reCAPTCHA não carregou corretamente. Se você usa bloqueador de anúncios ou proteção de rastreamento,
                libere o Google para esta página e recarregue.
              </div>
            )}

            <div className="rounded-lg border border-[#dbe9ef] bg-[#f7fbfc] px-4 py-3 text-xs leading-relaxed text-[#4b6573]">
              Ao criar sua conta, você concorda em usar o ambiente de teste para avaliação da plataforma. A ativação
              depende da confirmação do e-mail informado.
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-[#1ea58c] py-3 text-sm font-bold text-white transition hover:bg-[#178a75] disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Criando conta...' : 'Criar conta de teste'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
