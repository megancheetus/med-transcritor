"use client";
import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { CookieConsentBanner } from '@/components/CookieConsentBanner';

const NAV_LINKS = [
  { href: '/planos', label: 'Planos' },
  { href: '/funcionamento', label: 'Como funciona' },
  { href: '/criar-conta', label: 'Criar conta' },
];

function LoginEscolhaContent() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#155b79] via-[#1a6a8d] to-[#0c161c]">
      {/* Public nav */}
      <header className="w-full px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Image src="/favicon.png" alt="OmniNote" width={32} height={32} className="w-8 h-8" priority />
          <span className="text-white font-bold text-base min-[360px]:text-lg tracking-tight">OmniNote</span>
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

      {/* Escolha card */}
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

          <div className="space-y-4 min-[360px]:space-y-5">
            <h2 className="text-xl min-[360px]:text-2xl font-bold text-center text-[#155b79] mb-2">Escolha o tipo de acesso</h2>
            <Link href="/login" className="w-full block bg-[#1a6a8d] hover:bg-[#155b79] text-white text-xs min-[360px]:text-sm font-bold py-2.5 min-[360px]:py-3 rounded-lg transition text-center shadow-md hover:shadow-lg">
              Sou Profissional
            </Link>
            <Link href="/paciente/login" className="w-full block bg-[#1ea58c] hover:bg-[#178c74] text-white text-xs min-[360px]:text-sm font-bold py-2.5 min-[360px]:py-3 rounded-lg transition text-center shadow-md hover:shadow-lg">
              Sou Paciente
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

export default function LoginEscolha() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-[#155b79] via-[#1a6a8d] to-[#0c161c]" />}>
      <LoginEscolhaContent />
    </Suspense>
  );
}
