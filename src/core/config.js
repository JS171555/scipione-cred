const env = import.meta.env;

export const config = {
  supabaseUrl: (env.VITE_SUPABASE_URL ?? '').trim(),
  supabaseAnonKey: (env.VITE_SUPABASE_ANON_KEY ?? '').trim(),
  appUrl: (env.VITE_APP_URL ?? '').trim() || (typeof window !== 'undefined' ? window.location.origin : ''),
};

/** Detecta chave privilegiada (service_role / secret) — jamais pode ir para o navegador. */
export function chaveEhPrivilegiada(chave) {
  if (!chave) return false;
  if (chave.startsWith('sb_secret_')) return true;
  const partes = chave.split('.');
  if (partes.length !== 3) return false;
  try {
    const b64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')));
    return payload.role === 'service_role';
  } catch { return false; }
}

export function diagnosticoConfig(c = config) {
  if (!c.supabaseUrl || !c.supabaseAnonKey) {
    return { ok: false, motivo: 'pendente', mensagem: 'Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env (veja .env.example).' };
  }
  if (chaveEhPrivilegiada(c.supabaseAnonKey)) {
    return { ok: false, motivo: 'chave-privilegiada', mensagem: 'A chave configurada é privilegiada (service_role/secret). Use somente a chave pública (anon/publishable) no frontend.' };
  }
  return { ok: true };
}
