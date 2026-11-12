# Scipione Cred — Arquitetura

> Etapa 1 · Planejamento técnico. Fonte de requisitos: PDF "Escopo Técnico e Funcional" v1.0 + Prompt Master.

## 1. Visão geral

Plataforma web **interna** da Scipione Affare para cadastro de devedores (PF/PJ), registro de dívidas e pagamentos, com saldo em aberto sempre derivado dos registros. Um único perfil (administrador), sem cadastro público.

Princípio: **funcionalidade antes de estética**. Etapas 1–4 usam UI simples e funcional; identidade visual noir só na etapa 5.

## 2. Requisitos

### 2.1 Funcionais
| ID | Requisito | Etapa |
|----|-----------|-------|
| RF-01 | Login e-mail/senha, logout seguro, recuperação de senha, sem cadastro público | 2 |
| RF-02 | CRUD de devedores PF/PJ, inativar/reativar, evitar duplicidade de CPF/CNPJ | 3 |
| RF-03 | Preenchimento de endereço via ViaCEP, editável | 3 |
| RF-04 | Upload/visualização de foto e documentos (storage privado) | 2/3 |
| RF-05 | Registrar, editar (campos permitidos) e consultar dívidas por devedor | 3 |
| RF-06 | Registrar pagamentos parciais/totais, comprovante opcional, saldo automático | 3 |
| RF-07 | Estorno/correção de pagamento com rastreabilidade (nunca apagar) | 3 |
| RF-08 | Dashboard com indicadores reais | 4 |
| RF-09 | Lista com foto, nome, CPF/CNPJ, contato, status, total em aberto | 4 |
| RF-10 | Pesquisa (nome, CPF, CNPJ, RG, telefone), filtros e ordenação | 4 |
| RF-11 | Perfil individual com resumo financeiro e histórico de movimentações | 4 |
| RF-12 | Auditoria das operações principais | 2/3 |
| RF-13 | PWA instalável | 5 |

### 2.2 Não funcionais
| ID | Requisito |
|----|-----------|
| RNF-01 | Segurança: Auth obrigatório, RLS em todas as tabelas, buckets privados, nenhuma chave privilegiada no frontend |
| RNF-02 | Integridade: constraints, FKs, transações e bloqueio de linha em pagamentos concorrentes |
| RNF-03 | LGPD: finalidade, necessidade, minimização, controle de acesso (políticas de retenção a definir pela Scipione Affare) |
| RNF-04 | Responsivo (desktop, notebook, tablet, celular) |
| RNF-05 | Manutenibilidade: módulos separados, regras centralizadas, migrations versionadas |
| RNF-06 | Desempenho: busca e totais calculados no banco (views/índices), paginação |
| RNF-07 | PWA sem cache de dados pessoais/financeiros |

## 3. Arquitetura geral

```
┌──────────────────────────┐        HTTPS         ┌───────────────────────────────┐
│ Navegador / PWA          │ ───────────────────► │ Supabase                      │
│ Vite 8 + JS ESM + Ionic  │   supabase-js (anon) │  • Auth (e-mail/senha)        │
│ GSAP · Lucide            │ ◄─────────────────── │  • PostgreSQL + RLS + RPC     │
└──────────┬───────────────┘                      │  • Storage (buckets privados) │
           │ fetch                                └───────────────────────────────┘
           ▼
      API ViaCEP (pública, somente CEP)
```

- **Frontend**: SPA em JavaScript ESM, componentes web do **Ionic Core** (sem framework Angular/React/Vue, coerente com o escopo), roteamento por hash (`#/devedores/:id`) para funcionar em hospedagem estática sem regras de rewrite.
- **Backend**: não há servidor próprio. A lógica sensível fica no **PostgreSQL** (constraints, triggers, funções RPC transacionais) protegida por RLS. O frontend usa **apenas a chave anon/publishable**.
- **Operações privilegiadas** (criar o administrador inicial, rodar migrations): scripts locais em `scripts/` usando a service role **fora do bundle**, lida só de variável de ambiente local; nunca com prefixo `VITE_`.
- **Edge Functions**: não necessárias na v1. Reavaliar se surgir operação que exija segredo no servidor.

### Fluxo de comunicação
1. UI chama `services/*` (única camada que fala com o Supabase).
2. Leituras: `select` em tabelas/views com RLS.
3. Escritas financeiras: RPC (`registrar_pagamento`, `estornar_pagamento`, `registrar_divida`) — uma transação, com `SELECT … FOR UPDATE` na dívida.
4. Arquivos: upload direto ao Storage com validação prévia (tipo/tamanho) + política no bucket; leitura por **signed URL** de curta duração.
5. Auditoria: triggers no banco (não depende do frontend).

## 4. Módulos

| Módulo | Responsabilidade |
|--------|------------------|
| `auth` | login, sessão, guarda de rota, recuperação de senha, logout |
| `devedores` | cadastro, edição, status, busca, ViaCEP |
| `documentos` | foto e documentos, validação, signed URLs |
| `dividas` | registro, edição permitida, status, saldo |
| `pagamentos` | registro, comprovante, estorno, histórico |
| `dashboard` | indicadores agregados |
| `auditoria` | consulta ao histórico de movimentações |
| `core` | cliente Supabase, config, router, erros, formatadores, validadores (CPF/CNPJ, moeda, senha) |

## 5. Estrutura de diretórios

```
scipione-cred/
├─ docs/                      arquitetura, regras, modelagem, decisões
├─ supabase/
│  ├─ config.toml             (signup desativado, política de senha)
│  └─ migrations/             SQL versionado (0001_…, 0002_…)
├─ scripts/                   criar-admin.mjs (service role, só local)
├─ public/                    manifest, ícones (etapa 5)
├─ src/
│  ├─ main.js
│  ├─ core/                   supabase.js, config.js, router.js, errors.js, state.js
│  ├─ utils/                  cpf-cnpj.js, money.js, dates.js, password.js, files.js
│  ├─ services/               auth, devedores, documentos, dividas, pagamentos, dashboard, viacep, auditoria
│  ├─ modules/                uma pasta por tela: login, dashboard, devedores, devedor-form, devedor-perfil, divida-form, pagamento-form
│  ├─ components/             tabela, modal de confirmação, toasts, uploader, campo de moeda
│  └─ styles/                 tokens.css (paleta), base.css (simples até a etapa 5)
├─ tests/                     unitários (utils) + SQL de integridade/RLS
├─ .env.example
├─ index.html
├─ package.json
└─ vite.config.js
```

## 6. Dependências

| Pacote | Versão verificada no registro | Uso |
|--------|------------------------------|-----|
| vite | 8.3.x | build/dev (Node ≥ 20 — ambiente: v22) |
| @ionic/core | 9.0.x | componentes web |
| @supabase/supabase-js | 2.x | Auth, DB, Storage |
| gsap | 3.x | animações (etapa 5) |
| lucide | 1.x | ícones |
| vite-plugin-pwa | 2.0 (peer inclui Vite 8) | PWA (etapa 5) |
| vitest | a confirmar na instalação | testes unitários |

Integração externa: **ViaCEP** (`https://viacep.com.br/ws/{cep}/json/`) — envia somente o CEP; falha tratada sem bloquear o cadastro manual.

## 7. Segurança (mapa)

| Risco | Controle |
|-------|----------|
| Acesso não autorizado | Auth obrigatório + `is_admin()` em toda política RLS |
| Cadastro público | `enable_signup = false` no Auth; só o script cria o admin |
| Vazamento de chave | só anon no bundle; `.env` fora do Git; service role apenas local |
| Documentos expostos | buckets privados, signed URL curta, política por admin |
| Arquivo malicioso | whitelist de extensão + MIME + tamanho (cliente e bucket) |
| Fraude/erro financeiro | RPC transacional, CHECKs, estorno rastreável, auditoria append-only |
| Cache indevido (PWA) | service worker sem cache de respostas da API/Storage |
| Senha fraca | política no Auth (≥ 8, maiúscula, minúscula, número, especial) + validação na UI |
| LGPD | minimização de campos, acesso restrito, retenção a definir (ver `decisoes.md`) |

## 8. Plano das etapas

| Etapa | Entrega |
|-------|---------|
| 1 | Esta documentação + estrutura planejada |
| 2 | Projeto Vite, migrations, Auth, RLS, Storage, auditoria |
| 3 | Devedores, dívidas, pagamentos, regras financeiras |
| 4 | Dashboard, lista/busca/filtros, perfil, testes |
| 5 | UI noir, responsividade, PWA, publicação |
