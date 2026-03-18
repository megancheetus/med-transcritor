# OmniNote

OmniNote é uma plataforma web para transcrição clínica multiprofissional, com foco em organização de prontuário, histórico de uso e geração de conteúdo estruturado em formato escolhido com IA (Google Gemini).

## Visão Geral

O projeto reúne quatro blocos principais:

- Transcrição de consultas presenciais e teleconsultas com captura de áudio no navegador.
- Gestão de pacientes e prontuário eletrônico em interface autenticada.
- Teleconsulta com sala própria e fluxo de entrada para profissional e paciente.
- Administração de usuários com autenticação segura e persistência em PostgreSQL.

## Funcionalidades Atuais

- Transcrição clínica com modelos Gemini selecionáveis.
- Estruturação automática de texto em SOAP.
- Gravação em modo presencial e modo teleconsulta.
- Backup local de áudio e tratamento de erros de captura.
- Histórico de transcrições por usuário (metadados, sem salvar conteúdo clínico).
- Cadastro e edição de pacientes.
- Cadastro e edição de registros médicos.
- Teleconsulta com criação de sala, link de acesso e acompanhamento de status.
- Painel administrativo para criação, exclusão e troca de senha de usuários.
- Middleware de autenticação para rotas protegidas.
- Health check de aplicação e banco.

## Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- PostgreSQL
- Google Generative AI SDK (Gemini)
- Web Audio API e MediaRecorder

## Requisitos

- Node.js 18 ou superior
- npm
- Banco PostgreSQL acessível pela aplicação
- Chave da API Gemini
- Token de escrita do Vercel Blob

## Configuração de Ambiente

Crie um arquivo `.env.local` na raiz do projeto.

Exemplo:

```bash
GEMINI_API_KEY=sua_chave_gemini
DATABASE_URL=

POSTGRES_SSL=true
POSTGRES_SSL_REJECT_UNAUTHORIZED=true
POSTGRES_CA_CERT=

AUTH_TOKEN_SECRET=um_segredo_forte_e_longo

# Upload direto de áudio privado (evita limite de 4.5MB da função)
BLOB_READ_WRITE_TOKEN=seu_token_blob

# Opcional em desenvolvimento local
AUTH_USERS=[{"username":"admin","password":"troque_essa_senha"}]
AUTH_ADMIN_USERNAME=admin

# Opcional para geração de links absolutos
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Jitsi as a Service (JaaS)
JAAS_APP_ID=seu_app_id_jaas
JAAS_KEY_ID=seu_key_id_jaas
JAAS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nSUA_CHAVE_PRIVADA_AQUI\n-----END PRIVATE KEY-----"
NEXT_PUBLIC_JAAS_DOMAIN=8x8.vc
```

Notas importantes:

- Use apenas `GEMINI_API_KEY` no servidor.
- O fluxo de upload direto privado depende de `BLOB_READ_WRITE_TOKEN` no ambiente de execução.
- Em produção, prefira `POSTGRES_SSL=true`.
- Evite `POSTGRES_SSL_REJECT_UNAUTHORIZED=false` fora de desenvolvimento local.
- `AUTH_USERS` e `AUTH_ADMIN_USERNAME` devem ser usados somente para bootstrap local.
- `JAAS_PRIVATE_KEY` deve ser armazenada apenas no servidor.
- Em provedores que não aceitam multiline, mantenha a chave privada PEM com `\n` no valor.

## Como Executar

Instalar dependências:

```bash
npm install
```

Rodar em desenvolvimento:

```bash
npm run dev
```

Build de produção:

```bash
npm run build
npm start
```

Lint:

```bash
npm run lint
```

## Fluxo de Uso

1. Faça login.
2. Escolha o contexto de trabalho (transcrição, prontuário, teleconsulta).
3. No módulo de transcrição, selecione o modo de captura e grave o áudio.
4. Revise a saída SOAP antes de uso clínico.
5. No prontuário, vincule informações ao paciente e acompanhe histórico.

## Teleconsulta

- O sistema cria salas de teleconsulta com token de acesso.
- Profissional e paciente entram pela rota pública de sala.
- A aplicação mantém status de sessão (aguardando, ativa, encerrada, expirada).
- O fluxo registra eventos de entrada e encerramento para auditoria operacional.
- O embed de produção usa Jitsi as a Service (JaaS) com JWT assinado no backend.
- O profissional entra como moderador e o paciente entra com permissões reduzidas.
- A rota [src/app/api/videoconsultations/[id]/jaas/route.ts](src/app/api/videoconsultations/[id]/jaas/route.ts) emite tokens por sala e papel.

## Persistência e Privacidade

- O histórico salva metadados de uso e execução.
- O conteúdo clínico transcrito não é persistido no histórico de uso.
- Usuários e permissões são armazenados em PostgreSQL.
- Senhas são armazenadas com hash.

## Estrutura Principal

```text
src/
   app/
      (workspace)/
         dashboard/
         historico/
         perfil/
         prontuario/
         teleconsulta/
         transcricao/
      api/
         auth/
         patients/
         medical-records/
         history/
         transcribe/
         videoconsultations/
      room/[id]/
   components/
      AudioRecorder.tsx
      TranscriberPage.tsx
      PatientDashboard.tsx
      AppShell.tsx
   lib/
      auth.ts
      authUsers.ts
      patientManager.ts
      medicalRecordManager.ts
      videoConsultationManager.ts
      transcriptionHistoryStore.ts
```

## Deploy

Recomendado para produção:

- Definir todas as variáveis de ambiente no provedor (exemplo: Vercel).
- Garantir `AUTH_TOKEN_SECRET` forte e exclusivo por ambiente.
- Configurar conexão PostgreSQL com SSL conforme o provedor.
- Validar rota de health check após o deploy.

## Licença

MIT
