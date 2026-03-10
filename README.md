# 📋 Transcritor de Consultas Médicas

Um aplicativo web para transcrição automática de consultas médicas com formatação SOAP usando IA (Google Gemini).

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

1. **Modo**: Escolha entre consulta presencial e teleconsulta
2. **Permissões**: Autorize o microfone; na teleconsulta, compartilhe a aba ou janela da chamada com áudio
3. **Consulta**: Realize a consulta normalmente
4. **Parar**: Clique em "Parar Gravação" ao final
5. **Processamento**: A IA analisará automaticamente e gerará o SOAP
6. **Copiar**: Copie as seções para seu prontuário eletrônico

### Observações para Teleconsulta

- Para melhor compatibilidade, abra o MedTranscritor e a teleconsulta no mesmo navegador, em abas do Chrome ou do Edge, e habilite o compartilhamento de áudio na aba da chamada.
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

## 📄 Licença

MIT

---

Desenvolvido com ❤️ para profissionais de saúde
