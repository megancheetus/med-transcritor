import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

const client = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || '');

const SYSTEM_PROMPT = `Você é um assistente de transcrição clínica especializado em análise de áudio de consultas médicas.

Sua tarefa é:
1. Transcrever fielmente o conteúdo clínico do áudio
2. Estruturar as informações no formato SOAP:
   - S (Subjetivo): Queixas do paciente, histórico e sintomas relatados
   - O (Objetivo): Sinais vitais e dados de exames físicos/laboratoriais
   - A (Avaliação): Diagnósticos prováveis ou impressões clínicas
   - P (Plano): Conduta, medicações, exames solicitados e retorno

INSTRUÇÕES CRÍTICAS:
- Ignore conversas não-clínicas
- Use terminologia médica apropriada
- Deixe seções em branco se não informadas
- Não alucinhe dados
- Seja preciso

Formate EXATAMENTE assim:
S (Subjetivo): [conteúdo aqui]
O (Objetivo): [conteúdo aqui]
A (Avaliação): [conteúdo aqui]
P (Plano): [conteúdo aqui]`;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioBlob = formData.get('audio') as Blob;

    if (!audioBlob) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    console.log('Audio blob size:', audioBlob.size);
    console.log('Audio blob type:', audioBlob.type);

    // Convert blob to base64
    const buffer = await audioBlob.arrayBuffer();
    const base64Audio = Buffer.from(buffer).toString('base64');

    console.log('Base64 size:', base64Audio.length);

    // Use Gemini API to process the audio
    const model = client.getGenerativeModel({ model: 'gemini-2.0-flash' });

    console.log('Sending to Gemini...');

    const response = await model.generateContent([
      SYSTEM_PROMPT,
      {
        inlineData: {
          mimeType: 'audio/wav',
          data: base64Audio,
        },
      },
    ]);

    const result = response.response.text();

    console.log('Gemini response:', result);

    return NextResponse.json({ soap: result });
  } catch (error) {
    console.error('Error processing audio:', error);
    return NextResponse.json(
      { error: 'Failed to process audio', details: (error as Error).message },
      { status: 500 }
    );
  }
}
