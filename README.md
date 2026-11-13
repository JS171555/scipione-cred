# Scipione Cred

Sistema interno de gestão de dívidas e relacionamento com devedores da Scipione Affare.

O Scipione Cred foi pensado para centralizar o controle de cadastro de devedores, registro de dívidas, pagamentos, acompanhamento financeiro e auditoria operacional em uma interface web segura e moderna.

A aplicação utiliza uma arquitetura baseada em frontend leve com Vite + JavaScript + Ionic, integrada ao Supabase para autenticação, banco de dados relacional, armazenamento e políticas de segurança.

## Visão geral

A solução foi desenvolvida para atender cenários de cobrança, controle financeiro e monitoramento de crédito, garantindo:

- cadastro e gestão de devedores PF/PJ;
- registro de dívidas com regras financeiras e histórico;
- acompanhamento de pagamentos, estornos e saldos em aberto;
- dashboard com indicadores operacionais;
- autenticação e acesso restrito para administradores;
- upload e gestão de documentos e fotos;
- auditoria e rastreabilidade de movimentações;
- integração com ViaCEP para preenchimento de endereço.

## Funcionalidades

### Autenticação e segurança
- Login com e-mail e senha;
- recuperação e redefinição de senha;
- redirecionamento de rotas para usuários não autenticados;
- controle de acesso por perfil administrativo;
- integração com Supabase Auth com políticas de segurança e RLS.

### Gestão de devedores
- cadastro de pessoa física e jurídica;
- edição e inativação de registros;
- validação de CPF/CNPJ;
- busca por nome, documento e telefone;
- suporte a endereço automático via ViaCEP.

### Gestão de dívidas e pagamentos
- criação e edição de dívidas associadas ao devedor;
- cálculo automático de saldo em aberto;
- registro de pagamentos parciais e totais;
- histórico de movimentações financeiras;
- processamento transacional para reduzir inconsistências;
- rastreabilidade de estornos e correções.

### Dashboard e monitoramento
- indicadores financeiros e operacionais;
- visão geral do volume em aberto;
- acompanhamento de registros ativos e pendentes;
- suporte para tomada de decisões com base em dados reais.

### Documentos e armazenamento
- upload de fotos e documentos;
- validação de tipos e tamanhos;
- armazenamento com políticas de privacidade;
- acesso controlado por URL temporária.

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
- GSAP e Lucide para experiência e interface

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
├─ README.md                 # documentação principal
├─ TODO.md                   # backlog e pendências
└─ plan.md                  # plano técnico
```

## Requisitos

- Node.js 20+
- npm
- Projeto Supabase configurado
- Variáveis de ambiente preenchidas

## Configuração

1. Instale as dependências:

```bash
npm install
```

2. Crie um arquivo de ambiente a partir do template:

```bash
cp .env.example .env
```

3. Preencha as variáveis com o URL e a chave pública do projeto Supabase:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_URL=
```

> Importante: nunca use chave de serviço no frontend. A aplicação foi projetada para operar com a chave anônima pública do Supabase e manter credenciais sensíveis fora do bundle.

4. Configure o banco e o administrador inicial, conforme a documentação do projeto:

```bash
npm run admin:criar
```

5. Inicie o ambiente de desenvolvimento:

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
npm run verificar:supabase # valida configuração do Supabase
```

## Documentação

A documentação técnica e funcional do projeto está localizada na pasta `docs/`.

Principais arquivos:

- `docs/arquitetura.md` — visão geral da arquitetura
- `docs/modelagem-do-banco.md` — estrutura do banco de dados
- `docs/regras-de-negocio.md` — regras de negócio e critérios de operação
- `docs/supabase-setup.md` — configuração do Supabase
- `docs/testes.md` — estratégia e cobertura de testes
- `docs/relatorio-redesign.md` — contexto de redesign e evolução da interface

## Segurança e conformidade

O projeto foi pensado com foco em segurança e integridade financeira:

- autenticação obrigatória;
- políticas de acesso definidas no banco;
- buckets privados para documentos;
- validação de CPF/CNPJ e valores financeiros;
- auditoria de operações relevantes;
- processamento mínimo de dados sensíveis no frontend;
- RLS e constraints no banco para reduzir riscos de inconsistência.

## Status do projeto

- Versão: 0.2.0
- Ambiente de produção: disponível em https://scipione-cred.vercel.app
- Estado: em desenvolvimento com base em arquitetura e regras de negócio definidas

## Licença

Nenhuma licença foi declarada no repositório até o momento.

## Contato e contribuição

Este projeto foi estruturado como solução interna para a Scipione Affare. Caso você queira evoluir o sistema, basta seguir a arquitetura existente, manter a documentação atualizada e validar alterações com os scripts de testes e integração.

---

Desenvolvido para gestão financeira, controle de crédito e acompanhamento operacional da Scipione Affare.
