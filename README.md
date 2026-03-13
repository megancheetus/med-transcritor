# 📋 OmniNote

Plataforma web para transcrição clínica multiprofissional com visão integral do paciente e formatação SOAP usando IA (Google Gemini).

## ✨ Funcionalidades

- **🎤 Gravação de Áudio**: Grave consultas médicas diretamente no navegador
- **🖥️ Modo Teleconsulta**: Misture o seu microfone com o áudio da aba ou janela compartilhada
- **🤖 Processamento com IA**: Análise automática usando Google Gemini API
- **📝 Formatação SOAP**: Resposta estruturada em formato clínico padrão
- **📱 Responsivo**: Funciona em desktops e dispositivos móveis
- **📋 Copiar Facilmente**: Copie seções individuais ou todo o SOAP para seu prontuário

## 🚀 Início Rápido

### Pré-requisitos

- Node.js 18+ instalado
- Chave de API do Google Gemini (obtenha em [Google AI Studio](https://makersuite.google.com/app/apikey))
- Instância PostgreSQL acessível pela aplicação

### Instalação

1. O projeto já está criado em `omninote/`
2. Configure as variáveis de ambiente:
   - Edite o arquivo `.env.local`
   - Adicione sua chave de API do Gemini e a conexão com PostgreSQL:

```bash
NEXT_PUBLIC_GEMINI_API_KEY=sua_chave_aqui
DATABASE_URL=postgresql://usuario:senha@host:5432/omninote
POSTGRES_SSL=false
POSTGRES_SSL_REJECT_UNAUTHORIZED=true
AUTH_TOKEN_SECRET=um_segredo_forte_e_longo
# Opcional para DEV apenas (bootstrap local)
AUTH_USERS=[{"username":"admin","password":"troque_essa_senha"}]
AUTH_ADMIN_USERNAME=admin
```

Notas:

- `DATABASE_URL` é obrigatória para histórico multiplataforma.
- `AUTH_TOKEN_SECRET` é obrigatória em produção para assinar a sessão com segurança.
- Em produção, use `POSTGRES_SSL=true` quando seu provedor exigir TLS.
- Se o certificado do provedor não puder ser validado pela cadeia padrão, ajuste `POSTGRES_SSL_REJECT_UNAUTHORIZED=false` apenas se necessário.
- `AUTH_USERS` e `AUTH_ADMIN_USERNAME` são opcionais e devem ser usados apenas em desenvolvimento local para bootstrap inicial.

### Desenvolvimento

Execute o servidor de desenvolvimento:

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador.

## 📖 Como Usar

1. **Modo**: Escolha entre consulta presencial e teleconsulta
2. **Permissões**: Autorize o microfone; na teleconsulta, compartilhe a aba ou janela da chamada com áudio
3. **Consulta**: Realize a consulta normalmente
4. **Parar**: Clique em "Parar Gravação" ao final
5. **Processamento**: A IA analisará automaticamente e gerará o SOAP
6. **Copiar**: Copie as seções para seu prontuário eletrônico

### Observações para Teleconsulta

- Para melhor compatibilidade, abra o OmniNote e a teleconsulta no mesmo navegador, em abas do Chrome ou do Edge, e habilite o compartilhamento de áudio na aba da chamada.
- A captura de áudio de uma janela isolada pode variar conforme o navegador e o sistema operacional.
- O aplicativo grava apenas o áudio misturado; o vídeo compartilhado não é enviado para transcrição.

## 🏗️ Estrutura do Projeto

```text
src/
├── app/
│   ├── page.tsx              # Página principal
│   ├── api/
│   │   └── transcribe/
│   │       └── route.ts      # API para processar áudio
│   └── layout.tsx            # Layout base
├── components/
│   ├── AudioRecorder.tsx     # Componente de gravação
│   └── SOAPResponse.tsx      # Componente de exibição SOAP
```

## 🔧 Tecnologias

- **Next.js 15**: Framework React com App Router
- **TypeScript**: Type safety
- **Tailwind CSS**: Estilização
- **Google Generative AI SDK**: Integração com Gemini
- **Web Audio API**: Gravação de áudio no navegador

## 📝 Formato SOAP

O aplicativo estrutura a resposta em:

- **S (Subjetivo)**: Queixas do paciente e histórico
- **O (Objetivo)**: Sinais vitais e dados de exames
- **A (Avaliação)**: Diagnósticos prováveis
- **P (Plano)**: Conduta, medicações e retorno

## ⚙️ Build para Produção

```bash
npm run build
npm start
```

## 🗄️ Persistência do Histórico

- O histórico de uso é salvo por usuário no PostgreSQL.
- O conteúdo transcrito não é salvo em banco nem em storage local de histórico.
- A tabela `transcription_history` é criada automaticamente na primeira execução da API.
- Usuários autenticados veem o mesmo histórico em dispositivos diferentes, desde que usem a mesma instância da aplicação apontando para o mesmo banco.

## 🔐 Segurança da Autenticação

- Usuários são persistidos na tabela `app_users` no PostgreSQL.
- Senhas são armazenadas como hash, não em texto puro.
- O cookie `auth_token` agora é assinado e expira em 24 horas.
- Em desenvolvimento, se `AUTH_USERS` estiver definido, os usuários são semeados automaticamente no banco na primeira autenticação.

## 👤 Administração de Usuários

- O usuário administrador acessa a tela `Administração` dentro da área autenticada.
- Nessa tela é possível cadastrar, excluir usuários e trocar senhas sem editar variáveis de ambiente.
- O cadastro inclui `usuário (login)`, `nome completo` e `e-mail`.
- Se ainda não existir nenhum administrador, o sistema promove o usuário bootstrap configurado em `AUTH_ADMIN_USERNAME` ou, na falta dele, o primeiro usuário autenticado com sucesso.
- Depois que houver pelo menos um administrador ativo na tabela `app_users`, remova `AUTH_USERS` e `AUTH_ADMIN_USERNAME` do ambiente de produção para eliminar senhas em texto puro do painel de deploy.

## 🚢 Produção

- Configure `AUTH_TOKEN_SECRET` diretamente no painel do provedor de deploy com um segredo aleatório forte; não versione esse valor no repositório.
- Em produção, mantenha `POSTGRES_SSL=true` e deixe `POSTGRES_SSL_REJECT_UNAUTHORIZED` no padrão seguro (`true`).
- Só use `POSTGRES_SSL_REJECT_UNAUTHORIZED=false` em desenvolvimento local e apenas quando o provedor exigir esse relaxamento para a cadeia de certificados.
- Após validar o admin inicial pela interface, remova `AUTH_USERS` e `AUTH_ADMIN_USERNAME` do ambiente produtivo.

Checklist recomendado no painel de deploy:

1. Confirmar presença de `AUTH_TOKEN_SECRET` forte e exclusivo do ambiente.
2. Confirmar `POSTGRES_SSL=true`.
3. Remover `AUTH_USERS`.
4. Remover `AUTH_ADMIN_USERNAME`.
5. Fazer novo deploy para propagar as variáveis atualizadas.

## 📄 Licença

MIT

---

Desenvolvido com ❤️ para profissionais de saúde
