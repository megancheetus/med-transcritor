import type { NextConfig } from "next";

const jaasDomains = [
  'https://8x8.vc',
  'https://*.8x8.vc',
  'wss://8x8.vc',
  'wss://*.8x8.vc',
];

const meetDomains = [
  'https://meet.jit.si',
  'https://*.jit.si',
  'wss://meet.jit.si',
  'wss://*.jit.si',
];

const recaptchaDomains = [
  'https://www.google.com',
  'https://www.gstatic.com',
  'https://recaptcha.google.com',
];

const scriptSources = [
  "'self'",
  "'unsafe-inline'",
  'https://meet.jit.si',
  'https://*.jit.si',
  'https://8x8.vc',
  'https://*.8x8.vc',
  ...recaptchaDomains,
];
const frameSources = [
  "'self'",
  'https://meet.jit.si',
  'https://*.jit.si',
  'https://8x8.vc',
  'https://*.8x8.vc',
  ...recaptchaDomains,
];
const connectSources = [
  "'self'",
  'https://generativelanguage.googleapis.com',
  'https://*.supabase.co',
  'https://vercel.com',
  'https://*.vercel-storage.com',
  'https://edvaldojeronimo.com.br',
  'https://www.edvaldojeronimo.com.br',
  ...recaptchaDomains,
  ...meetDomains,
  ...jaasDomains,
];

const contentSecurityPolicy = process.env.NODE_ENV === 'production'
  ? // PRODUÇÃO: Next.js/Tailwind precisam de unsafe-inline para hidrataçã e estilos
    [
      "default-src 'self'",
      `script-src ${scriptSources.join(' ')}`,
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob: https: ${recaptchaDomains.join(' ')}`,
      "font-src 'self' data:",
      `connect-src ${connectSources.join(' ')}`,
      `frame-src ${frameSources.join(' ')}`,
      "media-src 'self' blob: data:",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join('; ')
  : // DESENVOLVIMENTO: Relaxado para permitir logs/debug
    [
      "default-src 'self'",
      `script-src ${[...scriptSources, "'unsafe-eval'"].join(' ')}`,
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob: https: ${recaptchaDomains.join(' ')}`,
      "font-src 'self' data:",
      `connect-src ${[...connectSources, 'localhost:*'].join(' ')}`,
      `frame-src ${frameSources.join(' ')}`,
      "media-src 'self' blob: data:",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: contentSecurityPolicy,
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Permitted-Cross-Domain-Policies',
            value: 'none',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=*, microphone=*, geolocation=(), payment=(), usb=()',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
      {
        source: '/login',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate, private',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
          {
            key: 'Surrogate-Control',
            value: 'no-store',
          },
        ],
      },
      {
        source: '/dashboard/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate, private',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
          {
            key: 'Surrogate-Control',
            value: 'no-store',
          },
        ],
      },
      {
        source: '/transcricao/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate, private',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
          {
            key: 'Surrogate-Control',
            value: 'no-store',
          },
        ],
      },
      {
        source: '/historico/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate, private',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
          {
            key: 'Surrogate-Control',
            value: 'no-store',
          },
        ],
      },
      {
        source: '/perfil/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate, private',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
          {
            key: 'Surrogate-Control',
            value: 'no-store',
          },
        ],
      },
      {
        source: '/admin/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate, private',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
          {
            key: 'Surrogate-Control',
            value: 'no-store',
          },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate, private',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
          {
            key: 'Surrogate-Control',
            value: 'no-store',
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/posts.json',
        destination: 'https://www.edvaldojeronimo.com.br/api/posts.json',
      },
    ];
  },
};

export default nextConfig;
