\set ADMIN 'a0000000-0000-0000-0000-000000000001'
\set OUTRO 'b0000000-0000-0000-0000-000000000002'

\o /dev/null
-- ===== Preparação (superusuário) =====
insert into auth.users (id, email) values (:'ADMIN', 'admin@teste.local'), (:'OUTRO', 'outro@teste.local');
insert into public.administradores (id, nome) values (:'ADMIN', 'Administrador Teste');

-- ===== 1. Estrutura e segurança =====
do $$ begin
  perform t.assert((select bool_and(relrowsecurity) from pg_class
                    where relnamespace = 'public'::regnamespace and relkind = 'r'), 'RLS ligado em todas as tabelas');
  perform t.assert((select count(*) from storage.buckets where public) = 0, 'buckets privados');
  perform t.assert((select count(*) from storage.buckets) = 3, '3 buckets');
  perform t.assert((select file_size_limit from storage.buckets where id='fotos-devedores') = 5242880, 'limite foto sincronizado');
  perform t.assert(public.valida_cpf_cnpj('52998224725','PF'), 'CPF válido');
  perform t.assert(not public.valida_cpf_cnpj('52998224726','PF'), 'CPF inválido');
  perform t.assert(not public.valida_cpf_cnpj('11111111111','PF'), 'CPF repetido');
  perform t.assert(public.valida_cpf_cnpj('11222333000181','PJ'), 'CNPJ válido');
  perform t.assert(not public.valida_cpf_cnpj('11222333000182','PJ'), 'CNPJ inválido');
  perform t.assert(not public.valida_cpf_cnpj('52998224725','PJ'), 'CPF não passa como CNPJ');
end $$;

-- Somente um administrador ativo
do $$ begin
  perform t.expect_error($q$insert into public.administradores (id, nome) values ('b0000000-0000-0000-0000-000000000002','Segundo Admin')$q$, 'duplicate|unique');
end $$;

-- ===== 2. anon e usuário não-admin =====
set role anon;
do $$ begin
  perform t.expect_error('select * from public.devedores', 'permission denied');
  perform t.expect_error('select * from public.vw_dashboard', 'permission denied');
  perform t.expect_error('select * from public.auditoria', 'permission denied');
  perform t.expect_error('select public.is_admin()', 'permission denied');
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', :'OUTRO', false);
do $$ begin
  perform t.assert(not public.is_admin(), 'usuário comum não é admin');
  perform t.assert((select count(*) from public.devedores) = 0, 'não-admin não lê devedores');
  perform t.expect_error($q$insert into public.devedores (tipo_pessoa, nome_razao_social) values ('PF','Intruso')$q$, 'row-level security');
  perform t.expect_error($q$select public.registrar_divida(gen_random_uuid(),'x',10)$q$, 'Acesso restrito');
  perform t.assert((select count(*) from public.administradores) = 0, 'não-admin não vê administradores');
  perform t.assert((select count(*) from public.configuracoes) = 0, 'não-admin não lê configuracoes');
end $$;
reset role;

-- ===== 3. Administrador: devedores =====
set role authenticated;
select set_config('request.jwt.claim.sub', :'ADMIN', false);

insert into public.devedores (id, tipo_pessoa, nome_razao_social, cpf_cnpj, rg, telefone, celular, email, cep, uf, logradouro)
values ('d0000000-0000-0000-0000-000000000001','PF','  José   da Silva ','529.982.247-25','12.345.678-9','(11) 3333-4444','(11) 98888-7777','JOSE@Email.com','01310-100','sp','');
insert into public.devedores (id, tipo_pessoa, nome_razao_social, cpf_cnpj)
values ('d0000000-0000-0000-0000-000000000002','PJ','Empresa Exemplo Ltda','11.222.333/0001-81');
insert into public.devedores (id, tipo_pessoa, nome_razao_social) values ('d0000000-0000-0000-0000-000000000003','PF','Sem Documento A');
insert into public.devedores (id, tipo_pessoa, nome_razao_social) values ('d0000000-0000-0000-0000-000000000004','PF','Sem Documento B');

do $$ declare r public.devedores; begin
  select * into r from public.devedores where id = 'd0000000-0000-0000-0000-000000000001';
  perform t.assert(r.nome_razao_social = 'José da Silva', 'nome normalizado');
  perform t.assert(r.cpf_cnpj = '52998224725', 'CPF só dígitos');
  perform t.assert(r.telefone = '1133334444' and r.celular = '11988887777', 'telefones só dígitos');
  perform t.assert(r.email = 'jose@email.com', 'email minúsculo');
  perform t.assert(r.uf = 'SP' and r.cep = '01310100', 'uf/cep normalizados');
  perform t.assert(r.logradouro is null, 'string vazia vira NULL');
  perform t.assert(r.status = 'ativo' and r.created_at is not null and r.created_by = 'a0000000-0000-0000-0000-000000000001', 'defaults/created_by');
  -- duplicidade (mesmo com máscara)
  perform t.expect_error($q$insert into public.devedores (tipo_pessoa, nome_razao_social, cpf_cnpj) values ('PF','Clone','529.982.247-25')$q$, 'devedores_cpf_cnpj_key');
  perform t.expect_error($q$insert into public.devedores (tipo_pessoa, nome_razao_social, cpf_cnpj) values ('PF','Invalido','52998224726')$q$, 'devedores_cpf_cnpj_valido');
  perform t.expect_error($q$insert into public.devedores (tipo_pessoa, nome_razao_social, cpf_cnpj) values ('PJ','CPF como CNPJ','52998224725')$q$, 'devedores_cpf_cnpj_valido');
  perform t.expect_error($q$insert into public.devedores (tipo_pessoa, nome_razao_social, email) values ('PF','Email Ruim','xx')$q$, 'check');
  perform t.expect_error($q$insert into public.devedores (tipo_pessoa, nome_razao_social, telefone) values ('PF','Tel Ruim','123')$q$, 'check');
  perform t.expect_error($q$insert into public.devedores (tipo_pessoa, nome_razao_social) values ('XX','Tipo Ruim')$q$, 'check');
  perform t.expect_error($q$insert into public.devedores (tipo_pessoa, nome_razao_social, uf) values ('PF','UF Ruim','ZZ')$q$, 'check');
  -- busca
  perform t.assert((select count(*) from public.devedores where busca like '%jose da silva%') = 1, 'busca sem acento');
  perform t.assert((select count(*) from public.devedores where busca like '%52998224725%') = 1, 'busca por CPF');
  perform t.assert((select count(*) from public.devedores where busca like '%123456789%') = 1, 'busca por RG normalizado');
  perform t.assert((select count(*) from public.devedores where busca like '%11988887777%') = 1, 'busca por celular');
  perform t.assert((select count(*) from public.devedores where busca like '%11222333000181%') = 1, 'busca por CNPJ');
  -- exclusão física proibida
  perform t.expect_error($q$delete from public.devedores where id = 'd0000000-0000-0000-0000-000000000003'$q$, 'permission denied');
  -- foto_path precisa estar na pasta do devedor
  perform t.expect_error($q$update public.devedores set foto_path = 'outro/x.png' where id = 'd0000000-0000-0000-0000-000000000001'$q$, 'devedores_foto_path_valido');
  update public.devedores set foto_path = id::text || '/foto.png' where id = 'd0000000-0000-0000-0000-000000000001';
end $$;

-- ===== 4. Dívidas e pagamentos =====
select public.registrar_divida('d0000000-0000-0000-0000-000000000001', 'Empréstimo A', 1500.00);
select public.registrar_divida('d0000000-0000-0000-0000-000000000001', 'Empréstimo B', 800.00);
select public.registrar_divida('d0000000-0000-0000-0000-000000000001', 'Empréstimo C', 700.00, null, public.hoje() + 30, 'obs');
do $$ declare v_a uuid; v_b uuid; v_c uuid; r public.pagamentos; s numeric; begin
  select id into v_a from public.dividas where descricao='Empréstimo A';
  select id into v_b from public.dividas where descricao='Empréstimo B';
  select id into v_c from public.dividas where descricao='Empréstimo C';
  create temp table ids as select v_a a, v_b b, v_c c;
  perform t.assert((select count(*) from public.dividas where status = 'em_aberto') = 3, 'dívidas nascem em aberto');
  perform t.expect_error(format($q$select public.registrar_divida('d0000000-0000-0000-0000-000000000001','Zero',0)$q$), 'check');
  perform t.expect_error(format($q$select public.registrar_divida('d0000000-0000-0000-0000-000000000001','Futura',10, public.hoje()+1)$q$), 'futura');
  perform t.expect_error(format($q$select public.registrar_divida(gen_random_uuid(),'Sem devedor',10)$q$), 'não encontrado');
  perform t.expect_error(format($q$insert into public.dividas (devedor_id, descricao, valor_original, data_vencimento, data_registro) values ('d0000000-0000-0000-0000-000000000001','Venc ruim',10, public.hoje()-5, public.hoje())$q$), 'dividas_vencimento_ok');

  -- Exemplo do documento: 1.500 - 300 - 200 = 1.000
  perform public.registrar_pagamento(v_a, 300, null, 'primeiro', null, '11111111-1111-1111-1111-111111111111');
  perform public.registrar_pagamento(v_a, 200, null, null, null, '22222222-2222-2222-2222-222222222222');
  select saldo into s from public.vw_dividas_saldo where id = v_a;
  perform t.assert(s = 1000.00, 'saldo 1500-300-200 = 1000, obtido ' || s);
  perform t.assert((select status from public.dividas where id = v_a) = 'em_aberto', 'ainda em aberto');

  -- Idempotência: reenvio devolve o mesmo pagamento sem duplicar
  select * into r from public.registrar_pagamento(v_a, 300, null, 'primeiro', null, '11111111-1111-1111-1111-111111111111');
  perform t.assert((select count(*) from public.pagamentos where divida_id = v_a) = 2, 'idempotência: sem duplicar');
  perform t.expect_error(format($q$select public.registrar_pagamento(%L, 10, null, null, null, '11111111-1111-1111-1111-111111111111')$q$, v_b), 'idempot');

  -- Regras de bloqueio
  perform t.expect_error(format($q$select public.registrar_pagamento(%L, 1000.01, null, null, null, gen_random_uuid())$q$, v_a), 'excede o saldo');
  perform t.expect_error(format($q$select public.registrar_pagamento(%L, 0, null, null, null, gen_random_uuid())$q$, v_a), 'check');
  perform t.expect_error(format($q$select public.registrar_pagamento(%L, -5, null, null, null, gen_random_uuid())$q$, v_a), 'check');
  perform t.expect_error(format($q$select public.registrar_pagamento(%L, 10, public.hoje()+1, null, null, gen_random_uuid())$q$, v_a), 'futura');
  perform t.expect_error(format($q$select public.registrar_pagamento(%L, 10, public.hoje()-1, null, null, gen_random_uuid())$q$, v_a), 'anterior ao registro');
  perform t.expect_error(format($q$select public.registrar_pagamento(%L, 10, null, null, 'caminho/invalido.pdf', gen_random_uuid())$q$, v_a), 'pagamentos_comprovante_valido');
  perform t.expect_error(format($q$select public.registrar_pagamento(gen_random_uuid(), 10, null, null, null, gen_random_uuid())$q$), 'não encontrada');
  perform t.assert((select saldo from public.vw_dividas_saldo where id = v_a) = 1000.00, 'saldo intacto após tentativas inválidas');

  -- Comprovante opcional dentro da pasta da dívida
  perform public.registrar_pagamento(v_b, 100, null, null, v_b::text || '/c.pdf', '33333333-3333-3333-3333-333333333333');

  -- Quitação total
  perform public.registrar_pagamento(v_a, 1000, null, 'quitação', null, '44444444-4444-4444-4444-444444444444');
  perform t.assert((select status from public.dividas where id = v_a) = 'quitada', 'quitada ao zerar saldo');
  perform t.assert((select saldo from public.vw_dividas_saldo where id = v_a) = 0, 'saldo zero');
  perform t.expect_error(format($q$select public.registrar_pagamento(%L, 1, null, null, null, gen_random_uuid())$q$, v_a), 'excede o saldo');

  -- Alteração de valor: não pode ficar abaixo do total pago
  perform t.expect_error(format($q$select public.alterar_valor_divida(%L, 1400)$q$, v_a), 'menor que o total já pago');
end $$;

-- Status é derivado: update manual de status é revertido pelo trigger
do $$ declare v_a uuid; begin
  select a into v_a from ids;
  update public.dividas set status = 'em_aberto' where id = v_a;
  perform t.assert((select status from public.dividas where id = v_a) = 'quitada', 'status manual é ignorado (derivado)');
  -- valor reduzido ao total pago mantém quitada; aumentado reabre
  perform public.alterar_valor_divida(v_a, 1800);
  perform t.assert((select status from public.dividas where id = v_a) = 'em_aberto', 'aumentar valor reabre a dívida');
  perform public.alterar_valor_divida(v_a, 1500);
  perform t.assert((select status from public.dividas where id = v_a) = 'quitada', 'voltar ao valor quita');
  perform t.expect_error(format($q$update public.dividas set devedor_id = 'd0000000-0000-0000-0000-000000000002' where id = %L$q$, v_a), 'outro devedor');
  perform t.expect_error(format($q$update public.dividas set data_registro = public.hoje() - 1 where id = %L$q$, v_a), 'não pode ser alterada');
  perform t.expect_error(format($q$delete from public.dividas where id = %L$q$, v_a), 'permission denied');
end $$;

-- ===== 5. Estorno e imutabilidade =====
do $$ declare v_a uuid; p uuid; r public.pagamentos; begin
  select a into v_a from ids;
  select id into p from public.pagamentos where chave_idempotencia = '44444444-4444-4444-4444-444444444444';
  perform t.expect_error(format($q$select public.estornar_pagamento(%L, 'x')$q$, p), 'motivo');
  perform t.expect_error(format($q$update public.pagamentos set valor = 1 where id = %L$q$, p), 'não podem ser editados');
  perform t.expect_error(format($q$update public.pagamentos set status = 'estornado' where id = %L$q$, p), 'pagamentos_estorno_completo');
  perform t.expect_error(format($q$delete from public.pagamentos where id = %L$q$, p), 'permission denied');
  select * into r from public.estornar_pagamento(p, 'Lançado por engano');
  perform t.assert(r.status = 'estornado' and r.estornado_por = 'a0000000-0000-0000-0000-000000000001', 'estorno registrado');
  perform t.assert((select status from public.dividas where id = v_a) = 'em_aberto', 'estorno reabre a dívida');
  perform t.assert((select saldo from public.vw_dividas_saldo where id = v_a) = 1000.00, 'saldo restaurado após estorno');
  perform t.assert((select count(*) from public.pagamentos where divida_id = v_a) = 3, 'pagamento estornado permanece no histórico');
  perform t.expect_error(format($q$select public.estornar_pagamento(%L, 'de novo')$q$, p), 'já estornado');
  perform t.expect_error(format($q$update public.pagamentos set status='valido', estornado_em=null, motivo_estorno=null where id = %L$q$, p), 'estornado não pode');
  -- Após o estorno é possível pagar novamente até o saldo
  perform public.registrar_pagamento(v_a, 1000, null, 'refeito', null, '55555555-5555-5555-5555-555555555555');
  perform t.assert((select status from public.dividas where id = v_a) = 'quitada', 'requitada');
end $$;

-- ===== 6. Totais, resumo e dashboard =====
do $$ declare r record; d record; begin
  select * into r from public.vw_devedores_resumo where id = 'd0000000-0000-0000-0000-000000000001';
  -- A 1500 (paga), B 800 (100 pagos), C 700
  perform t.assert(r.total_registrado = 3000 and r.total_pago = 1600 and r.total_em_aberto = 1400, 'totais do devedor: ' || r.total_registrado || '/' || r.total_pago || '/' || r.total_em_aberto);
  perform t.assert(r.qtd_dividas_abertas = 2 and r.qtd_dividas_quitadas = 1, 'contagem de dívidas');
  select * into d from public.vw_dashboard;
  perform t.assert(d.total_devedores = 4 and d.devedores_ativos = 4 and d.devedores_inativos = 0, 'dashboard devedores');
  perform t.assert(d.dividas_em_aberto = 2 and d.dividas_quitadas = 1 and d.valor_total_em_aberto = 1400, 'dashboard dívidas');
  perform t.assert((select total_em_aberto from public.vw_devedores_resumo where id = 'd0000000-0000-0000-0000-000000000002') = 0, 'devedor sem dívida = 0');
end $$;

-- ===== 7. Inativação com aviso =====
do $$ declare j jsonb; begin
  j := public.alterar_status_devedor('d0000000-0000-0000-0000-000000000001', 'inativo');
  perform t.assert((j->>'requer_confirmacao')::boolean and (j->>'qtd_dividas_abertas')::int = 2 and (j->>'valor_em_aberto')::numeric = 1400, 'aviso de inativação');
  perform t.assert((select status from public.devedores where id = 'd0000000-0000-0000-0000-000000000001') = 'ativo', 'sem confirmação nada muda');
  j := public.alterar_status_devedor('d0000000-0000-0000-0000-000000000001', 'inativo', true);
  perform t.assert((j->>'alterado')::boolean, 'inativado com confirmação');
  perform t.assert((select count(*) from public.dividas where devedor_id = 'd0000000-0000-0000-0000-000000000001') = 3, 'histórico preservado');
  perform t.expect_error($q$select public.registrar_divida('d0000000-0000-0000-0000-000000000001','Nova',10)$q$, 'inativo');
  perform public.registrar_pagamento((select b from ids), 50, null, null, null, '66666666-6666-6666-6666-666666666666');  -- pagamento segue permitido
  perform t.assert((select valor_total_em_aberto from public.vw_dashboard) = 1350, 'inativo continua nos totais');
  j := public.alterar_status_devedor('d0000000-0000-0000-0000-000000000003', 'inativo');   -- sem dívida: sem aviso
  perform t.assert((j->>'alterado')::boolean, 'inativar sem dívidas não exige confirmação');
  j := public.alterar_status_devedor('d0000000-0000-0000-0000-000000000001', 'ativo');
  perform t.assert((j->>'alterado')::boolean, 'reativado');
end $$;

-- ===== 8. Documentos =====
do $$ declare doc uuid; begin
  insert into public.devedor_documentos (devedor_id, tipo, nome_original, storage_path, mime_type, tamanho_bytes)
  values ('d0000000-0000-0000-0000-000000000001','identificacao','rg.pdf','d0000000-0000-0000-0000-000000000001/a.pdf','application/pdf',1000) returning id into doc;
  perform t.expect_error($q$insert into public.devedor_documentos (devedor_id, tipo, nome_original, storage_path, mime_type, tamanho_bytes) values ('d0000000-0000-0000-0000-000000000001','outro','x.exe','d0000000-0000-0000-0000-000000000001/b.exe','application/x-msdownload',10)$q$, 'check');
  perform t.expect_error($q$insert into public.devedor_documentos (devedor_id, tipo, nome_original, storage_path, mime_type, tamanho_bytes) values ('d0000000-0000-0000-0000-000000000001','outro','x.pdf','outra-pasta/b.pdf','application/pdf',10)$q$, 'devedor_documentos_path_valido');
  perform t.expect_error(format($q$update public.devedor_documentos set nome_original = 'novo' where id = %L$q$, doc), 'só podem ser removidos');
  perform t.expect_error(format($q$delete from public.devedor_documentos where id = %L$q$, doc), 'permission denied');
  update public.devedor_documentos set removido_em = now() where id = doc;
  perform t.assert((select removido_por from public.devedor_documentos where id = doc) = 'a0000000-0000-0000-0000-000000000001', 'remoção registra usuário');
end $$;

-- ===== 9. Configurações / Storage =====
do $$ begin
  perform t.assert((select count(*) from public.configuracoes) = 3, 'admin lê configuracoes');
  update public.configuracoes set valor = '2097152' where chave = 'upload.foto_max_bytes';
  perform t.assert(t.bucket_limit('fotos-devedores') = 2097152, 'limite do bucket acompanha configuração');
  update public.configuracoes set valor = '5242880' where chave = 'upload.foto_max_bytes';
  perform t.expect_error($q$update public.configuracoes set valor = '"abc"' where chave = 'upload.foto_max_bytes'$q$, 'check');
  perform t.expect_error($q$update public.configuracoes set valor = '10' where chave = 'upload.foto_max_bytes'$q$, 'check');
  perform t.expect_error($q$delete from public.configuracoes$q$, 'permission denied');
end $$;

-- ===== 10. Auditoria =====
do $$ declare n int; begin
  perform t.assert((select count(*) from public.auditoria where entidade='devedores' and operacao='INSERT') = 4, 'auditoria: cadastro de devedores');
  perform t.assert((select count(*) from public.auditoria where entidade='dividas' and operacao='INSERT') = 3, 'auditoria: dívidas');
  perform t.assert((select count(*) from public.auditoria where entidade='pagamentos' and operacao='INSERT') >= 6, 'auditoria: pagamentos');
  perform t.assert((select count(*) from public.auditoria where operacao='ESTORNO') = 1, 'auditoria: estorno');
  perform t.assert((select count(*) from public.auditoria where entidade='devedores' and operacao='STATUS') = 3, 'auditoria: mudanças de status do devedor');
  perform t.assert((select count(*) from public.auditoria where operacao='REMOCAO') = 1, 'auditoria: remoção de documento');
  perform t.assert((select count(*) from public.auditoria where entidade='dividas' and operacao='STATUS') >= 2, 'auditoria: quitação/reabertura');
  perform t.assert((select count(*) from public.auditoria where usuario_id is distinct from 'a0000000-0000-0000-0000-000000000001') = 0, 'auditoria identifica o usuário');
  perform t.assert((select count(*) from public.auditoria where entidade='pagamentos' and devedor_id is null) = 0, 'auditoria de pagamento aponta o devedor');
  perform t.assert((select dados_antes->>'valor_original' from public.auditoria where entidade='dividas' and operacao='UPDATE' order by id limit 1) = '1500.00', 'auditoria guarda valor antes: ' || coalesce((select dados_antes->>'valor_original' from public.auditoria where entidade='dividas' and operacao='UPDATE' order by id limit 1),'null'));
  perform t.expect_error($q$update public.auditoria set operacao = 'X'$q$, 'permission denied');
  perform t.expect_error($q$delete from public.auditoria$q$, 'permission denied');
  perform t.expect_error($q$insert into public.auditoria (operacao, entidade, entidade_id) values ('X','x',gen_random_uuid())$q$, 'permission denied');
end $$;
reset role;

-- Mesmo o dono/superusuário não altera a auditoria nem apaga pagamentos
do $$ begin
  perform t.expect_error($q$update public.auditoria set operacao = 'X'$q$, 'append-only');
  perform t.expect_error($q$delete from public.auditoria$q$, 'append-only');
  perform t.expect_error($q$truncate public.auditoria$q$, 'append-only');
  perform t.expect_error($q$delete from public.pagamentos$q$, 'Exclusão física');
  perform t.expect_error($q$delete from public.dividas$q$, 'Exclusão física');
  perform t.expect_error($q$delete from public.devedores$q$, 'Exclusão física');
end $$;

-- Dados para o teste de concorrência
set role authenticated;
select set_config('request.jwt.claim.sub', :'ADMIN', false);
select public.registrar_divida('d0000000-0000-0000-0000-000000000002', 'Dívida concorrência', 100.00);
reset role;
\o
\echo 'testes sequenciais OK'
