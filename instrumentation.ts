/**
 * Next.js Instrumentation — runs once when the server starts.
 * Forces UTC timezone on the Node.js process so that all Date operations
 * (including node-postgres serialization) are consistent regardless of
 * where the server runs (Vercel, local dev, Docker, etc.).
 */
export function register() {
  process.env.TZ = 'UTC';
}
