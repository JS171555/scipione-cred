# Scipione Cred — Plano de testes

## Automatizados (rodam sem o seu Supabase)
| Comando | O que cobre |
|---------|-------------|
| `npm test` | Unitários e de tela (jsdom): senha, arquivos (inclusive arquivo falsificado), CPF/CNPJ, dinheiro, datas, regras financeiras, descrições do histórico, formulários, perfil, dashboard, lista (filtros/paginação/URL), **proteção de rotas** |
| `npm run test:sql` | Migrations em PostgreSQL: RLS, anon bloqueado, CPF/CNPJ, saldo, bloqueio acima do saldo, quitação, estorno, imutabilidade, auditoria append-only, concorrência (2 pagamentos simultâneos) |
| `npm run test:integracao` | Serviços do frontend (`supabase-js`) ↔ PostgREST ↔ migrations: cadastro, duplicidade de CPF, busca, foto, documentos, dívidas, pagamentos, estorno, inativação com aviso, dashboard, filtros, ordenação, paginação, histórico, isolamento de usuário não administrador e anônimo. Storage simulado |

## Matriz do Prompt Master (etapa 4.6)
| Teste exigido | Onde é coberto |
|---|---|
| Cadastro e edição | integração · UI |
| Duplicidade de CPF/CNPJ | SQL · integração · UI |
| Upload e visualização de documentos | unit (validação) · integração (Storage simulado) · **manual (real)** |
| Pesquisa e filtros | integração · UI |
| Criação de dívidas / pagamentos parciais / quitação total | SQL · integração · UI |
| Bloqueio de pagamento acima do saldo | unit · SQL · integração · UI |
| Atualização dos indicadores | integração (dashboard calculado do banco) |
| Histórico de movimentações | integração · UI · unit |
| Autenticação | **manual (real)** — GoTrue não roda localmente |
| Proteção das rotas | UI (roteador) · integração (RLS) |
| Políticas RLS | SQL · integração |
| Acesso aos documentos privados | **manual (real)** |
| Situações de erro e operações inválidas | todas as suítes |

## Roteiro manual no Supabase real (o que a automação não alcança)
Execute no navegador com `npm run dev` (ou a versão publicada):

**Autenticação**
1. Abrir `#/devedores` sem login → vai para o login.
2. Login com senha errada → "E-mail ou senha inválidos." (sem dizer qual está errado).
3. Login correto → dashboard. "Sair" → volta ao login; botão voltar do navegador não reabre telas internas.
4. "Esqueci minha senha" → e-mail chega; abrir o link **no mesmo navegador** → definir senha forte → login com a nova.
5. Usuário criado à mão no painel (que não é o administrador) → login é recusado com "Acesso restrito".

**Documentos privados**
6. Anexar PDF e imagem em um devedor; "Ver" abre por link temporário.
7. Copiar a URL do arquivo aberto, esperar > 60 s e recarregar → deve falhar (link expirou).
8. Acessar `https://<projeto>.supabase.co/storage/v1/object/public/documentos-devedores/<qualquer>` → não pode abrir (bucket privado).
9. Tentar anexar `.exe`, arquivo acima do limite e um `.png` falso (renomeado) → todos recusados com mensagem clara.

**Fluxo financeiro**
10. Exemplo do escopo: dívidas 1.500 / 800 / 700; pagamento total de 500 → "Total em aberto R$ 2.500,00" no perfil, na lista e no dashboard.
11. Tentar pagar mais que o saldo → bloqueado. Duplo clique em "Registrar pagamento" → um único pagamento.
12. Quitar uma dívida → status "Quitada"; estornar → volta "Em aberto" e o histórico mostra os dois eventos.
13. Inativar devedor com dívida em aberto → aviso com quantidade e valor; confirmar; histórico preservado; nova dívida bloqueada.
14. Recarregar cada tela: tudo persiste.

`npm run verificar:supabase` (somente leitura) confere RLS/anon/buckets automaticamente.
