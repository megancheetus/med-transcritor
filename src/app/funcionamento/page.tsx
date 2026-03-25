import Link from 'next/link';

const steps = [
  {
    title: '1. Captura da consulta',
    description:
      'O profissional grava o atendimento presencial ou remoto e envia o áudio para processamento.',
  },
  {
    title: '2. Transcrição inteligente',
    description:
      'A plataforma transforma o áudio em texto estruturado, com foco em clareza e organização clínica.',
  },
  {
    title: '3. Estruturação clínica',
    description:
      'Os dados são organizados em formato prático para revisão, com suporte ao padrão SOAP.',
  },
  {
    title: '4. Integração com rotina',
    description:
      'Com os módulos avançados, você conecta teleconsulta, prontuário e gestão de pacientes em um fluxo único.',
  },
];

const modules = [
  {
    name: 'Transcrição',
    detail: 'Converte áudio clínico em texto estruturado com rapidez.',
  },
  {
    name: 'Teleconsulta',
    detail: 'Atendimentos remotos com sala de consulta e acompanhamento de status.',
  },
  {
    name: 'Gestão de Pacientes',
    detail: 'Cadastro, histórico e organização do cuidado em um único lugar.',
  },
  {
    name: 'Prontuário',
    detail: 'Registros clínicos e acompanhamento contínuo com mais rastreabilidade.',
  },
];

export default function FuncionamentoPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f8fbfd] via-white to-[#f2f7fa] px-4 min-[360px]:px-6 py-8 min-[360px]:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 min-[360px]:mb-12 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs min-[360px]:text-sm font-semibold uppercase tracking-[0.14em] min-[360px]:tracking-[0.18em] text-[#155b79]">OmniNote</p>
            <h1 className="mt-2 text-2xl min-[360px]:text-3xl sm:text-4xl font-bold leading-tight text-slate-900">Como funciona</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
              Uma jornada simples para transformar consultas em informação clínica útil, organizada e pronta
              para o seu fluxo de trabalho.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
            <Link
              href="/planos"
              className="inline-flex min-h-11 w-full sm:w-auto items-center justify-center rounded-lg border border-slate-300 px-5 py-2 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Ver planos
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-11 w-full sm:w-auto items-center justify-center rounded-lg bg-[#155b79] px-5 py-2 text-center text-sm font-semibold text-white transition hover:bg-[#124b63]"
            >
              Entrar
            </Link>
          </div>
        </header>

        <section className="mb-10 min-[360px]:mb-12 grid gap-4 md:grid-cols-2">
          {steps.map((step) => (
            <article key={step.title} className="rounded-2xl border border-slate-200 bg-white p-4 min-[360px]:p-6 shadow-sm">
              <h2 className="text-base min-[360px]:text-lg leading-tight font-bold text-slate-900">{step.title}</h2>
              <p className="mt-2 text-xs min-[360px]:text-sm leading-relaxed text-slate-600">{step.description}</p>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 min-[360px]:p-6 shadow-sm">
          <h2 className="text-xl min-[360px]:text-2xl leading-tight font-bold text-slate-900">Módulos da plataforma</h2>
          <p className="mt-2 text-xs min-[360px]:text-sm leading-relaxed text-slate-600">
            Conforme o plano escolhido, você libera novos blocos para expandir sua operação clínica.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {modules.map((module) => (
              <article key={module.name} className="rounded-xl bg-slate-50 p-3 min-[360px]:p-4">
                <h3 className="text-sm min-[360px]:text-base leading-tight font-semibold text-slate-900">{module.name}</h3>
                <p className="mt-2 text-xs min-[360px]:text-sm leading-relaxed text-slate-600">{module.detail}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
