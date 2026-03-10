# 📋 Transcritor de Consultas Médicas

Um aplicativo web para transcrição automática de consultas médicas com formatação SOAP usando IA (Google Gemini).

## ✨ Funcionalidades

- **🎤 Gravação de Áudio**: Grave consultas médicas diretamente no navegador
- **🤖 Processamento com IA**: Análise automática usando Google Gemini API
- **📝 Formatação SOAP**: Resposta estruturada em formato clínico padrão
- **📱 Responsivo**: Funciona em desktops e dispositivos móveis
- **📋 Copiar Facilmente**: Copie seções individuais ou todo o SOAP para seu prontuário

## 🚀 Início Rápido

### Pré-requisitos

- Node.js 18+ instalado
- Chave de API do Google Gemini (obtenha em [Google AI Studio](https://makersuite.google.com/app/apikey))

### Instalação

1. O projeto já está criado em `transcript-ia/`
2. Configure a variável de ambiente:
   - Edite o arquivo `.env.local`
   - Adicione sua chave de API do Gemini:

```bash
NEXT_PUBLIC_GEMINI_API_KEY=sua_chave_aqui
```

### Desenvolvimento

Execute o servidor de desenvolvimento:

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador.

## 📖 Como Usar

1. **Gravação**: Clique em "Iniciar Gravação" e permita acesso ao microfone
2. **Consulta**: Realize a consulta normalmente
3. **Parar**: Clique em "Parar Gravação" ao final
4. **Processamento**: A IA analisará automaticamente e gerará o SOAP
5. **Copiar**: Copie as seções para seu prontuário eletrônico

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

## 📄 Licença

MIT

---

Desenvolvido com ❤️ para profissionais de saúde
