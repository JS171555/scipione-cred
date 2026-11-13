# Scipione Cred — Regras de negócio e validações

Legenda: **[Escopo]** definido no documento/prompt · **[Adotada]** decisão conservadora minha, fácil de ajustar (ver `decisoes.md`).

## Acesso
- RN-01 [Escopo] Um único perfil: administrador. Sem cadastro público.
- RN-02 [Escopo] Senha: mín. 8 caracteres com maiúscula, minúscula, número e caractere especial.
- RN-03 [Escopo] Todas as páginas internas exigem sessão; sem sessão → login.
- RN-04 [Adotada] Usuário autenticado que não conste em `administradores` ativo não acessa nenhum dado.

## Devedores
- RN-10 [Escopo] Aceita pessoa física (PF) e jurídica (PJ). `tipo_pessoa` define se o documento é CPF (11) ou CNPJ (14).
- RN-11 [Escopo] Nome/razão social obrigatório. Telefone ou celular: [Adotada] ao menos um contato recomendado, não bloqueante.
- RN-12 [Escopo] CPF/CNPJ: validar formato e dígitos verificadores; **único** quando informado. [Pendente] obrigatoriedade → hoje **opcional** (NULL permitido; unicidade só entre valores não nulos). Armazenado só com dígitos.
- RN-13 [Escopo] E-mail opcional, formato válido quando informado.
- RN-14 [Escopo] CEP com 8 dígitos dispara ViaCEP; preenche logradouro, bairro, cidade, UF; campos continuam editáveis. CEP inexistente/erro de rede não impede o salvamento.
- RN-15 [Escopo] Data de cadastro automática (servidor).
- RN-16 [Escopo] Status `ativo`/`inativo`. Inativar com dívidas em aberto é **permitido mediante aviso** (exibir quantidade e valor em aberto e exigir confirmação); nada é apagado.
- RN-17 [Adotada] Devedor **inativo**: não aceita nova dívida (exibir aviso para reativar); pagamentos de dívidas já abertas continuam permitidos; segue nos totais.
- RN-18 [Adotada] Devedor não é excluído fisicamente na v1 (só inativado).

## Arquivos
- RN-20 [Adotada] Foto: PNG, JPG, JPEG, AVIF, WEBP. Documentos: PNG, JPG, JPEG, AVIF, PDF, WEBP. Comprovante: [Adotada] mesmos formatos dos documentos. Toda imagem enviada é convertida para WebP (maior lado 1600 px na foto, 2200 px em documentos/comprovantes) e PDFs são reotimizados sem perda; se a conversão não reduzir o arquivo, o original é mantido.
- RN-21 Validar extensão **e** MIME, e tamanho. [Adotada] limites padrão: foto 5 MB, documento 10 MB, comprovante 10 MB; configuráveis na tabela `configuracoes`.
- RN-22 [Escopo] Armazenamento privado; acesso por URL assinada de curta duração.
- RN-23 [Adotada] Substituir foto troca a referência e remove o arquivo antigo do Storage; documentos removidos ficam com `removido_em` (soft delete) e a remoção é auditada.

## Dívidas
- RN-30 Toda dívida pertence a um devedor (FK obrigatória, `ON DELETE RESTRICT`).
- RN-31 [Escopo] Campos: descrição/motivo, valor original, data do registro, vencimento (opcional), observações, status `em_aberto` | `quitada`.
- RN-32 Valor original > 0, até 2 casas decimais (`numeric(14,2)`; no JS trabalhar em centavos inteiros).
- RN-33 [Adotada] Data do registro padrão = hoje; não pode ser futura. Vencimento, se informado, ≥ data do registro.
- RN-34 Status é **derivado**: `quitada` quando saldo = 0; `em_aberto` caso contrário. Mantido pelo banco, nunca editado à mão.
- RN-35 [Adotada] Edição permitida: descrição, observações, vencimento. Valor original só pode mudar se continuar ≥ total pago válido; toda alteração de valor é auditada com antes/depois.
- RN-36 [Revisada em 13/11/2026] Dívida com qualquer pagamento registrado não é excluída; erros são corrigidos por edição auditada ou estorno.
- RN-36.1 Dívida sem nenhum pagamento pode ser apagada do banco pela ação Apagar (RPC `excluir_divida`), exclusiva do administrador, com confirmação na tela e registro `DELETE` na auditoria.

## Pagamentos e saldo
- RN-40 [Escopo] **Saldo = valor original − soma dos pagamentos válidos.** Sem juros, multas, encargos ou parcelamento.
- RN-41 [Escopo] Pagamento sempre vinculado a **uma dívida específica**; sem rateio automático.
- RN-42 [Escopo] Parcial ou total. Valor > 0 e **≤ saldo atual**; saldo nunca negativo.
- RN-43 [Escopo] Campos: valor, data do pagamento, observação (opcional), comprovante (opcional).
- RN-44 [Adotada] Data do pagamento não pode ser futura nem anterior à data de registro da dívida.
- RN-45 Quando saldo chega a 0 → dívida `quitada` (na mesma transação).
- RN-46 [Escopo] Pagamentos não são apagados. Correção = **estorno**: marca o pagamento como `estornado`, exige motivo, guarda usuário/data; deixa de contar no saldo; a dívida volta a `em_aberto` se necessário. O registro original permanece visível no histórico.
- RN-47 Concorrência: a RPC bloqueia a linha da dívida (`FOR UPDATE`) antes de validar saldo, impedindo dois pagamentos simultâneos de ultrapassarem o saldo.
- RN-48 Idempotência: a RPC recebe um `chave_idempotencia` (uuid gerado na UI) com índice único, evitando pagamento duplicado por duplo clique/reenvio.

## Totais
- RN-50 Total registrado (devedor) = Σ valor original das dívidas.
- RN-51 Total pago = Σ pagamentos válidos. Total em aberto = registrado − pago.
- RN-52 Dashboard "valor total em aberto" soma todas as dívidas em aberto, **inclusive de devedores inativos**.
- RN-53 Cálculos feitos no banco (views); a UI só formata.

## Auditoria
- RN-60 Registrar: cadastro/edição de devedor, mudança de status, cadastro/edição de dívida, pagamento, estorno, upload/remoção de documento.
- RN-61 Campos: usuário, data/hora, operação, entidade, id, devedor relacionado, dados antes/depois (JSON).
- RN-62 Tabela append-only: sem UPDATE/DELETE para ninguém (trigger bloqueia).

## Validações transversais
- Normalizar espaços; telefone só dígitos (DDD obrigatório quando informado); UF com 2 letras válidas.
- Validar no cliente (UX) **e** no banco (CHECK/trigger) — o banco é a fonte final.
- Mensagens de erro em português, sem expor detalhes internos.
