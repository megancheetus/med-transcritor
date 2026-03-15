# Análise: Configuração Atual vs. Produção em Escala

## ❌ Problemas Atuais para Produção

### 1. **Pool de Conexões (Supabase)**
**Configuração Atual:**
```typescript
max: 10,                       // Max 10 conexões simultâneas
connectionTimeoutMillis: 10000 // 10 segundos timeout
```

**Problema:**
- Supabase com PgBouncer tem limite global (~20 conexões por projeto)
- Com 10 instâncias do Node.js, você fica sem conexões rápido
- 10 segundos timeout é muito curto para Supabase Transaction Pooler

**Cenário Real:**
```
10 instâncias Node × 10 conexões = 100 conexões solicitadas
Supabase oferece: ~20 conexões
Resultado: DEADLOCK, timeouts, login falhando
```

---

### 2. **Sem Retry Logic**
**Problema:**
- Se uma query falhar (network blip, timeout), retorna erro imediatamente
- Sem possibilidade de retry automático

**Impacto:**
- 1 erro de rede = login falha
- Em escala, centenas de usuários afetados simultaneamente

---

### 3. **Cache Global de Pool**
**Código Atual:**
```typescript
if (!global.omninotePostgresPool) {
  global.omninotePostgresPool = pool;
}
```

**Problema:**
- Se pool fecha por erro, precisa de restart completo
- Sem recuperação automática elegante em Serverless

---

### 4. **CSP Relaxado em Development** ⚠️
**Atual:**
```typescript
process.env.NODE_ENV === 'development'
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"  // PERIGOSO EM PRODUÇÃO
```

**Risco:**
- Se `.env.local` for deixado como `NODE_ENV=development` em prod = XSS vulnerável!

---

### 5. **Sem Rate Limiting**
**Problema:**
- Sem proteção contra brute force no login
- Sem proteção contra DDoS na API

---

### 6. **Sem Logging/Monitoring**
**Problema:**
- Erros de autenticação desaparecem
- Sem visibilidade de falhas em produção
- Impossível debugar issues em tempo real

---

### 7. **Sem Caching**
**Problema:**
- Cada requisição de usuário vai pro banco
- Sem cache de sessões/tokens
- Database vai sobrecarregar rápido

---

## ✅ O Que Precisa Mudar para Produção

### 1. **Pool Inteligente para Supabase**

```typescript
// Para 100+ usuários simultâneos
const pool = new Pool({
  max: 3,               // REDUZIDO: Supabase tem limite! 
  min: 1,
  idleTimeoutMillis: 60000,        // Mais tolerante
  connectionTimeoutMillis: 30000,  // 30 segundos
  statement_timeout: 45000,
  query_timeout: 45000,
  max_pool_size: 3,  // Configuração do PgBouncer
});

// Retry logic exponencial
async function queryWithRetry(query, params, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await pool.query(query, params);
    } catch (error) {
      const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      if (attempt < maxRetries - 1) {
        await sleep(delay);
      } else {
        throw error;
      }
    }
  }
}
```

### 2. **Cache de Sessões**

```typescript
// Redis para cache de sessões (RECOMENDADO)
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

// Cache do usuário por 5 minutos
async function getUserFromCache(username: string) {
  const cached = await redis.get(`user:${username}`);
  if (cached) {
    return JSON.parse(cached);
  }
  
  const user = await db.query('SELECT * FROM app_users WHERE username = $1', [username]);
  await redis.setex(`user:${username}`, 300, JSON.stringify(user)); // 5 min TTL
  return user;
}
```

### 3. **Rate Limiting (Proteção contra Brute Force)**

```typescript
import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5,                     // Max 5 tentativas
  message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV !== 'production', // Disable em dev
  keyGenerator: (req) => req.ip, // Rate limit por IP
});

// Usar em /api/auth/login:
// app.post('/api/auth/login', loginLimiter, authHandler);
```

### 4. **CSP Rigoroso em Produção**

```typescript
const contentSecurityPolicy = 
  process.env.NODE_ENV === 'production'
    ? [
        "default-src 'self'",
        "script-src 'self'",  // NENHUM unsafe-*
        "style-src 'self'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "connect-src 'self' https://generativelanguage.googleapis.com https://*.supabase.co",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "upgrade-insecure-requests",
      ].join('; ')
    : [...relaxed];
```

### 5. **Logging Estruturado**

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({
      filename: 'logs/auth.log',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),
  ],
});

// Em /api/auth/login:
logger.info('Login attempt', { username, ip: req.ip });
logger.error('Login failed', { username, reason, ip: req.ip });
logger.warn('Brute force detected', { ip: req.ip });
```

### 6. **Health Check & Graceful Shutdown**

```typescript
// GET /api/health
export async function GET() {
  try {
    await pool.query('SELECT 1'); // Testa conexão
    return NextResponse.json({ 
      status: 'healthy', 
      database: 'connected' 
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'unhealthy', error: error.message },
      { status: 503 }
    );
  }
}

// Graceful shutdown em produção
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await pool.end();
  process.exit(0);
});
```

---

## 📊 Comparação: Dev vs. Produção

| Aspecto | Dev Atual | Produção Necessária |
|---------|-----------|-------------------|
| Pool Max | 10 | 3-5 |
| Retry Logic | ❌ | ✅ Exponencial |
| Cache | ❌ | ✅ Redis |
| Rate Limit | ❌ | ✅ 5 tentativas/15min |
| CSP | Relaxado | Rigoroso |
| Logging | Console | Winston/Datadog |
| Health Check | ❌ | ✅ Periodic |
| Monitoramento | ❌ | ✅ APM (New Relic, DataDog) |
| Timeout | 10s | 30-45s |
| Usuários Simultâneos | ~10 | 1000+ |

---

## 🚀 Arquitetura Recomendada para Escala

```
                     ┌─────────────┐
                     │   Load      │
                     │  Balancer   │
                     └──────┬──────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
        ┌───▼───┐       ┌───▼───┐       ┌──▼────┐
        │Node 1  │       │Node 2  │       │Node 3  │
        │ Pool:3 │       │ Pool:3 │       │ Pool:3 │
        └──┬────┘       └──┬────┘       └──┬─────┘
           │               │               │
           └───────────────┼───────────────┘
                    ┌──────▼──────┐
                    │   PgBouncer │ (Connection Pooler)
                    │  (pooler)   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────────┐
                    │  Supabase       │
                    │  PostgreSQL     │
                    └─────────────────┘

                    ┌─────────────┐
                    │  Redis      │
                    │  (Cache)    │
                    └─────────────┘
```

---

## 📋 Checklist para Produção

- [ ] Pool com retry logic exponencial
- [ ] Redis para cache de sessões
- [ ] Rate limiting no login
- [ ] CSP rigoroso (sem unsafe-*)
- [ ] Logging estruturado (Winston/Datadog)
- [ ] Health checks em todas as APIs críticas
- [ ] Monitoring & Alertas (APM)
- [ ] Graceful shutdown
- [ ] HTTPS obrigatório
- [ ] Secrets em variáveis de ambiente (não hardcoded)
- [ ] SSL/TLS certificados válidos
- [ ] Backups automáticos do PostgreSQL
- [ ] Testes de carga (k6, Artillery)
- [ ] Documentação de runbooks

---

## ⏱️ Timeline para Produção

**Imediato (1-2 semanas):**
- Rate limiting
- CSP rigoroso
- Logging básico
- Health checks

**Curto prazo (2-4 semanas):**
- Redis para cache
- Retry logic
- Monitoring básico

**Médio prazo (1-2 meses):**
- APM (New Relic/DataDog)
- Testes de carga
- Otimizações de BD

---

**Conclusão:** A configuração atual serve para desenvolvimento, mas é INSUFICIENTE para produção com 100+ usuários. Precisa de melhorias significativas em resilência, cache, segurança e observabilidade.
