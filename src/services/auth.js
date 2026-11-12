import { supabase } from '../core/supabase.js';
import { config } from '../core/config.js';
import { AcessoRestritoError, ErroValidacao } from '../core/errors.js';
import { validarSenha } from '../utils/password.js';

let cacheAdmin;

export function limparCache() { cacheAdmin = undefined; }

/** Administrador ativo da sessão atual, ou null (sem sessão / não é administrador). */
export async function obterAdmin({ forcar = false } = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { cacheAdmin = undefined; return null; }
  if (!forcar && cacheAdmin?.id === session.user.id) return cacheAdmin;
  const { data, error } = await supabase.from('administradores')
    .select('id, nome, ativo').eq('id', session.user.id).maybeSingle();
  if (error) throw error;
  cacheAdmin = data?.ativo ? data : undefined;
  return cacheAdmin ?? null;
}

export async function entrar(email, senha) {
  const { error } = await supabase.auth.signInWithPassword({ email: String(email).trim(), password: senha });
  if (error) throw error;
  const admin = await obterAdmin({ forcar: true });
  if (!admin) { await sair(); throw new AcessoRestritoError(); }
  return admin;
}

export async function sair() {
  limparCache();
  const { error } = await supabase.auth.signOut();
  if (error) await supabase.auth.signOut({ scope: 'local' });  // garante o fim da sessão local mesmo offline
}

/** Resposta sempre genérica para não revelar se o e-mail existe. */
export async function solicitarRecuperacao(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(String(email).trim(), { redirectTo: config.appUrl });
  if (error && (error.status === 429 || /rate limit|network|fetch/i.test(error.message))) throw error;
}

export async function redefinirSenha(novaSenha) {
  const { valida, faltando } = validarSenha(novaSenha);
  if (!valida) throw new ErroValidacao(`A senha precisa ter: ${faltando.join(', ')}.`);
  const { error } = await supabase.auth.updateUser({ password: novaSenha });
  if (error) throw error;
  await sair();  // exige novo login com a senha nova
}

export const temSessao = async () => !!(await supabase.auth.getSession()).data.session;
