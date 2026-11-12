# Scipione Cred — Modelagem do banco (PostgreSQL / Supabase)

Convenções: tabelas em português, `snake_case`, PK `uuid` (`gen_random_uuid()`), `created_at`/`updated_at` em `timestamptz`, dinheiro em `numeric(14,2)`. Toda tabela com RLS ligado.

## Diagrama

```
auth.users 1─1 administradores
devedores 1─N dividas 1─N pagamentos
devedores 1─N devedor_documentos
auditoria  (referencia entidades por id, sem FK rígida para sobreviver a qualquer mudança)
configuracoes (chave/valor)
```

## Tabelas

### administradores
| Campo | Tipo | Regra |
|-------|------|-------|
| id | uuid PK | FK `auth.users(id)` ON DELETE RESTRICT |
| nome | text NOT NULL | |
| ativo | boolean NOT NULL DEFAULT true | |
| created_at | timestamptz | default now() |

Função `is_admin()` (`SECURITY DEFINER`, `search_path` fixo): `exists(select 1 from administradores where id = auth.uid() and ativo)`.

### devedores
| Campo | Tipo | Regra |
|-------|------|-------|
| id | uuid PK | |
| tipo_pessoa | text NOT NULL | CHECK in ('PF','PJ') |
| nome_razao_social | text NOT NULL | CHECK length > 1 |
| cpf_cnpj | text NULL | só dígitos; CHECK 11 dígitos se PF / 14 se PJ; validação de DV por função `valida_cpf_cnpj()` |
| rg | text NULL | |
| telefone, celular | text NULL | só dígitos |
| email | text NULL | CHECK formato |
| cep | text NULL | 8 dígitos |
| logradouro, numero, complemento, bairro, cidade | text NULL | |
| uf | char(2) NULL | CHECK lista de UFs |
| observacoes | text NULL | |
| status | text NOT NULL DEFAULT 'ativo' | CHECK in ('ativo','inativo') |
| foto_path | text NULL | caminho no bucket `fotos-devedores` |
| busca | text GENERATED | nome + cpf_cnpj + rg + telefones (normalizado, `unaccent`) para pesquisa |
| created_at, updated_at | timestamptz | trigger `set_updated_at` |
| created_by | uuid | FK administradores |

Índices: **UNIQUE parcial** `(cpf_cnpj) WHERE cpf_cnpj IS NOT NULL`; `(status)`; `(created_at)`; `(lower(nome_razao_social))`; GIN trigram em `busca` (`pg_trgm`).

### devedor_documentos
| Campo | Tipo | Regra |
|-------|------|-------|
| id | uuid PK | |
| devedor_id | uuid NOT NULL | FK devedores ON DELETE RESTRICT |
| tipo | text NOT NULL | CHECK in ('identificacao','comprovante_endereco','outro') |
| nome_original | text NOT NULL | |
| storage_path | text NOT NULL UNIQUE | bucket `documentos-devedores`, caminho `{devedor_id}/{uuid}.{ext}` |
| mime_type | text NOT NULL | whitelist |
| tamanho_bytes | bigint NOT NULL | CHECK > 0 |
| created_at / removido_em | timestamptz | soft delete |

Índice `(devedor_id) WHERE removido_em IS NULL`.

### dividas
| Campo | Tipo | Regra |
|-------|------|-------|
| id | uuid PK | |
| devedor_id | uuid NOT NULL | FK devedores ON DELETE RESTRICT |
| descricao | text NOT NULL | |
| valor_original | numeric(14,2) NOT NULL | CHECK > 0 |
| data_registro | date NOT NULL DEFAULT current_date | CHECK ≤ current_date no insert (trigger) |
| data_vencimento | date NULL | CHECK ≥ data_registro |
| observacoes | text NULL | |
| status | text NOT NULL DEFAULT 'em_aberto' | CHECK in ('em_aberto','quitada'); **mantido por trigger** |
| created_at, updated_at, created_by | | |

Índices: `(devedor_id)`, `(status)`, `(data_vencimento) WHERE status='em_aberto'`.

### pagamentos
| Campo | Tipo | Regra |
|-------|------|-------|
| id | uuid PK | |
| divida_id | uuid NOT NULL | FK dividas ON DELETE RESTRICT |
| valor | numeric(14,2) NOT NULL | CHECK > 0 |
| data_pagamento | date NOT NULL | |
| observacao | text NULL | |
| comprovante_path | text NULL | bucket `comprovantes-pagamentos` |
| status | text NOT NULL DEFAULT 'valido' | CHECK in ('valido','estornado') |
| estornado_em, estornado_por, motivo_estorno | | CHECK: se estornado → os três preenchidos |
| chave_idempotencia | uuid NOT NULL UNIQUE | evita duplicidade |
| created_at, created_by | | |

Índices: `(divida_id)`, `(divida_id) WHERE status='valido'`, `(data_pagamento)`.
**Sem política de DELETE.** UPDATE só via RPC de estorno (trigger bloqueia alteração de valor/dívida/data após criação).

### auditoria
| Campo | Tipo |
|-------|------|
| id | bigint identity PK |
| usuario_id | uuid |
| operacao | text (`INSERT`,`UPDATE`,`ESTORNO`,`STATUS`, …) |
| entidade | text (`devedores`,`dividas`,`pagamentos`,`devedor_documentos`) |
| entidade_id | uuid |
| devedor_id | uuid NULL (facilita o histórico no perfil) |
| dados_antes, dados_depois | jsonb |
| created_at | timestamptz |

Preenchida por **triggers** `SECURITY DEFINER`. RLS: só SELECT para admin; trigger impede UPDATE/DELETE. Índices `(devedor_id, created_at desc)`, `(entidade, entidade_id)`.

### configuracoes
`chave text PK`, `valor jsonb`, `updated_at`. Chaves iniciais: `upload.foto_max_bytes`, `upload.documento_max_bytes`, `upload.comprovante_max_bytes`.

## Views e funções

- **`vw_dividas_saldo`**: dívida + `total_pago` (Σ pagamentos `valido`) + `saldo = valor_original − total_pago`.
- **`vw_devedores_resumo`**: devedor + `total_registrado`, `total_pago`, `total_em_aberto`, `qtd_dividas_abertas`, `qtd_dividas_quitadas` (base da lista, busca e filtros).
- **`vw_dashboard`**: contagens e soma total em aberto.
- Views com `security_invoker = true` para respeitar RLS.
- **RPCs** (`SECURITY INVOKER`, checam `is_admin()`):
  - `registrar_divida(devedor_id, descricao, valor, data_registro, vencimento, obs)`
  - `registrar_pagamento(divida_id, valor, data, obs, comprovante_path, chave)` → trava dívida (`FOR UPDATE`), valida RN-42/44, insere, atualiza status.
  - `estornar_pagamento(pagamento_id, motivo)` → trava dívida, marca estorno, recalcula status.
  - `alterar_valor_divida(divida_id, novo_valor)` → valida ≥ total pago.
  - `alterar_status_devedor(devedor_id, status)` → retorna aviso (qtd/valor abertos) e audita.
- Triggers: `set_updated_at`, `proteger_pagamento`, `sync_status_divida`, `auditar_*`, `bloquear_auditoria_mutacao`.

## RLS

Todas as tabelas: `ENABLE ROW LEVEL SECURITY` (o dono das tabelas contorna RLS por padrão; por isso triggers também bloqueiam exclusões e mutações da auditoria); políticas `TO authenticated USING (is_admin()) WITH CHECK (is_admin())`, exceto:
- `pagamentos`, `auditoria`: sem DELETE; `auditoria` só SELECT.
- `administradores`: SELECT do próprio registro; escrita apenas pelo script de service role.
- `anon`: sem nenhum privilégio (`REVOKE ALL`).

## Storage

| Bucket | Conteúdo | Público | Tipos |
|--------|----------|---------|-------|
| fotos-devedores | retrato | **não** | png, jpg, jpeg, avif |
| documentos-devedores | documentos | **não** | png, jpg, jpeg, avif, webp, pdf |
| comprovantes-pagamentos | comprovantes | **não** | png, jpg, jpeg, avif, webp, pdf |

Políticas em `storage.objects`: `is_admin()` para select/insert/update/delete por bucket; `allowed_mime_types` e `file_size_limit` no bucket (alinhados a `configuracoes`).

## Migrations implementadas (`supabase/migrations/`)

1. `20261111000001_extensoes_e_funcoes_base` — unaccent, pg_trgm, `hoje()` (fuso de Brasília), `valida_cpf_cnpj`, `bloquear_exclusao`
2. `20261111000002_administradores_e_is_admin` — um único administrador ativo (índice parcial), `is_admin()`, `exigir_admin()`
3. `20261111000003_devedores_e_documentos`
4. `20261111000004_dividas_e_pagamentos` — triggers de saldo, imutabilidade e bloqueio de linha
5. `20261111000005_auditoria` — append-only
6. `20261111000006_views_e_rpcs`
7. `20261111000007_rls_e_permissoes` — `anon` sem acesso; sem DELETE para ninguém
8. `20261111000008_storage` — 3 buckets privados e políticas
9. `20261111000009_configuracoes` — limites de upload sincronizados com os buckets
10. `20261112000010_indices_listagem` — índices para ordenação/paginação e agregação por devedor (aditiva; **aplicar no projeto já existente**)

Ajustes em relação ao plano da Etapa 1: documentos e comprovantes não podem ser apagados/sobrescritos no Storage (só fotos, por causa da troca); `devedores_foto_path_valido`, `devedor_documentos_path_valido` e `pagamentos_comprovante_valido` amarram cada arquivo à pasta do próprio devedor/dívida.
