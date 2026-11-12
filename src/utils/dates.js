// Datas "de calendário" (YYYY-MM-DD) sem deslocamento de fuso; "hoje" no horário de Brasília (igual ao banco).
export function hojeISO(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}

export function dataISOValida(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s ?? ''))) return false;
  const [a, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function formatarData(iso) {
  if (!iso) return '—';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

export function formatarDataHora(isoTimestamp) {
  if (!isoTimestamp) return '—';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(isoTimestamp));
}
