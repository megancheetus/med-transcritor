/**
 * WebSocket Handler para Sinalizacao WebRTC
 * POST upgrade para WebSocket
 */

export async function POST(request: Request) {
  // Verificar se o cliente quer fazer upgrade para WebSocket
  const upgradeHeader = request.headers.get('upgrade');
  
  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return new Response('Expected Upgrade: websocket', { status: 400 });
  }

  // Node.js não tem suporte nativo a WebSocket em routes de API
  // Em produção, use um serviço como Socket.IO ou rode um servidor separado
  return new Response(
    JSON.stringify({
      error: 'WebSocket não suportado em modo desenvolvimento. Use apenas sinalização HTTP.',
    }),
    { status: 501 }
  );
}
