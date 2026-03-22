import Link from 'next/link';

const WHATSAPP_LINK = 'https://wa.me/5581992871707';

const plans = [
  {
    name: 'Plano Básico',
    price: 'R$ 49,90 / mês',
    description: 'Acesso à ferramenta de transcrição de consultas.',
    features: ['Transcrição clínica', 'Organização de texto estruturado', 'Exportação de resultado'],
    highlight: false,
  },
  {
    name: 'Plano Clínico',
    price: 'R$ 74,90 / mês',
    description: 'Acesso ao módulo de transcrição e teleconsulta.',
    features: ['Tudo do Básico', 'Teleconsulta com sala dedicada', 'Fluxo de atendimento remoto'],
    highlight: true,
  },
  {
    name: 'Plano Pro',
    price: 'R$ 99,90 / mês',
    description:
      'Acesso completo à plataforma: teleconsulta, transcrição, gestão de pacientes e prontuários.',
    features: ['Tudo do Clínico', 'Gestão completa de pacientes', 'Prontuário eletrônico integrado'],
    highlight: false,
  },
];

export default function PlanosPage() {
  const comparisonFeatures = [
    {
      category: 'Transcrição',
      features: [
        { name: 'Transcrição de áudio', basico: true, clinico: true, pro: true },
        { name: 'Formatação SOAP e Clínica automática', basico: true, clinico: true, pro: true },
        { name: 'Histórico de transcrições', basico: true, clinico: true, pro: true },
        { name: 'Exportação de documentos', basico: true, clinico: true, pro: true },
      ],
    },
    {
      category: 'Teleconsulta',
      features: [
        { name: 'Sala de consulta dedicada', basico: false, clinico: true, pro: true },
        { name: 'Gravação de consultas', basico: false, clinico: true, pro: true },
        { name: 'Compartilhamento de tela', basico: false, clinico: true, pro: true },
        { name: 'Notificações de chamadas', basico: false, clinico: true, pro: true },
      ],
    },
    {
      category: 'Gestão Clínica',
      features: [
        { name: 'Base de pacientes', basico: false, clinico: false, pro: true },
        { name: 'Prontuário eletrônico', basico: false, clinico: false, pro: true },
        { name: 'Histórico de atendimentos', basico: false, clinico: false, pro: true },
        { name: 'Relatórios e analytics', basico: false, clinico: false, pro: true },
      ],
    },
  ];

  const faqs = [
    {
      question: 'Posso trocar de plano a qualquer momento?',
      answer:
        'Sim, você pode fazer upgrade ou downgrade de seu plano a qualquer momento. As mudanças ocorrem no ciclo de cobrança seguinte.',
    },
    {
      question: 'Há período de teste antes de escolher um plano?',
      answer:
        'Sim! Oferecemos 3 dias gratuitos para testar a plataforma. Você pode experimentar os recursos presentes em cada plano durante este período.',
    },
    {
      question: 'O que acontece ao fim do período de teste?',
      answer:
        'Após os 3 dias, você precisará escolher um plano para continuar usando a plataforma. Seus dados permanecerão salvos.',
    },
    {
      question: 'Há desconto para pagamento anual?',
      answer:
        'Sim! Entre em contato conosco via WhatsApp para conhecer nossos planos anuais com desconto especial.',
    },
    {
      question: 'Quais são os métodos de pagamento?',
      answer:
        'Aceitamos cartão de crédito (parcelado em até 12x), transferência bancária e PIX. Entre em contato para mais detalhes.',
    },
    {
      question: 'Há suporte técnico incluído?',
      answer:
        'Todos os planos contam com suporte via email. Os planos Clínico e Pró têm acesso a suporte prioritário via WhatsApp e chat.',
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#155b79]">OmniNote</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">Planos para sua rotina clínica</h1>
            <p className="mt-3 max-w-2xl text-slate-600">
              Escolha o plano ideal para seu momento e evolua da transcrição para uma operação clínica
              completa.
            </p>
          </div>

          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-[#155b79] px-5 text-sm font-semibold text-white transition hover:bg-[#124b63]"
          >
            Voltar para login
          </Link>
        </header>

        <section className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={[
                'rounded-2xl border bg-white p-6 shadow-sm transition',
                plan.highlight
                  ? 'border-[#1ea58c] ring-2 ring-[#1ea58c]/20 md:-translate-y-1'
                  : 'border-slate-200 hover:-translate-y-1 hover:shadow-md',
              ].join(' ')}
            >
              {plan.highlight && (
                <span className="inline-flex rounded-full bg-[#1ea58c]/15 px-3 py-1 text-xs font-semibold text-[#0d7b67]">
                  Mais escolhido
                </span>
              )}

              <h2 className="mt-4 text-2xl font-bold text-slate-900">{plan.name}</h2>
              <p className="mt-2 text-3xl font-extrabold text-[#155b79]">{plan.price}</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{plan.description}</p>

              <ul className="mt-5 space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-1 h-2 w-2 rounded-full bg-[#1ea58c]" aria-hidden />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className={[
                  'mt-7 inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition',
                  plan.highlight
                    ? 'bg-[#1ea58c] text-white hover:bg-[#178a75]'
                    : 'bg-slate-900 text-white hover:bg-slate-800',
                ].join(' ')}
              >
                Quero este plano
              </Link>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-2xl border border-[#1ea58c]/30 bg-[#1ea58c]/10 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Solicite um teste grátis de 3 dias da plataforma</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-700">
                Experimente os recursos essenciais do OmniNote por 3 dias e avalie como a plataforma se encaixa
                na sua rotina clínica.
              </p>
            </div>

            <Link
              href="/criar-conta"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-[#0d7b67] px-5 text-sm font-semibold text-white transition hover:bg-[#0b6a59]"
            >
              Criar conta de teste agora
            </Link>
          </div>
        </section>

        {/* Seção de Comparação de Features */}
        <section className="mt-16">
          <div className="mb-10">
            <h2 className="text-3xl font-bold text-slate-900">Compare os recursos de cada plano</h2>
            <p className="mt-2 text-slate-600">
              Veja quais funcionalidades estão incluídas em cada nível de serviço.
            </p>
          </div>

          <div className="space-y-8">
            {comparisonFeatures.map((section) => (
              <div key={section.category} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="bg-gradient-to-r from-[#155b79]/5 to-[#1ea58c]/5 p-4 border-b border-slate-200">
                  <h3 className="text-lg font-bold text-slate-900">{section.category}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="px-6 py-3 text-left font-semibold text-slate-900">Funcionalidade</th>
                        <th className="px-6 py-3 text-center font-semibold text-slate-900">Básico</th>
                        <th className="px-6 py-3 text-center font-semibold text-slate-900">Clínico</th>
                        <th className="px-6 py-3 text-center font-semibold text-slate-900">Pro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.features.map((feature, idx) => (
                        <tr
                          key={feature.name}
                          className={[
                            'border-b border-slate-200 transition',
                            idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50',
                          ].join(' ')}
                        >
                          <td className="px-6 py-3 text-slate-700">{feature.name}</td>
                          <td className="px-6 py-3 text-center">
                            {feature.basico ? (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#1ea58c]/20">
                                <span className="h-2 w-2 rounded-full bg-[#1ea58c]" />
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-3 text-center">
                            {feature.clinico ? (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#1ea58c]/20">
                                <span className="h-2 w-2 rounded-full bg-[#1ea58c]" />
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-3 text-center">
                            {feature.pro ? (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#1ea58c]/20">
                                <span className="h-2 w-2 rounded-full bg-[#1ea58c]" />
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Seção de Evolução */}
        <section className="mt-16">
          <div className="mb-10">
            <h2 className="text-3xl font-bold text-slate-900">A evolução do seu consultório digital</h2>
            <p className="mt-2 text-slate-600">
              Cada plano foi desenhado para um estágio diferente da sua jornada digital.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: '🎙️',
                title: 'Plano Básico',
                subtitle: 'Comece simple',
                description:
                  'Perfeito para profissionais que querem automatizar a documentação de consultas com transcrição.',
              },
              {
                icon: '📞',
                title: 'Plano Clínico',
                subtitle: 'Expanda seus serviços',
                description:
                  'Adicione consultas remotas à sua operação. Atenda pacientes de qualquer lugar com teleconsulta integrada.',
              },
              {
                icon: '📊',
                title: 'Plano Pro',
                subtitle: 'Operação completa',
                description:
                  'Gerencie sua clínica por completo. Prontuário eletrônico, gestão de pacientes e relatórios avançados em um só lugar.',
              },
            ].map((item, idx) => (
              <div
                key={item.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-lg transition"
              >
                <div className="text-4xl mb-3">{item.icon}</div>
                <h3 className="text-lg font-bold text-slate-900">{item.title}</h3>
                <p className="mt-1 text-sm font-semibold text-[#155b79]">{item.subtitle}</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Seção FAQ */}
        <section className="mt-16 mb-16">
          <div className="mb-10">
            <h2 className="text-3xl font-bold text-slate-900">Perguntas frequentes</h2>
            <p className="mt-2 text-slate-600">
              Dúvidas sobre os planos? Aqui estão as respostas que você procura.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <details
                key={faq.question}
                className="group rounded-2xl border border-slate-200 bg-white p-6 cursor-pointer hover:border-[#1ea58c]/50 transition"
              >
                <summary className="flex items-center justify-between font-semibold text-slate-900 list-none">
                  <span>{faq.question}</span>
                  <span className="text-2xl text-[#1ea58c] group-open:rotate-180 transition-transform">+</span>
                </summary>
                <p className="mt-4 text-slate-600 leading-relaxed">{faq.answer}</p>
              </details>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-[#155b79]/20 bg-[#155b79]/5 p-6 text-center">
            <h3 className="text-xl font-bold text-slate-900">
              Ainda tem dúvidas? Converse conosco no WhatsApp!
            </h3>
            <p className="mt-2 text-slate-600">
              Nossa equipe está disponível para esclarecer qualquer dúvida sobre os planos.
            </p>
            <Link
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-[#155b79] px-6 text-sm font-semibold text-white transition hover:bg-[#124b63]"
            >
              Enviar mensagem no WhatsApp
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
