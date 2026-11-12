import { pagina, badgeStatus } from '../components/pagina.js';
import { confirmar, pedirTexto } from '../components/dialogos.js';
import * as devedores from '../services/devedores.js';
import * as dividas from '../services/dividas.js';
import * as pagamentos from '../services/pagamentos.js';
import * as documentos from '../services/documentos.js';
import * as auditoria from '../services/auditoria.js';
import { itemHistorico } from '../components/historico.js';
import { TIPOS_DOCUMENTO } from '../services/documentos.js';
import { totaisDevedor } from '../domain/financeiro.js';
import { formatarDocumento, formatarTelefone, formatarCEP } from '../utils/cpf-cnpj.js';
import { formatarBRL, formatarCentavos, paraCentavos } from '../utils/money.js';
import { formatarData, formatarDataHora } from '../utils/dates.js';
import { formatarTamanho } from '../utils/files.js';
import { traduzirErro } from '../core/errors.js';
import { esc, $, mostrarMensagem } from '../core/dom.js';
import { consumirAviso, definirAviso } from '../core/router.js';
import { uploadField, instalarUpload, arquivosDoUpload, validarSelecaoUpload, marcarUpload } from '../components/upload.js';

const POR_PAGINA_HISTORICO = 10;
const q = (sel, raiz) => $(sel, raiz);

async function abrirUrl(gerar) {
  const w = window.open('about:blank', '_blank');
  try { const url = await gerar(); if (w) { w.opener = null; w.location.href = url; } }
  catch (e) { w?.close(); throw e; }
}

function telaErro(el, mensagem, retry) {
  el.innerHTML = `<div class="error-state" role="alert"><h2>Não foi possível carregar este perfil.</h2><p>${esc(mensagem)}</p><button type="button" class="btn sec" data-retry>Tentar novamente</button></div>`;
  el.querySelector('[data-retry]').addEventListener('click', retry);
}

export async function renderDevedorDetalhe(raiz, { params, admin, signal } = {}) {
  if (signal?.aborted) return;
  const id = params?.id;
  const el = pagina(raiz, { titulo: 'Perfil do cliente', descricao: 'Dados cadastrais, posição financeira e histórico auditável.', voltar: { href: '/devedores', texto: 'Clientes' }, admin });
  const aviso = consumirAviso();
  const recarregar = () => {
    if (signal?.aborted || !el.isConnected) return;
    return renderDevedorDetalhe(raiz, { params, admin, signal });
  };
  el.innerHTML = '<div class="loading-state" role="status"><span class="spinner" aria-hidden="true"></span><span>Carregando perfil…</span></div>';

  let d; let listaDividas; let listaPagamentos; let docs; let historico;
  try {
    [d, listaDividas, listaPagamentos, docs, historico] = await Promise.all([
      devedores.obter(id), dividas.listarPorDevedor(id), pagamentos.listarPorDevedor(id), documentos.listar(id), auditoria.listarPorDevedor(id, { limite: POR_PAGINA_HISTORICO }),
    ]);
  } catch (e) {
    if (signal?.aborted || !el.isConnected) return;
    telaErro(el, traduzirErro(e), recarregar);
    return;
  }
  if (signal?.aborted || !el.isConnected) return;
  if (!d) { telaErro(el, 'Cliente não encontrado.', () => { window.location.hash = '#/devedores'; }); return; }
  listaDividas ??= []; listaPagamentos ??= []; docs ??= []; historico ??= [];
  let fotoUrl = null;
  if (d.foto_path && typeof devedores.urlFoto === 'function') fotoUrl = await Promise.resolve(devedores.urlFoto(d.foto_path)).catch(() => null);
  if (signal?.aborted || !el.isConnected) return;
  const t = totaisDevedor(listaDividas, paraCentavos);
  const endereco = [d.logradouro, d.numero, d.complemento, d.bairro, [d.cidade, d.uf].filter(Boolean).join('/'), formatarCEP(d.cep)].filter(Boolean).join(', ');
  const ctxHist = { admin, dividas: new Map(listaDividas.map((v) => [v.id, v.descricao])) };
  const pagsDe = (dividaId) => listaPagamentos.filter((p) => p.divida_id === dividaId);

  const blocoDivida = (v) => `<article class="profile-section debt-card" data-divida="${esc(v.id)}">
    <div class="section-heading"><div><span class="auth-eyebrow">Dívida</span><h3>${esc(v.descricao)} ${badgeStatus(v.status)}</h3><small>Registrada em ${formatarData(v.data_registro)} · Vencimento: ${formatarData(v.data_vencimento)}${v.observacoes ? ` · ${esc(v.observacoes)}` : ''}</small></div>
      <div class="actions-inline"><a class="btn peq sec" href="#/dividas/${esc(v.id)}/editar">Editar</a>${v.status === 'em_aberto' ? `<a class="btn peq" href="#/dividas/${esc(v.id)}/pagamento">Registrar pagamento</a>` : ''}</div></div>
    <dl class="resumo"><div><dt>Original</dt><dd>${formatarBRL(v.valor_original)}</dd></div><div><dt>Pago</dt><dd>${formatarBRL(v.total_pago)}</dd></div><div><dt>Saldo</dt><dd><strong>${formatarBRL(v.saldo)}</strong></dd></div></dl>
    ${pagsDe(v.id).length ? `<div class="table-wrap rolagem"><table class="compacta"><thead><tr><th>Data</th><th class="num">Valor</th><th>Observação</th><th>Situação</th><th></th></tr></thead><tbody>${pagsDe(v.id).map((p) => `<tr class="${p.status === 'estornado' ? 'estornado' : ''}"><td>${formatarData(p.data_pagamento)}</td><td class="num">${formatarBRL(p.valor)}</td><td>${esc(p.observacao ?? '')}${p.status === 'estornado' ? `<br><small>Estornado em ${formatarDataHora(p.estornado_em)}: ${esc(p.motivo_estorno)}</small>` : ''}</td><td>${badgeStatus(p.status)}</td><td class="actions-inline">${p.comprovante_path ? `<button class="peq sec" data-acao="comprovante" data-path="${esc(p.comprovante_path)}">Comprovante</button>` : ''}${p.status === 'valido' ? `<button class="peq perigo" data-acao="estornar" data-id="${esc(p.id)}">Estornar</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty-state compact">Nenhum pagamento registrado.</p>'}
  </article>`;

  el.innerHTML = `<p class="msg ok" id="aviso" role="status" hidden></p><p class="msg erro" id="msg" role="alert" hidden></p>
    <section class="profile-header"><div class="profile-avatar">${fotoUrl ? `<img src="${esc(fotoUrl)}" alt="Foto de ${esc(d.nome_razao_social)}">` : `<span aria-hidden="true">${esc((d.nome_razao_social ?? '?').trim().slice(0, 2).toUpperCase())}</span>`}</div>
      <div class="profile-heading"><span class="auth-eyebrow">${d.tipo_pessoa === 'PJ' ? 'Pessoa jurídica' : 'Pessoa física'}</span><h2>${esc(d.nome_razao_social)} ${badgeStatus(d.status)}</h2><p class="profile-meta"><span>${d.tipo_pessoa === 'PJ' ? 'CNPJ' : 'CPF'}: ${esc(formatarDocumento(d.cpf_cnpj)) || 'Não informado'}</span><span>Telefone: ${esc(formatarTelefone(d.celular || d.telefone)) || 'Não informado'}</span></p><p>Cadastrado em ${formatarData(d.created_at)}</p><div class="actions-inline"><a class="btn peq" href="#/devedores/${esc(id)}/editar">Editar cadastro</a><button class="peq sec" data-acao="status">${d.status === 'ativo' ? 'Inativar' : 'Reativar'}</button>${d.foto_path ? '<button class="peq sec" data-acao="remover-foto">Remover foto</button>' : ''}${uploadField({ id: 'foto-nova', label: 'Substituir foto', categoria: 'foto', accept: '.png,.jpg,.jpeg,.avif', help: 'PNG, JPG, JPEG ou AVIF.' })}</div></div></section>
    <section class="profile-section" aria-labelledby="dados-titulo"><div class="section-heading"><h2 id="dados-titulo">Dados do cadastro</h2><small><a href="#/devedores/${esc(id)}/editar">Gerenciar cadastro e documentos</a></small></div><dl class="dados"><div><dt>${d.tipo_pessoa === 'PJ' ? 'CNPJ' : 'CPF'}</dt><dd>${esc(formatarDocumento(d.cpf_cnpj)) || '—'}</dd></div><div class="rg-field"><dt>RG</dt><dd>${d.tipo_pessoa === 'PJ' ? 'Não se aplica' : (esc(d.rg) || '—')}</dd></div><div><dt>Telefone</dt><dd>${esc(formatarTelefone(d.telefone)) || '—'}</dd></div><div><dt>Celular</dt><dd>${esc(formatarTelefone(d.celular)) || '—'}</dd></div><div><dt>E-mail</dt><dd>${esc(d.email) || '—'}</dd></div><div class="larga"><dt>Endereço</dt><dd>${esc(endereco) || '—'}</dd></div><div class="larga"><dt>Observações</dt><dd>${esc(d.observacoes) || '—'}</dd></div></dl></section>
    <section class="profile-section" aria-labelledby="financeiro-titulo"><div class="section-heading"><h2 id="financeiro-titulo">Resumo financeiro</h2><small>Valores derivados das dívidas e pagamentos válidos</small></div><dl class="resumo finance-summary"><div><dt>Total registrado</dt><dd>${formatarCentavos(t.registradoC)}</dd></div><div><dt>Total pago</dt><dd>${formatarCentavos(t.pagoC)}</dd></div><div><dt>Saldo em aberto</dt><dd><strong>${formatarCentavos(t.emAbertoC)}</strong></dd></div><div><dt>Carteira</dt><dd>${t.abertas} em aberto · ${t.quitadas} quitadas</dd></div></dl></section>
    <section class="profile-section" aria-labelledby="dividas-titulo"><div class="section-heading"><h2 id="dividas-titulo">Dívidas</h2>${d.status === 'ativo' ? `<a class="btn" href="#/devedores/${esc(id)}/dividas/nova">Nova dívida</a>` : '<small>Reative o cadastro para registrar novas dívidas.</small>'}</div>${listaDividas.length ? listaDividas.map(blocoDivida).join('') : '<p class="empty-state">Nenhuma dívida registrada.</p>'}</section>
    <section class="profile-section" aria-labelledby="documentos-titulo"><div class="section-heading"><h2 id="documentos-titulo">Documentos privados</h2><small>Links assinados expiram rapidamente.</small></div>${docs.length ? `<ul class="docs upload-list">${docs.map((x) => `<li><span><strong>${esc(TIPOS_DOCUMENTO[x.tipo] ?? x.tipo)}</strong><small>${esc(x.nome_original)} · ${formatarTamanho(x.tamanho_bytes)} · ${formatarData(x.created_at)}</small></span><span class="actions-inline"><button class="peq sec" data-acao="ver-doc" data-id="${esc(x.id)}">Ver</button><button class="peq perigo" data-acao="rem-doc" data-id="${esc(x.id)}">Remover</button></span></li>`).join('')}</ul>` : '<p class="empty-state compact">Nenhum documento anexado.</p>'}<div class="form-grid document-upload"><div class="field"><label for="doc-tipo">Tipo<select id="doc-tipo">${Object.entries(TIPOS_DOCUMENTO).map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join('')}</select></label></div>${uploadField({ id: 'doc-arq', label: 'Anexar documento', categoria: 'documento', accept: '.png,.jpg,.jpeg,.avif,.webp,.pdf', help: 'PNG, JPG, JPEG, AVIF, WEBP ou PDF.' })}</div><button type="button" class="btn sec" data-acao="add-doc">Anexar documento</button></section>
    <section class="profile-section" aria-labelledby="historico-titulo"><div class="section-heading"><h2 id="historico-titulo">Histórico de movimentações</h2><small>Registro auditável</small></div>${historico.length ? `<ol class="historico" id="historico">${historico.map((m) => itemHistorico(m, ctxHist)).join('')}</ol>` : '<p class="empty-state">Nenhuma movimentação registrada.</p>'}${historico.length === POR_PAGINA_HISTORICO ? '<button type="button" class="sec peq" data-acao="mais-historico">Ver movimentações anteriores</button>' : ''}</section>`;
  mostrarMensagem(q('#aviso', raiz), aviso, 'ok');
  instalarUpload(q('#doc-arq', raiz), { categoria: 'documento' });
  instalarUpload(q('#foto-nova', raiz), { categoria: 'foto' });

  const falha = (e) => { if (!signal?.aborted && el.isConnected) mostrarMensagem(q('#msg', raiz), traduzirErro(e)); };
  const feito = (texto) => { if (signal?.aborted || !el.isConnected) return; definirAviso(texto); recarregar(); };
  const acoes = {
    async status() {
      if (d.status === 'inativo') { await devedores.alterarStatus(id, 'ativo'); if (signal?.aborted || !el.isConnected) return; return feito('Cadastro reativado.'); }
      let r = await devedores.alterarStatus(id, 'inativo', false);
      if (signal?.aborted || !el.isConnected) return;
      if (r.requer_confirmacao) { const ok = await confirmar(`Este devedor possui ${r.qtd_dividas_abertas} dívida(s) em aberto, somando ${formatarBRL(r.valor_em_aberto)}. Inativar mesmo assim? O histórico financeiro será preservado.`, { confirmarTexto: 'Inativar' }); if (!ok) return; r = await devedores.alterarStatus(id, 'inativo', true); }
      if (signal?.aborted || !el.isConnected) return;
      return feito('Cadastro inativado.');
    },
    async estornar(alvo) { const motivo = await pedirTexto('O pagamento deixará de contar no saldo, mas continuará no histórico.', { rotulo: 'Motivo do estorno', confirmarTexto: 'Estornar' }); if (!motivo || signal?.aborted || !el.isConnected) return; await pagamentos.estornar(alvo.dataset.id, motivo); feito('Pagamento estornado.'); },
    comprovante: (alvo) => abrirUrl(() => pagamentos.urlComprovante(alvo.dataset.path)),
    'ver-doc': (alvo) => abrirUrl(() => documentos.urlDocumento(docs.find((x) => x.id === alvo.dataset.id))),
    async 'rem-doc'(alvo) { if (!(await confirmar('Remover este documento? Ele deixará de aparecer no cadastro (a remoção é registrada na auditoria).', { confirmarTexto: 'Remover', perigo: true }))) return; if (signal?.aborted || !el.isConnected) return; await documentos.remover(alvo.dataset.id); if (signal?.aborted || !el.isConnected) return; feito('Documento removido.'); },
    async 'add-doc'() {
      const input = q('#doc-arq', raiz);
      const resultado = await validarSelecaoUpload(input, 'documento');
      if (signal?.aborted || !el.isConnected) return;
      if (!resultado.valido) { mostrarMensagem(q('#msg', raiz), `Documento: ${resultado.erro ?? 'Seleção inválida.'}`); input.focus(); return; }
      const arquivo = resultado.arquivos[0];
      if (!arquivo) return mostrarMensagem(q('#msg', raiz), 'Selecione um arquivo para anexar.');
      marcarUpload(input, true);
      try { await documentos.adicionar(id, q('#doc-tipo', raiz).value, arquivo); feito('Documento anexado.'); }
      finally { if (el.isConnected) marcarUpload(input, false); }
    },
    async 'remover-foto'() { if (typeof devedores.removerFotoDoCadastro !== 'function') throw new Error('Remoção de foto indisponível.'); if (!(await confirmar('Remover a foto deste cadastro?', { confirmarTexto: 'Remover', perigo: true }))) return; if (signal?.aborted || !el.isConnected) return; await devedores.removerFotoDoCadastro(id, d.foto_path); if (signal?.aborted || !el.isConnected) return; feito('Foto removida.'); },
    retry: recarregar,
    async 'mais-historico'(alvo) { const lista = q('#historico', raiz); if (!lista) return; const mais = await auditoria.listarPorDevedor(id, { limite: POR_PAGINA_HISTORICO, offset: lista.children.length }); if (signal?.aborted || !el.isConnected || !lista.isConnected) return; lista.insertAdjacentHTML('beforeend', mais.map((m) => itemHistorico(m, ctxHist)).join('')); if (mais.length < POR_PAGINA_HISTORICO) alvo.remove(); },
  };
  el.addEventListener('click', async (ev) => { const alvo = ev.target.closest('[data-acao]'); if (!alvo || !acoes[alvo.dataset.acao] || signal?.aborted || !el.isConnected) return; mostrarMensagem(q('#msg', raiz), ''); alvo.disabled = true; try { await acoes[alvo.dataset.acao](alvo); } catch (e) { falha(e); } finally { if (el.isConnected) alvo.disabled = false; } });
  q('#foto-nova', raiz)?.addEventListener('change', async (ev) => {
    const input = ev.target;
    const estado = input._uploadState;
    const token = estado?.generation;
    try { await estado?.promise; } catch { return; }
    if (signal?.aborted || !el.isConnected || input._uploadState !== estado || estado?.generation !== token || estado?.pendente || !estado?.valido) return;
    const arquivo = arquivosDoUpload(input)[0];
    if (!arquivo) return;
    try {
      marcarUpload(input, true);
      await devedores.definirFoto(id, arquivo, d.foto_path);
      if (signal?.aborted || !el.isConnected || input._uploadState !== estado || estado.generation !== token) return;
      feito('Foto atualizada.');
    } catch (e) { falha(e); }
    finally { if (el.isConnected) marcarUpload(input, false); }
  });
}
