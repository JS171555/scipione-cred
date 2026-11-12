# Configuração do Supabase (Etapa 2)

Dependências externas: projeto Supabase criado pela Scipione Affare (URL e chaves). **Nada foi inventado.**

## 1. Projeto e chaves
1. Crie o projeto no Supabase. Em *Project Settings → API* copie **URL** e **anon/publishable key**.
2. `cp .env.example .env` e preencha `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (e `VITE_APP_URL` quando o domínio existir).
3. A **service_role key nunca entra no `.env` do frontend**. Ela só é usada no script do passo 4, digitada no terminal. O app recusa iniciar se detectar chave privilegiada.

## 2. Autenticação (painel → Authentication)
- Desative **Allow new users to sign up** (sem cadastro público) e *anonymous sign-ins*.
- Senha: mínimo 8 e exigir minúscula, maiúscula, números e símbolos (`password_requirements`).
- *Site URL* e *Redirect URLs*: o domínio final (D-09 pendente) e `http://localhost:5173` para desenvolvimento.
- Configure SMTP próprio para o e-mail de recuperação funcionar de forma confiável.
- Equivalente em arquivo: `supabase/config.toml` (`supabase config push`).

## 3. Migrations
Com o Supabase CLI: `supabase link --project-ref <ref>` e `supabase db push`.
Sem CLI: rode os 9 arquivos de `supabase/migrations/` em ordem no SQL Editor. Depois confira em *Storage* que os 3 buckets estão **privados**.

## 4. Administrador inicial
```
npm run admin:criar
```
Informe URL, service role key (oculta), nome, e-mail e senha forte. O script recusa se já houver administrador ativo e desfaz o usuário caso o registro falhe.

## 4.1 Verificação automática (somente leitura)
```
npm run verificar:supabase
```
Lê `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` do `.env` e confere: cadastro público desativado, tabelas existentes e **bloqueadas para `anon`**, RPCs financeiras inacessíveis sem login, buckets sem acesso público. Opcionalmente pede e-mail/senha do administrador e confere login, `administradores`, `configuracoes`, `vw_dashboard` e buckets privados. Não grava nada no banco.

## 5. Verificação rápida
- `npm run dev`, login com o administrador → tela "Sessão ativa".
- Usuário que não é administrador (criado à mão no painel) deve ser barrado no login.
- Sem sessão, qualquer rota interna redireciona para `#/login`.

## 6. Testes
- `npm test` — unitários e de tela (jsdom): senha, arquivos, CPF/CNPJ, dinheiro, regras financeiras, formulários e perfil.
- `npm run test:integracao` — serviços do frontend (`supabase-js`) contra PostgREST + PostgreSQL com as migrations reais (Storage simulado em memória). Requer o binário do PostgREST em `POSTGREST_BIN`.
- `npm run test:sql` — migrations + integridade financeira, RLS, auditoria e concorrência em PostgreSQL local (requer `psql`; `TEST_PG_RUN_AS=postgres` se precisar rodar como usuário postgres).
