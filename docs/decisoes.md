# Scipione Cred — Registro de decisões

Status: **Definida** (documento/prompt) · **Adotada** (solução conservadora, ajustável) · **Pendente** (depende da Scipione Affare).

## Perguntas da seção 16 do PDF

| # | Pergunta | Status | Decisão |
|---|----------|--------|---------|
| D-01 | Atende PF e PJ? | Definida | Sim |
| D-02 | CPF/CNPJ obrigatório? | **Pendente** | Opcional por ora; validado e único quando informado. Para tornar obrigatório: `NOT NULL` + ajuste na UI (1 migration) |
| D-03 | Vencimento opcional? | Definida | Sim |
| D-04 | Pagamento parcial? | Definida | Sim |
| D-05 | Comprovante obrigatório? | Definida | Opcional |
| D-06 | Limite de tamanho dos arquivos | **Pendente** | Padrão provisório 5 MB (foto) / 10 MB (documento e comprovante), em `configuracoes` |
| D-07 | Inativar com dívida aberta? | Definida | Permitido com aviso e confirmação; histórico preservado |
| D-08 | Só um administrador? | Definida | Sim |
| D-09 | Domínio e hospedagem | **Pendente** | Nada assumido. Build estático Vite, compatível com qualquer hospedagem estática; URLs de redirecionamento do Auth dependem do domínio |

## Decisões técnicas adotadas

| # | Decisão | Motivo / como ajustar |
|---|---------|----------------------|
| D-10 | Saldo e status calculados no banco (view + trigger), não no frontend | Fonte única de verdade; evita inconsistência |
| D-11 | Sem exclusão de dívida/devedor/pagamento; correção por edição auditada ou estorno. Exceção aprovada em 13/11/2026: dívida sem nenhum pagamento pode ser apagada (RN-36.1) | Preserva o histórico financeiro: nada que tenha recebido dinheiro é apagado. A exclusão da dívida sem pagamentos usa RPC `excluir_divida` (security definer), grava `DELETE` na auditoria e é o único caminho de DELETE do sistema |
| D-12 | Devedor inativo não recebe nova dívida; pagamentos seguem permitidos | Spec omissa; regra mais segura. Ajustável em uma RPC |
| D-13 | Data de pagamento/registro não pode ser futura; pagamento não anterior ao registro da dívida | Evita erros de digitação |
| D-14 | Pagamento > saldo é bloqueado (sem "crédito" ou troco) | Exigência do prompt |
| D-15 | Idempotência por `chave_idempotencia` | Duplo clique/reenvio |
| D-16 | Roteamento por hash e SPA estática | Independe do domínio/hospedagem (D-09) |
| D-17 | Ionic Core (web components) sem framework de UI | Escopo prevê "JavaScript ESM" puro |
| D-18 | Sem Edge Functions na v1; admin criado por script local com service role | Menos superfície de ataque |
| D-19 | Recuperação de senha pelo fluxo nativo do Supabase Auth (e-mail com link) | Requer SMTP/e-mail configurado e URL de redirecionamento (depende de D-09) |
| D-20 | Valor em aberto do dashboard inclui devedores inativos | Reflete a realidade financeira |
| D-21 | Comprovantes aceitam os mesmos formatos dos documentos | Escopo não especifica |
| D-22 | Documentos removidos: soft delete + auditoria | Rastreabilidade |
| D-23 | PWA sem cache de dados/arquivos sensíveis | Segurança e LGPD |
| D-24 | Chaves: apenas anon/publishable no frontend | Segurança |

## Pendências para a Scipione Affare

1. Obrigatoriedade de CPF/CNPJ (D-02).
2. Limites de tamanho de arquivo (D-06).
3. Domínio e hospedagem (D-09) — necessários para Auth redirect e publicação.
4. **Projeto Supabase**: URL, anon key e acesso ao painel (nada será inventado; a integração será preparada via `.env.example`).
5. E-mail e nome do administrador inicial; serviço de e-mail (SMTP) para recuperação de senha.
6. Políticas de privacidade, **retenção** e tratamento de dados (LGPD).
7. Política de backup conforme o plano contratado do Supabase.
8. Necessidade de "cancelar dívida" (D-11) — em aberto: hoje existe apenas a exclusão de dívida sem pagamentos (RN-36.1).

## Decisões da Etapa 2

| # | Decisão | Motivo / como ajustar |
|---|---------|----------------------|
| D-25 | Máximo de **um administrador ativo**, imposto por índice único parcial | Escopo v1. Para liberar mais, remover `administradores_um_ativo_idx` |
| D-26 | Datas "de hoje" usam o fuso `America/Sao_Paulo` (função `hoje()`) | Servidor roda em UTC; evita "data futura" falsa à noite |
| D-27 | Exclusão física bloqueada por trigger em devedores, dívidas, pagamentos e documentos (inclusive para o dono) | Preservar histórico financeiro |
| D-28 | Auditoria guarda a linha completa (antes/depois), inclusive CPF/CNPJ | Rastreabilidade; acesso restrito ao administrador |
| D-29 | Alteração de valor da dívida prevalece sobre o rótulo `STATUS` na auditoria | Não esconder mudança de valor atrás de quitação/reabertura |
| D-30 | Recuperação de senha com PKCE (`?code=`) e resposta genérica (não revela se o e-mail existe); o link deve ser aberto no mesmo navegador | Compatível com roteador por hash |
| D-31 | Sessão persistida pelo `supabase-js` (armazenamento do navegador) com refresh automático | Padrão do SDK; sem dado financeiro no cache |
| D-32 | Validação de arquivo também por assinatura binária (magic bytes), além de extensão/MIME/tamanho | Impede arquivo falsificado |
| D-33 | CSP restritiva injetada no build, usando a origem do Supabase do `.env` | Reduz risco de XSS |
| D-34 | Testes de banco rodam em PostgreSQL 16 com stub mínimo do Supabase (`auth`, `storage`, papéis) | Validação real de RLS/triggers sem projeto Supabase; deve ser repetida no projeto real |

## Decisões da Etapa 3

| # | Decisão | Motivo / como ajustar |
|---|---------|----------------------|
| D-35 | Dinheiro no frontend sempre em **centavos inteiros**; ao banco vai string decimal (`"1500.25"`) | Sem erro de ponto flutuante (testado: 0,10 + 0,20) |
| D-36 | Regras financeiras de UX em `src/domain/financeiro.js` espelham o banco; o **banco é a palavra final** | Mensagens rápidas sem abrir mão da integridade |
| D-37 | Comprovante/documento enviado e o banco recusar o registro → arquivo fica órfão no Storage | Buckets não permitem apagar (preserva provas). Limpeza periódica pode ser feita pelo administrador do projeto |
| D-38 | Chave de idempotência do pagamento gerada **uma vez por abertura do formulário** | Duplo clique/reenvio não duplica |
| D-39 | Busca usa a coluna `busca` (sem acento, minúscula; dígitos para CPF/CNPJ/telefone); `%` e `_` digitados são literais | Evita curingas acidentais |
| D-40 | ViaCEP: falha/CEP inexistente só avisa; cadastro manual segue possível | Serviço externo não pode bloquear o cadastro |
| D-41 | Na criação, foto e documentos são enviados após o devedor ser salvo; falha de anexo não desfaz o cadastro (aviso no perfil) | Não perder o cadastro por um arquivo ruim |
| D-42 | Telas da Etapa 3 são estruturais (sem identidade visual); lista tem só busca simples — filtros, ordenação, paginação, dashboard e histórico de movimentações (auditoria) ficam na Etapa 4 | Ordem de prioridade do projeto |

## Decisões da Etapa 4

| # | Decisão | Motivo / como ajustar |
|---|---------|----------------------|
| D-43 | Filtro **"Com dívidas em aberto"** = devedor com ≥ 1 dívida em aberto. Filtro **"Dívidas quitadas"** = devedor sem nenhuma dívida em aberto e com ≥ 1 quitada | O escopo não define; evita misturar devedores ainda devendo |
| D-44 | "Cadastros mais antigos/recentes" e "ordenação por nome/data" viram um único seletor **Ordenar por** (nome A–Z/Z–A, mais recentes/antigos) | Mesmas opções do escopo, sem controles redundantes |
| D-45 | Busca, filtros, ordenação e página ficam na URL (`#/devedores?q=…&status=…&situacao=…&ordem=…&p=…`) e são validados (valor inválido volta ao padrão) | Voltar/atualizar preserva o estado; links compartilháveis entre abas |
| D-46 | Paginação no banco (20 por página, contagem exata); página inexistente recua para a última válida | Desempenho e robustez quando um filtro reduz o total |
| D-47 | Dashboard: "Registros recentes" = últimas 10 movimentações da auditoria de toda a operação; "Últimos cadastros" = 5 mais recentes | Atende "visualizar registros recentes" com dados reais |
| D-48 | Histórico do perfil descreve as movimentações em linguagem natural, **sem repetir dados pessoais** (edição lista só os nomes dos campos alterados) | LGPD: minimização |
| D-49 | Histórico carrega 10 por vez ("Ver movimentações anteriores") | Perfil rápido mesmo com muito histórico |
| D-50 | Miniaturas da lista usam URLs assinadas em lote (5 min), carregadas após a tabela; falha só deixa as iniciais | A lista nunca depende do Storage para aparecer |
| D-51 | Todo upload passa por `utils/midia.js`: imagem é recodificada em WebP (maior lado 1600 px na foto, 2200 px em documento/comprovante, qualidade 0,82–0,85) e PDF é reescrito com object streams, só quando economiza mais de 3%. O original é mantido quando o navegador não codifica WebP, quando o resultado não é menor ou quando o PDF é assinado digitalmente | Economia média de 90% nas fotos sem perda visível; o EXIF (inclusive GPS) sai na recodificação. PDF digitalizado é quase todo JPEG e não ganha espaço, então não vale reescrever |
| D-52 | O cartão de filtros nasce recolhido em qualquer largura e abre pelo botão **Filtros**, ao lado da ação principal da lista (mesma altura e mesma linha da busca). Filtro ativo acende um ponto dourado no botão | Em desktop o formulário de filtros ocupava uma faixa fixa no topo; recolhido, a lista aparece antes e o estado ativo continua visível |
