import { pagina } from '../components/pagina.js';
import * as devedores from '../services/devedores.js';
import * as documentos from '../services/documentos.js';
import { TIPOS_DOCUMENTO } from '../services/documentos.js';
import { buscarCEP } from '../services/viacep.js';
import { validarDevedor, UFS } from '../domain/devedor.js';
import { formatarDocumento, formatarTelefone, formatarCEP } from '../utils/cpf-cnpj.js';
import { formatarTamanho } from '../utils/files.js';
import { traduzirErro } from '../core/errors.js';
import { esc, $, mostrarMensagem, ocupado } from '../core/dom.js';
import { navegar, definirAviso } from '../core/router.js';
import { confirmar } from '../components/dialogos.js';
import { uploadField, instalarUpload, validarSelecaoUpload, marcarUpload } from '../components/upload.js';

const CAMPOS = ['nome_razao_social', 'cpf_cnpj', 'rg', 'telefone', 'celular', 'email', 'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'observacoes'];
const q = (sel, raiz) => $(sel, raiz);
const campo = (id, rotulo, extra = '') => `<div class="field" id="${id}-field"><label for="${id}">${rotulo}
  <input id="${id}" name="${id}" aria-describedby="${id}-erro" ${extra}></label>
  <p class="erro-campo" id="${id}-erro" data-erro="${id}" role="alert" hidden></p></div>`;

const valorAtual = (d, id) => d?.[id] ?? '';

/** Cadastro (/devedores/novo) e edição (/devedores/:id/editar). */
export async function renderDevedorForm(raiz, { params, admin, signal } = {}) {
  if (signal?.aborted) return;
  const editando = Boolean(params?.id);
  const el = pagina(raiz, {
    titulo: editando ? 'Editar cliente' : 'Novo cliente',
    descricao: editando ? 'Atualize os dados e os anexos do cadastro.' : 'Registre um cliente para acompanhar seus compromissos.',
    voltar: editando ? { href: `/devedores/${params.id}`, texto: 'Voltar ao cliente' } : { href: '/devedores', texto: 'Clientes' },
    admin,
  });
  let atual = null;
  let docsAtuais = [];
  let fotoAtualUrl = null;
  if (editando) {
    atual = await devedores.obter(params.id);
    if (signal?.aborted || !el.isConnected) return;
    if (!atual) { el.innerHTML = '<div class="error-state" role="alert"><h2>Cliente não encontrado.</h2><a class="btn sec" href="#/devedores">Voltar para clientes</a></div>'; return; }
    docsAtuais = await Promise.resolve(documentos.listar(params.id)).catch(() => []) ?? [];
    if (signal?.aborted || !el.isConnected) return;
    if (atual.foto_path && typeof devedores.urlFoto === 'function') fotoAtualUrl = await Promise.resolve(devedores.urlFoto(atual.foto_path)).catch(() => null);
    if (signal?.aborted || !el.isConnected) return;
  }
  const documentosAtuais = editando && docsAtuais.length ? `<div class="form-subsection">
      <h3 class="form-section-title">Documentos já anexados</h3>
      <ul class="upload-list">${docsAtuais.map((doc) => `<li><span><strong>${esc(TIPOS_DOCUMENTO[doc.tipo] ?? doc.tipo)}</strong><small>${esc(doc.nome_original)} · ${formatarTamanho(doc.tamanho_bytes)}</small></span><button type="button" class="btn sec peq" data-remover-doc="${esc(doc.id)}">Remover</button></li>`).join('')}</ul>
    </div>` : '';
  const fotoAtual = fotoAtualUrl ? `<div class="upload-current"><img src="${esc(fotoAtualUrl)}" alt="Foto atual de ${esc(atual.nome_razao_social)}"><button type="button" class="btn sec peq" data-remover-foto>Remover foto</button></div>` : '<p class="upload-meta">Nenhuma foto cadastrada.</p>';

  el.innerHTML = `<form id="form" class="form-panel" novalidate>
    <div class="form-top">
      <div class="form-summary"><span class="auth-eyebrow">${editando ? 'Cadastro existente' : 'Novo cadastro'}</span><strong>${editando ? 'Dados do cliente' : 'Identificação inicial'}</strong><small>Campos com validação local e regras preservadas no banco.</small>${editando ? `<p class="profile-link"><a href="#/devedores/${esc(params.id)}">Ver perfil do cliente</a></p>` : ''}</div>
      <section class="form-photo-card" aria-labelledby="foto-titulo">
        <h2 class="form-section-title" id="foto-titulo">Foto do cliente</h2>
        ${editando ? fotoAtual : ''}
        ${uploadField({ id: 'foto', label: editando ? 'Substituir foto' : 'Selecionar foto', categoria: 'foto', accept: '.png,.jpg,.jpeg,.avif', help: 'PNG, JPG, JPEG ou AVIF · limite conforme configuração.' })}
      </section>
    </div>
    <section class="form-section" aria-labelledby="identificacao-titulo">
      <h2 class="form-section-title" id="identificacao-titulo">Identificação</h2>
      <fieldset class="choice-field"><legend>Tipo de pessoa</legend>
        <label class="choice"><input type="radio" name="tipo_pessoa" value="PF"> <span>Pessoa física</span></label>
        <label class="choice"><input type="radio" name="tipo_pessoa" value="PJ"> <span>Pessoa jurídica</span></label>
      </fieldset>
      <div class="form-grid">
        ${campo('nome_razao_social', '<span id="rot-nome">Nome completo</span>', 'required maxlength="200" autocomplete="off"')}
        ${campo('cpf_cnpj', '<span id="rot-doc">CPF</span> <small>(opcional)</small>', 'inputmode="numeric" autocomplete="off"')}
        ${campo('rg', 'RG', 'maxlength="30" autocomplete="off"')}
      </div>
      <p class="field-note">CPF ou CNPJ é opcional; quando informado, será validado conforme o tipo de pessoa.</p>
    </section>
    <section class="form-section" aria-labelledby="contato-titulo">
      <h2 class="form-section-title" id="contato-titulo">Contato</h2>
      <div class="form-grid">${campo('telefone', 'Telefone', 'inputmode="tel" autocomplete="tel"')}${campo('celular', 'Celular', 'inputmode="tel" autocomplete="tel"')}${campo('email', 'E-mail <small>(opcional)</small>', 'type="email" maxlength="200" autocomplete="email"')}</div>
    </section>
    <section class="form-section" aria-labelledby="endereco-titulo">
      <h2 class="form-section-title" id="endereco-titulo">Endereço</h2>
      <div class="form-grid">
        ${campo('cep', 'CEP', 'inputmode="numeric" maxlength="9" autocomplete="postal-code"')}
        ${campo('logradouro', 'Logradouro', 'autocomplete="street-address"')}${campo('numero', 'Número', 'maxlength="20"')}${campo('complemento', 'Complemento')}
        ${campo('bairro', 'Bairro')}${campo('cidade', 'Cidade', 'autocomplete="address-level2"')}
        <div class="field"><label for="uf">UF<select id="uf" name="uf" aria-describedby="uf-erro"><option value="">—</option>${UFS.map((u) => `<option value="${u}">${u}</option>`).join('')}</select></label><p class="erro-campo" id="uf-erro" data-erro="uf" role="alert" hidden></p></div>
      </div>
      <p class="msg" id="cep-msg" role="status" aria-live="polite" hidden></p>
      <p class="field-note">O preenchimento pelo ViaCEP é uma sugestão editável. Em caso de falha, preencha manualmente.</p>
    </section>
    <section class="form-section" aria-labelledby="observacoes-titulo">
      <h2 class="form-section-title" id="observacoes-titulo">Observações</h2>
      <label for="observacoes">Notas internas<textarea id="observacoes" name="observacoes" rows="4" aria-describedby="observacoes-erro">${esc(valorAtual(atual, 'observacoes'))}</textarea></label><p class="erro-campo" id="observacoes-erro" data-erro="observacoes" role="alert" hidden></p>
    </section>
    <section class="form-section upload-section" aria-labelledby="documentos-titulo">
      <div class="section-heading"><h2 class="form-section-title" id="documentos-titulo">Documentos</h2><small>Opcional · acesso por links temporários</small></div>
      <p class="field-note">Anexe identificação, comprovante de endereço ou outros arquivos do cliente.</p>
      <div class="docs-grid">
        <div class="field"><label for="doc-tipo">Tipo de documento<select id="doc-tipo">${Object.entries(TIPOS_DOCUMENTO).map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join('')}</select></label></div>
        ${uploadField({ id: 'docs', label: 'Selecionar documentos', categoria: 'documento', multiple: true, accept: '.png,.jpg,.jpeg,.avif,.webp,.pdf', help: 'PNG, JPG, JPEG, AVIF, WEBP ou PDF · limite conforme configuração.' })}
      </div>
      ${documentosAtuais}
    </section>
    <p class="msg erro" id="msg" role="alert" aria-live="assertive" hidden></p>
    <div class="form-actions"><a class="btn sec" href="#${editando ? `/devedores/${esc(params.id)}` : '/devedores'}">Cancelar</a><button type="submit" id="salvar" class="btn-primary">${editando ? 'Salvar alterações' : 'Cadastrar cliente'}</button></div>
  </form>`;

  const tipoAtual = () => q('input[name=tipo_pessoa]:checked', raiz)?.value ?? 'PF';
  const atualizarRotulos = () => {
    const pj = tipoAtual() === 'PJ';
    q('#rot-nome', raiz).textContent = pj ? 'Razão social' : 'Nome completo';
    q('#rot-doc', raiz).textContent = pj ? 'CNPJ' : 'CPF';
    const rg = q('#rg', raiz); const rgField = q('#rg-field', raiz);
    rg.disabled = pj; rgField.hidden = pj; rgField.setAttribute('aria-hidden', String(pj));
    if (pj) { rg.value = ''; rg.removeAttribute('aria-invalid'); }
  };
  const preencher = (d) => {
    for (const id of CAMPOS) {
      const input = q(`#${id}`, raiz);
      if (input) input.value = d?.[id] ?? '';
    }
  };
  q(`input[name=tipo_pessoa][value=${atual?.tipo_pessoa ?? 'PF'}]`, raiz).checked = true;
  if (atual) preencher({ ...atual, cpf_cnpj: formatarDocumento(atual.cpf_cnpj), telefone: formatarTelefone(atual.telefone), celular: formatarTelefone(atual.celular), cep: formatarCEP(atual.cep) });
  atualizarRotulos();
  raiz.querySelectorAll('input[name=tipo_pessoa]').forEach((radio) => radio.addEventListener('change', atualizarRotulos));
  q('#cpf_cnpj', raiz).addEventListener('blur', (e) => { e.target.value = formatarDocumento(e.target.value); });
  for (const id of ['telefone', 'celular']) q(`#${id}`, raiz).addEventListener('blur', (e) => { e.target.value = formatarTelefone(e.target.value); });
  q('#cep', raiz).addEventListener('input', (e) => { e.target.value = formatarCEP(e.target.value); });
  q('#cep', raiz).addEventListener('blur', async (e) => {
    const cep = e.target.value.replace(/\D/g, '');
    if (cep.length !== 8) return;
    const r = await buscarCEP(cep);
    if (signal?.aborted || !el.isConnected) return;
    if (!r) return mostrarMensagem(q('#cep-msg', raiz), 'CEP não encontrado ou serviço indisponível. Preencha o endereço manualmente.', 'erro');
    mostrarMensagem(q('#cep-msg', raiz), 'Endereço preenchido pelo CEP. Você pode ajustar os campos.', 'ok');
    for (const k of ['logradouro', 'bairro', 'cidade', 'uf']) if (r[k]) q(`#${k}`, raiz).value = r[k];
    q('#numero', raiz).focus();
  });

  instalarUpload(q('#foto', raiz), { categoria: 'foto' });
  instalarUpload(q('#docs', raiz), { categoria: 'documento' });
  raiz.querySelector('[data-remover-foto]')?.addEventListener('click', async () => {
    if (!atual?.foto_path || typeof devedores.removerFotoDoCadastro !== 'function') return mostrarMensagem(q('#msg', raiz), 'A remoção de foto não está disponível neste ambiente.');
    if (!(await confirmar('Remover a foto deste cadastro?', { confirmarTexto: 'Remover', perigo: true }))) return;
    try {
      await devedores.removerFotoDoCadastro(params.id, atual.foto_path);
      if (signal?.aborted || !el.isConnected) return;
      definirAviso('Foto removida.');
      await renderDevedorForm(raiz, { params, admin, signal });
    } catch (e) {
      if (!signal?.aborted && el.isConnected) mostrarMensagem(q('#msg', raiz), traduzirErro(e));
    }
  });
  raiz.querySelectorAll('[data-remover-doc]').forEach((botao) => botao.addEventListener('click', async () => {
    if (!(await confirmar('Remover este documento do cadastro?', { confirmarTexto: 'Remover', perigo: true }))) return;
    try {
      await documentos.remover(botao.dataset.removerDoc);
      if (signal?.aborted || !el.isConnected) return;
      definirAviso('Documento removido.');
      await renderDevedorForm(raiz, { params, admin, signal });
    } catch (e) {
      if (!signal?.aborted && el.isConnected) mostrarMensagem(q('#msg', raiz), traduzirErro(e));
    }
  }));

  const limparErros = () => {
    raiz.querySelectorAll('[data-erro]').forEach((span) => { span.textContent = ''; span.hidden = true; });
    raiz.querySelectorAll('[aria-invalid=true]').forEach((input) => input.removeAttribute('aria-invalid'));
    mostrarMensagem(q('#msg', raiz), '');
  };
  const mostrarErros = (erros) => {
    let primeiro = null;
    for (const [id, texto] of Object.entries(erros)) {
      const input = q(`#${id}`, raiz); const span = q(`[data-erro="${id}"]`, raiz);
      if (input) { input.setAttribute('aria-invalid', 'true'); primeiro ??= input; }
      if (span) { span.textContent = texto; span.hidden = false; }
    }
    primeiro?.focus();
  };

  let submetendo = false;
  q('#form', raiz).addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (submetendo || signal?.aborted || !el.isConnected) return;
    limparErros();
    const form = Object.fromEntries(CAMPOS.map((id) => [id, q(`#${id}`, raiz)?.value ?? '']));
    form.tipo_pessoa = tipoAtual(); if (form.tipo_pessoa === 'PJ') form.rg = '';
    const { erros, dados } = validarDevedor(form);
    if (Object.keys(erros).length) { mostrarErros(erros); mostrarMensagem(q('#msg', raiz), 'Corrija os campos destacados.'); return; }
    const botao = q('#salvar', raiz); const fotoInput = q('#foto', raiz); const docsInput = q('#docs', raiz);
    submetendo = true;
    ocupado(botao, true, 'Validando anexos…');
    let fotoArquivos = []; let docsArquivos = [];
    try {
      const fotoResultado = await validarSelecaoUpload(fotoInput, 'foto');
      if (signal?.aborted || !el.isConnected) return;
      if (!fotoResultado.valido) {
        mostrarMensagem(q('#msg', raiz), `Foto: ${fotoResultado.erro ?? 'Seleção inválida.'}`);
        fotoInput.focus();
        return;
      }
      fotoArquivos = fotoResultado.arquivos;
      const docsResultado = await validarSelecaoUpload(docsInput, 'documento');
      if (signal?.aborted || !el.isConnected) return;
      if (!docsResultado.valido) {
        mostrarMensagem(q('#msg', raiz), `Documentos: ${docsResultado.erro ?? 'Seleção inválida.'}`);
        docsInput.focus();
        return;
      }
      docsArquivos = docsResultado.arquivos;
      ocupado(botao, true, 'Salvando…');
      const salvo = editando ? await devedores.atualizar(params.id, dados) : await devedores.criar(dados);
      if (signal?.aborted || !el.isConnected) return;
      const alvoId = salvo?.id ?? params.id;
      const avisos = [];
      const foto = fotoArquivos[0];
      if (foto) {
        marcarUpload(fotoInput, true);
        await devedores.definirFoto(alvoId, foto, editando ? atual.foto_path : null).catch((e) => avisos.push(`Foto: ${traduzirErro(e)}`));
        if (signal?.aborted || !el.isConnected) return;
        marcarUpload(fotoInput, false);
      }
      if (docsArquivos.length) marcarUpload(docsInput, true, 'Enviando documentos…');
      for (const arquivo of docsArquivos) {
        await documentos.adicionar(alvoId, q('#doc-tipo', raiz).value, arquivo).catch((e) => avisos.push(`${arquivo.name}: ${traduzirErro(e)}`));
        if (signal?.aborted || !el.isConnected) return;
      }
      marcarUpload(docsInput, false);
      definirAviso(avisos.length ? `Cadastro salvo, mas houve problemas nos anexos — ${avisos.join(' | ')}` : (editando ? 'Cadastro atualizado.' : 'Cliente cadastrado.'));
      navegar(`/devedores/${alvoId}`);
    } catch (e) {
      if (signal?.aborted || !el.isConnected) return;
      const msg = traduzirErro(e);
      if (/CPF\/CNPJ/i.test(msg) || /devedor cadastrado/i.test(msg)) mostrarErros({ cpf_cnpj: msg });
      mostrarMensagem(q('#msg', raiz), msg);
    } finally {
      submetendo = false;
      if (el.isConnected) { ocupado(botao, false); marcarUpload(fotoInput, false); marcarUpload(docsInput, false); }
    }
  });
}
