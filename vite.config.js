import { defineConfig, loadEnv } from 'vite';

// CSP aplicada só no build (o dev server do Vite precisa de scripts inline para HMR).
function cspPlugin(env) {
  let origem = '';
  try { origem = new URL(env.VITE_SUPABASE_URL).origin; } catch { /* sem URL: CSP restritiva */ }
  const ws = origem.replace(/^http/, 'ws');
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    `img-src 'self' data: blob: ${origem}`.trim(),
    `connect-src 'self' ${origem} ${ws} https://viacep.com.br`.replace(/\s+/g, ' ').trim(),
    // frame-ancestors exige cabeçalho HTTP; veja public/_headers e docs/hospedagem.md.
    "object-src 'none'", "base-uri 'self'", "form-action 'self'",
  ].join('; ');
  return {
    name: 'scipione-csp', apply: 'build',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp }, injectTo: 'head-prepend' }],
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return { plugins: [cspPlugin(env)], build: { target: 'es2022', sourcemap: false } };
});
