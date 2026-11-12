#!/usr/bin/env node
// Verificação SOMENTE LEITURA do projeto Supabase real: migrations aplicadas, anon bloqueado, cadastro público
// desativado, buckets privados e (opcional) login do administrador + leituras protegidas por RLS.
// Uso: npm run verificar:supabase   (lê VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY do .env)
import fs from 'node:fs';
import readline from 'node:readline';

function lerEnv() {
  const env = { ...process.env };
  if (fs.existsSync('.env')) {
    for (const linha of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linha);
      if (m && !linha.trim().startsWith('#') && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return env;
}
const env = lerEnv();
const URL_BASE = (env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const CHAVE = env.VITE_SUPABASE_ANON_KEY || '';
if (!URL_BASE || !CHAVE) { console.error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env'); process.exit(2); }
if (CHAVE.startsWith('sb_secret_')) { console.error('Essa é uma chave SECRETA. Use apenas a publishable/anon.'); process.exit(2); }

const resultados = [];
const registrar = (ok, titulo, detalhe = '') => { resultados.push(ok); console.log(`${ok === true ? '✔' : ok === null ? '•' : '✖'} ${titulo}${detalhe ? ` — ${detalhe}` : ''}`); };

async function req(caminho, { metodo = 'GET', token = CHAVE, corpo } = {}) {
  try {
    const r = await fetch(`${URL_BASE}${caminho}`, {
      method: metodo, headers: { apikey: CHAVE, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: corpo ? JSON.stringify(corpo) : undefined, signal: AbortSignal.timeout(15000),
    });
    let json = null; try { json = await r.json(); } catch { /* corpo vazio */ }
    return { status: r.status, json };
  } catch (e) { return { erro: e.cause?.code || e.message }; }
}

console.log(`Projeto: ${URL_BASE}\n`);
const saude = await req('/auth/v1/settings');
if (saude.erro) { registrar(false, 'Alcançar o projeto Supabase', `sem resposta (${saude.erro}). Verifique URL/conexão.`); process.exit(1); }
registrar(saude.status === 200, 'Projeto Supabase acessível (chave aceita)', `HTTP ${saude.status}`);
if (saude.status === 200) {
  registrar(saude.json?.disable_signup === true, 'Cadastro público de usuários desativado', saude.json?.disable_signup === true ? '' : 'DESATIVE em Authentication → Sign In / Providers → "Allow new users to sign up"');
}

// Tabelas/views: com migrations + RLS, o anon deve receber "permission denied" (401/403, 42501).
const alvos = ['devedores', 'devedor_documentos', 'dividas', 'pagamentos', 'auditoria', 'administradores', 'configuracoes', 'vw_dividas_saldo', 'vw_devedores_resumo', 'vw_dashboard'];
let faltando = 0;
for (const t of alvos) {
  const r = await req(`/rest/v1/${t}?select=*&limit=1`);
  if (r.erro) { registrar(false, `anon × ${t}`, r.erro); continue; }
  const codigo = r.json?.code;
  if (r.status === 404 || codigo === 'PGRST205' || codigo === '42P01') { faltando += 1; registrar(false, `${t} existe`, 'NÃO encontrada — rode as migrations'); }
  else if ([401, 403].includes(r.status) && codigo === '42501') registrar(true, `anon bloqueado em ${t}`);
  else if (r.status === 200) registrar(false, `anon × ${t}`, `ANON CONSEGUIU LER (${Array.isArray(r.json) ? r.json.length : '?'} linhas) — revise grants/RLS`);
  else registrar(false, `anon × ${t}`, `HTTP ${r.status} ${codigo ?? ''} ${r.json?.message ?? ''}`);
}
if (faltando) console.log('\n→ Migrations ainda não aplicadas (veja docs/supabase-setup.md, passo 3).');

for (const fn of ['registrar_pagamento', 'estornar_pagamento', 'alterar_status_devedor']) {
  const r = await req(`/rest/v1/rpc/${fn}`, { metodo: 'POST', corpo: {} });
  if (r.erro) registrar(false, `anon × rpc ${fn}`, r.erro);
  else registrar([401, 403, 404].includes(r.status) && r.status !== 200, `anon não executa rpc ${fn}`, `HTTP ${r.status} ${r.json?.code ?? ''}`);
}

for (const b of ['fotos-devedores', 'documentos-devedores', 'comprovantes-pagamentos']) {
  const r = await req(`/storage/v1/object/public/${b}/teste.png`);
  if (r.erro) registrar(false, `bucket ${b}`, r.erro);
  else registrar(r.status !== 200 && !(r.json?.error === undefined && r.status === 200), `bucket ${b} sem acesso público`, `HTTP ${r.status} ${r.json?.message ?? ''}`);
}

// Login opcional (somente leitura).
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
const perguntar = (t, oculto = false) => new Promise((res) => {
  if (!oculto) return rl.question(t, res);
  const o = rl._writeToOutput; process.stdout.write(t); rl._writeToOutput = () => {};
  rl.question('', (v) => { rl._writeToOutput = o; process.stdout.write('\n'); res(v); });
});
const email = env.VERIFICAR_EMAIL || (process.stdin.isTTY ? (await perguntar('\nE-mail do administrador (Enter para pular o teste de login): ')).trim() : '');
if (email) {
  const senha = env.VERIFICAR_SENHA || (await perguntar('Senha (oculta): ', true));
  const login = await req('/auth/v1/token?grant_type=password', { metodo: 'POST', corpo: { email, password: senha } });
  const token = login.json?.access_token;
  registrar(Boolean(token), 'Login do administrador', token ? '' : (login.json?.msg || login.json?.error_description || `HTTP ${login.status}`));
  if (token) {
    const adm = await req('/rest/v1/administradores?select=id,nome,ativo', { token });
    registrar(Array.isArray(adm.json) && adm.json.length === 1 && adm.json[0].ativo === true, 'Administrador ativo cadastrado e visível', adm.json?.[0]?.nome ?? `HTTP ${adm.status}`);
    const cfg = await req('/rest/v1/configuracoes?select=chave,valor', { token });
    registrar(Array.isArray(cfg.json) && cfg.json.length === 3, 'Configurações de upload lidas pelo administrador', `${cfg.json?.length ?? 0} de 3`);
    const dash = await req('/rest/v1/vw_dashboard?select=*', { token });
    registrar(Array.isArray(dash.json) && dash.json.length === 1, 'Dashboard (view) acessível ao administrador', JSON.stringify(dash.json?.[0] ?? dash.json));
    const bk = await req('/storage/v1/bucket', { token });
    const nomes = Array.isArray(bk.json) ? bk.json.map((b) => `${b.id}${b.public ? ' (PÚBLICO!)' : ''}`) : [];
    registrar(nomes.length === 3 && !nomes.some((n) => n.includes('PÚBLICO')), 'Buckets existem e são privados', nomes.join(', ') || `HTTP ${bk.status}`);
    const alheio = await req('/auth/v1/user', { token });
    registrar(alheio.status === 200, 'Sessão válida', alheio.json?.email ?? '');
  }
}
rl.close();
const falhas = resultados.filter((r) => r === false).length;
console.log(`\n${falhas ? `✖ ${falhas} verificação(ões) com problema.` : '✔ Tudo certo.'}`);
process.exit(falhas ? 1 : 0);
