import { pagina } from '../components/pagina.js';
import * as devedores from '../services/devedores.js';
import * as documentos from '../services/documentos.js';
import { TIPOS_DOCUMENTO } from '../services/documentos.js';
import { buscarCEP } from '../services/viacep.js';
import { validarDevedor, UFS } from '../domain/devedor.js';
import { formatarDocumento, formatarTelefone, formatarCEP } from '../utils/cpf-cnpj.js';
import { traduzirErro } from '../core/errors.js';
import { esc, $, mostrarMensagem, ocupado } from '../core/dom.js';
import { navegar, definirAviso } from '../core/router.js';

const CAMPOS = ['nome_razao_social', 'cpf_cnpj', 'rg', 'telefone', 'celular', 'email', 'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'observacoes'];
const campo = (id, rotulo, extra = '') => `<label>${rotulo}<input id="${id}" name="${id}" ${extra}><span class="erro-campo" data-erro="${id}"></span></label>`;

/** Cadastro (/devedores/novo) e edição (/devedores/:id/editar). */
export async function renderDevedorForm(raiz, { params }) {
  const editando = Boolean(params.id);
  const el = pagina(raiz, { titulo: editando ? 'Editar devedor' : 'Novo devedor', voltar: editando ? { href: `/devedores/${params.id}`, texto: 'Voltar ao devedor' } : { href: '/devedores', texto: 'Devedores' } });
  let atual = null;
  if (editando) {
    atual = await devedores.obter(params.id);
    if (!atual) { el.textContent = 'Devedor não encontrado.'; return; }
  }
  el.innerHTML = `<form id="form" novalidate>
    <fieldset><legend>Tipo de pessoa</legend>
      <label class="inline"><input type="radio" name="tipo_pessoa" value="PF"> Pessoa física</label>
      <label class="inline"><input type="radio" name="tipo_pessoa" value="PJ"> Pessoa jurídica</label></fieldset>
    <div class="grade">
      ${campo('nome_razao_social', '<span id="rot-nome">Nome completo</span>', 'required maxlength="200" autocomplete="off"')}
      ${campo('cpf_cnpj', '<span id="rot-doc">CPF</span> (opcional)', 'inputmode="numeric" autocomplete="off"')}
      ${campo('rg', 'RG (quando aplicável)', 'maxlength="30"')}
      ${campo('telefone', 'Telefone', 'inputmode="tel" autocomplete="off"')}
      ${campo('celular', 'Celular', 'inputmode="tel" autocomplete="off"')}
      ${campo('email', 'E-mail (opcional)', 'type="email" maxlength="200"')}
    </div>
    <h2>Endereço</h2>
    <div class="grade">
      ${campo('cep', 'CEP', 'inputmode="numeric" maxlength="9"')}
      ${campo('logradouro', 'Logradouro')}${campo('numero', 'Número', 'maxlength="20"')}${campo('complemento', 'Complemento')}
      ${campo('bairro', 'Bairro')}${campo('cidade', 'Cidade')}
      <label>UF<select id="uf" name="uf"><option value="">—</option>${UFS.map((u) => `<option>${u}</option>`).join('')}</select><span class="erro-campo" data-erro="uf"></span></label>
    </div>
    <p class="msg" id="cep-msg" role="status" hidden></p>
    <label>Observações<textarea id="observacoes" rows="3"></textarea></label>
    ${editando ? '' : `<h2>Foto e documentos (opcional)</h2><div class="grade">
      <label>Foto (PNG, JPG, JPEG, AVIF)<input type="file" id="foto" accept=".png,.jpg,.jpeg,.avif"></label>
      <label>Tipo dos documentos<select id="doc-tipo">${Object.entries(TIPOS_DOCUMENTO).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></label>
      <label>Documentos (PNG, JPG, JPEG, AVIF, WEBP, PDF)<input type="file" id="docs" multiple accept=".png,.jpg,.jpeg,.avif,.webp,.pdf"></label></div>`}
    <p class="msg erro" id="msg" role="alert" hidden></p>
    <div class="acoes"><a class="btn sec" href="#${editando ? `/devedores/${esc(params.id)}` : '/devedores'}">Cancelar</a><button type="submit" id="salvar">${editando ? 'Salvar alterações' : 'Cadastrar'}</button></div>
  </form>`;

  const tipoAtual = () => (document.querySelector('input[name=tipo_pessoa]:checked')?.value ?? 'PF');
  const atualizarRotulos = () => {
    const pj = tipoAtual() === 'PJ';
    $('#rot-nome').textContent = pj ? 'Razão social' : 'Nome completo';
    $('#rot-doc').textContent = pj ? 'CNPJ' : 'CPF';
  };
  const preencher = (d) => { for (const c of CAMPOS) $(`#${c}`).value = d?.[c] ?? ''; };
  document.querySelector(`input[name=tipo_pessoa][value=${atual?.tipo_pessoa ?? 'PF'}]`).checked = true;
  if (atual) {
    preencher({ ...atual, cpf_cnpj: formatarDocumento(atual.cpf_cnpj), telefone: formatarTelefone(atual.telefone), celular: formatarTelefone(atual.celular), cep: formatarCEP(atual.cep) });
  }
  atualizarRotulos();
  document.querySelectorAll('input[name=tipo_pessoa]').forEach((r) => r.addEventListener('change', atualizarRotulos));
  $('#cpf_cnpj').addEventListener('blur', (e) => { e.target.value = formatarDocumento(e.target.value); });
  for (const id of ['telefone', 'celular']) $(`#${id}`).addEventListener('blur', (e) => { e.target.value = formatarTelefone(e.target.value); });
  $('#cep').addEventListener('input', (e) => { e.target.value = formatarCEP(e.target.value); });
  $('#cep').addEventListener('blur', async (e) => {
    const cep = e.target.value.replace(/\D/g, '');
    if (cep.length !== 8) return;
    const r = await buscarCEP(cep);
    if (!r) return mostrarMensagem($('#cep-msg'), 'CEP não encontrado ou serviço indisponível. Preencha o endereço manualmente.', 'erro');
    mostrarMensagem($('#cep-msg'), 'Endereço preenchido pelo CEP. Você pode ajustar os campos.', 'ok');
    for (const k of ['logradouro', 'bairro', 'cidade', 'uf']) if (r[k]) $(`#${k}`).value = r[k];
    $('#numero').focus();
  });

  const limparErros = () => { document.querySelectorAll('[data-erro]').forEach((s) => { s.textContent = ''; }); mostrarMensagem($('#msg'), ''); };
  const mostrarErros = (erros) => { for (const [k, v] of Object.entries(erros)) { const s = document.querySelector(`[data-erro=${k}]`); if (s) s.textContent = v; } };

  $('#form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    limparErros();
    const form = Object.fromEntries(CAMPOS.map((c) => [c, $(`#${c}`).value]));
    form.tipo_pessoa = tipoAtual();
    const { erros, dados } = validarDevedor(form);
    if (Object.keys(erros).length) { mostrarErros(erros); mostrarMensagem($('#msg'), 'Corrija os campos destacados.'); return; }
    const botao = $('#salvar');
    ocupado(botao, true, 'Salvando…');
    try {
      const salvo = editando ? await devedores.atualizar(params.id, dados) : await devedores.criar(dados);
      const avisos = [];
      if (!editando) {
        const foto = $('#foto').files[0];
        if (foto) await devedores.definirFoto(salvo.id, foto).catch((e) => avisos.push(`Foto: ${traduzirErro(e)}`));
        for (const arq of $('#docs').files) await documentos.adicionar(salvo.id, $('#doc-tipo').value, arq).catch((e) => avisos.push(`${arq.name}: ${traduzirErro(e)}`));
      }
      definirAviso(avisos.length ? `Devedor salvo, mas houve problemas nos anexos — ${avisos.join(' | ')}` : (editando ? 'Cadastro atualizado.' : 'Devedor cadastrado.'));
      navegar(`/devedores/${salvo.id}`);
    } catch (e) {
      const msg = traduzirErro(e);
      if (/CPF\/CNPJ/.test(msg)) mostrarErros({ cpf_cnpj: msg });
      mostrarMensagem($('#msg'), msg);
    } finally { ocupado(botao, false); }
  });
}
