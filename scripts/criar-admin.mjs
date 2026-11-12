#!/usr/bin/env node
// Cria o administrador inicial (único). Roda SOMENTE na máquina de quem administra o projeto.
// A service_role key é lida do ambiente ou digitada (oculta) — nunca por argumento, nunca no frontend.
import readline from 'node:readline';
import { createClient } from '@supabase/supabase-js';
import { validarSenha } from '../src/utils/password.js';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
const perguntar = (texto, oculto = false) => new Promise((resolve) => {
  if (!oculto) return rl.question(texto, resolve);
  const original = rl._writeToOutput;
  process.stdout.write(texto);
  rl._writeToOutput = () => {};
  rl.question('', (v) => { rl._writeToOutput = original; process.stdout.write('\n'); resolve(v); });
});
const falhar = (m) => { console.error(`\n✖ ${m}`); rl.close(); process.exit(1); };

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || (await perguntar('URL do projeto Supabase: '))).trim();
const chave = (process.env.SUPABASE_SERVICE_ROLE_KEY || (await perguntar('Service role key (oculta): ', true))).trim();
if (!/^https:\/\/.+/.test(url)) falhar('URL inválida (use https://…).');
if (!chave) falhar('Service role key não informada.');

const admin = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });

const { count, error: eCount } = await admin.from('administradores').select('id', { count: 'exact', head: true }).eq('ativo', true);
if (eCount) falhar(`Não foi possível consultar administradores (migrations aplicadas? chave correta?): ${eCount.message}`);
if (count > 0) falhar('Já existe um administrador ativo. A v1 admite apenas um.');

const nome = (await perguntar('Nome do administrador: ')).trim();
const email = (await perguntar('E-mail do administrador: ')).trim().toLowerCase();
if (nome.length < 2) falhar('Nome inválido.');
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) falhar('E-mail inválido.');

const senha = await perguntar('Senha: ', true);
const { valida, faltando } = validarSenha(senha);
if (!valida) falhar(`Senha fraca. Necessário: ${faltando.join(', ')}.`);
if (senha !== (await perguntar('Repita a senha: ', true))) falhar('As senhas não coincidem.');

const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
if (error) falhar(`Falha ao criar o usuário de autenticação: ${error.message}`);

const { error: eIns } = await admin.from('administradores').insert({ id: data.user.id, nome, ativo: true });
if (eIns) {
  await admin.auth.admin.deleteUser(data.user.id);   // desfaz para não deixar usuário órfão
  falhar(`Falha ao registrar o administrador (usuário de autenticação removido): ${eIns.message}`);
}
console.log(`\n✔ Administrador criado: ${email}`);
rl.close();
