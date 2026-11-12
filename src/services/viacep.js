import { apenasDigitos } from '../utils/cpf-cnpj.js';

/** Consulta o ViaCEP. Retorna null se inválido/inexistente/erro de rede — o preenchimento manual continua possível. */
export async function buscarCEP(cep, { fetchImpl = globalThis.fetch, timeoutMs = 6000 } = {}) {
  const d = apenasDigitos(cep);
  if (d.length !== 8) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetchImpl(`https://viacep.com.br/ws/${d}/json/`, { signal: ctrl.signal });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j || j.erro) return null;
    return { logradouro: j.logradouro ?? '', bairro: j.bairro ?? '', cidade: j.localidade ?? '', uf: j.uf ?? '', complemento: j.complemento ?? '' };
  } catch { return null; }
  finally { clearTimeout(timer); }
}
