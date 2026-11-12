import { esc } from '../core/dom.js';
import { descreverMovimentacao } from '../domain/movimentacoes.js';
import { formatarDataHora } from '../utils/dates.js';

/** Item do histórico (auditoria). `contexto`: { dividas: Map id→descrição, admin, nomes: {devedorId→nome} }. */
export function itemHistorico(m, contexto = {}) {
  const descricaoDivida = contexto.dividas?.get(m.dados_depois?.divida_id ?? m.entidade_id);
  const { titulo, detalhe } = descreverMovimentacao(m, { descricaoDivida });
  const quem = contexto.admin && m.usuario_id === contexto.admin.id ? contexto.admin.nome : (m.usuario_id ? 'Outro usuário' : 'Sistema');
  const devedor = contexto.nomes?.[m.devedor_id];
  return `<li><div><strong>${esc(titulo)}</strong>${detalhe ? ` — ${esc(detalhe)}` : ''}${devedor ? ` · <a href="#/devedores/${esc(m.devedor_id)}">${esc(devedor)}</a>` : ''}</div>
    <small>${esc(formatarDataHora(m.created_at))} · ${esc(quem)}</small></li>`;
}
