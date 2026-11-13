# Scipione Cred

Sistema interno de gestão de dívidas e relacionamento com devedores da Scipione Affare.

O Scipione Cred foi pensado para centralizar o cadastro de devedores, registro de dívidas, pagamentos, acompanhamento financeiro, auditoria operacional e gestão documental em uma interface web segura, responsiva e orientada a processos internos.

A solução combina frontend leve em Vite + JavaScript + Ionic com Supabase para autenticação, banco relacional, armazenamento de arquivos, políticas de acesso e regras de negócio em nível de banco.

## Visão geral

O sistema foi desenvolvido para facilitar o controle de cobrança, acompanhamento financeiro e monitoramento de crédito com foco em segurança, rastreabilidade e operação eficiente. Entre os principais objetivos estão:

- cadastro e gestão de devedores PF e PJ;
- registro de dívidas, pagamentos, estornos e saldos em aberto;
- acompanhamento financeiro por indicadores operacionais;
- controle de acesso por perfil administrativo;
- upload e gerenciamento de documentos e fotos;
- auditoria e rastreabilidade de movimentações;
- preenchimento automático de endereço via ViaCEP.

## Funcionalidades

### Autenticação e segurança

- login com e-mail e senha;
- recuperação e redefinição de senha;
- redirecionamento para rotas protegidas;
- controle de acesso por perfil administrativo;
- autenticação integrada ao Supabase Auth;
- proteção de dados com RLS e políticas do banco.

### Gestão de devedores

- cadastro de pessoa física e jurídica;
- edição e inativação de registros;
- validação de CPF/CNPJ;
- busca por nome, documento e telefone;
- suporte a preenchimento automático de endereço.

### Gestão de dívidas e pagamentos

- criação e edição de dívidas associadas ao devedor;
- cálculo automático de saldo em aberto;
- registro de pagamentos parciais e totais;
- histórico completo de movimentações financeiras;
- rastreabilidade de estornos e correções;
- consistência transacional para reduzir inconsistências.

### Dashboard e monitoramento

- indicadores financeiros e operacionais;
- visão geral do volume em aberto;
- acompanhamento de registros ativos e pendentes;
- suporte à tomada de decisão com base em dados reais.

### Documentos e armazenamento

- upload de fotos e documentos;
- validação de tipos e tamanhos;
- armazenamento seguro com políticas de privacidade;
- acesso restrito com URL temporária.

## Stack tecnológica

- Vite
- JavaScript ES Modules
- Ionic Core
- Supabase
  - Auth
  - PostgreSQL
  - Storage
  - Row Level Security (RLS)
- ViaCEP
- Vitest
- GSAP e Lucide
- PDF-lib

## Estrutura do projeto

```text
scipione-cred/
├─ docs/                     # documentação técnica e de negócio
├─ public/                   # assets públicos e manifest
├─ scripts/                  # scripts utilitários do projeto
├─ src/
│  ├─ components/            # componentes reutilizáveis
│  ├─ core/                  # configuração, rotas e utilidades centrais
│  ├─ domain/                # regras de domínio
│  ├─ modules/               # telas e fluxos da aplicação
│  ├─ services/              # integração com Supabase e serviços externos
│  ├─ styles/                # estilos globais
│  ├─ utils/                 # validadores e helpers
│  └─ main.js                # bootstrap da aplicação
├─ supabase/                 # migrations e configuração do banco
├─ tests/                    # testes unitários e de integração
├─ .env.example              # template das variáveis de ambiente
├─ index.html                # entrada da aplicação web
├─ package.json              # dependências e scripts
├─ vite.config.js            # configuração do Vite
├─ vitest.config.js          # configuração de testes
├─ vitest.integration.config.js
├─ README.md                 # documentação principal
├─ TODO.md                   # backlog e pendências
├─ plan.md                   # plano técnico
└─ .gitignore
```

## Requisitos

- Node.js 20+
- npm
- projeto Supabase configurado
- variáveis de ambiente preenchidas

## Configuração

1. Clone o repositório e acesse a pasta:

```bash
git clone https://github.com/JS171555/scipione-cred.git
cd scipione-cred
```

2. Instale as dependências:

```bash
npm install
```

3. Crie o arquivo de ambiente a partir do template:

```bash
cp .env.example .env
```

4. Preencha as variáveis com a URL e a chave pública do projeto Supabase:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_URL=
```

> Importante: nunca utilize service role ou chaves sensíveis no frontend. A aplicação foi projetada para operar com a chave anônima pública do Supabase, mantendo segredos fora do bundle.

5. Configure o banco e o administrador inicial, conforme a documentação do projeto:

```bash
npm run admin:criar
```

6. Inicie o ambiente de desenvolvimento:

```bash
npm run dev
```

## Scripts disponíveis

```bash
npm run dev                # inicia o ambiente de desenvolvimento
npm run build              # gera build de produção
npm run preview            # pré-visualiza o build
npm run test               # executa testes unitários
npm run test:sql           # valida integrações e regras SQL
npm run test:integracao    # executa testes de integração
npm run admin:criar        # cria o administrador inicial
npm run verificar:supabase # valida a configuração do Supabase
```

## Documentação

A documentação técnica e funcional do projeto está localizada na pasta `docs/`.

Principais arquivos:

- `docs/arquitetura.md` — visão geral da arquitetura
- `docs/modelagem-do-banco.md` — estrutura do banco e regras de relacionamento
- `docs/regras-de-negocio.md` — regras de negócio e critérios de operação
- `docs/supabase-setup.md` — configuração do Supabase
- `docs/testes.md` — estratégia e cobertura de testes
- `docs/relatorio-redesign.md` — contexto de redesign e evolução da interface

## Segurança e conformidade

O projeto foi pensado com foco em segurança, integridade financeira e rastreabilidade de operações:

- autenticação obrigatória;
- políticas de acesso definidas no banco;
- buckets privados para documentos;
- validação de CPF/CNPJ e valores financeiros;
- auditoria de operações relevantes;
- processamento mínimo de dados sensíveis no frontend;
- RLS e constraints no banco para reduzir riscos de inconsistência.

## Status do projeto

- Versão: 0.2.0
- Ambiente de produção: https://scipione-cred.vercel.app
- Estado: em desenvolvimento, com arquitetura e regras de negócio definidas e em evolução

## Licença

Nenhuma licença foi declarada no repositório até o momento.

## Contato e contribuição

Este projeto foi estruturado como solução interna para a Scipione Affare. Caso queira evoluir o sistema, mantenha a arquitetura existente, atualize a documentação e valide os fluxos de negócio antes de publicar alterações.

---

Desenvolvido para gestão financeira, controle de crédito e acompanhamento operacional da Scipione Affare.
