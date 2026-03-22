# OmniNote - Instruções do Copilot

## Visão Geral do Projeto

Aplicativo Next.js para transcrição clínica multiprofissional com visão integral do paciente.

### Funcionalidades Principais
- Gravação de áudio em tempo real no navegador
- Integração com Google Gemini para processamento de áudio
- Formatação automática em SOAP (Subjetivo, Objetivo, Avaliação, Plano)
- Interface responsiva para desktop e mobile
- Cópia de conteúdo com um clique

## Stack Tecnológico

- **Framework**: Next.js 15 (App Router)
- **Linguagem**: TypeScript
- **Estilos**: Tailwind CSS
- **IA/API**: Google Generative AI SDK
- **Áudio**: Web Audio API (MediaRecorder)

## Estrutura do Projeto

```
src/
├── app/
│   ├── layout.tsx          # Layout base
│   ├── page.tsx            # Página principal (componente cliente)
│   └── api/
│       └── transcribe/
│           └── route.ts    # Rota POST para processar áudio
├── components/
│   ├── AudioRecorder.tsx   # Componente de gravação de áudio
│   └── SOAPResponse.tsx    # Componente de exibição SOAP
└── globals.css             # Estilos globais Tailwind
```

## Padrões de Código

### Componentes
- Todos componentes de UI são "use client" (Client Components)
- Estado gerenciado com `useState` do React
- Props tipadas com TypeScript interfaces

### API
- Rota POST em `/api/transcribe`
- Recebe FormData com blob de áudio
- Retorna JSON com conteúdo SOAP processado

### Prompt de Sistema
O prompt é restritivo para evitar alucinações:
- Instrui a IA a ignorar conversas casuais
- Define estrutura SOAP clara
- Permite seções vazias se não informadas
- Prioriza precisão sobre completude

## Configuração Necessária

### Variáveis de Ambiente
- `NEXT_PUBLIC_GEMINI_API_KEY`: Chave de API do Google Gemini
  - Obter em: https://makersuite.google.com/app/apikey

### Requisitos do Node
- Node.js 18+
- npm (ou yarn/pnpm/bun)

## Comandos Principais

```bash
npm run dev      # Servidor de desenvolvimento
npm run build    # Build para produção
npm start        # Inicia servidor de produção
npm run lint     # Verifica ESLint
```

## Fluxo de Funcionamento

1. **Usuário clica "Iniciar Gravação"**
   - Solicita permissão de microfone
   - Inicia MediaRecorder

2. **Durante a consulta**
   - Áudio é capturado em chunks
   - Timer mostra duração

3. **Usuário clica "Parar Gravação"**
   - Media para de capturar
   - Blob de áudio é passado ao handler

4. **Envio para API**
   - FormData com áudio é enviado a `/api/transcribe`
   - Loading state é mostrado

5. **Processamento Gemini**
   - Áudio é convertido para base64
   - Enviado ao Gemini com prompt SOAP
   - Resposta é parseada

6. **Exibição SOAP**
   - Conteúdo é dividido em 4 seções
   - Usuário pode copiar individualmente ou tudo

## Pontos Importantes

- O componente AudioRecorder gerencia todo o ciclo de gravação
- O SOAPResponse faz parsing simples da resposta em seções S/O/A/P
- A API rota é serverless e processa no servidor Next.js
- Suporta áudio de qualidade WAV via Web Audio API

## Desenvolvimento

### Adicionar Novas Features
1. Componentes de UI devem ser "use client"
2. Estado compartilhado deve usar Context se necessário
3. Novas rotas API devem seguir padrão de rota NextJS

### Debugging
- Console do navegador para erros de cliente
- Logs do servidor em `npm run dev`
- Verificar permissões do microfone

## Notas Médicas/Clínicas

- O prompt foi designed para ser restritivo e clinicamente seguro
- Não alucina dados médicos quando bem instruído
- Respeita o padrão SOAP amplamente usado em prontuários eletrônicos
- Deixa seções em branco se dados não forem fornecidos

---

**Última atualização**: Março 2026
