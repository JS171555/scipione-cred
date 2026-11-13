// Não habilita modo demo na aplicação. Interceptação existe somente no navegador de teste.
// PLAYWRIGHT_MODULE pode apontar para uma instalação externa de playwright.
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const modulePath = process.env.PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const origin = process.env.UI_TEST_URL || 'http://127.0.0.1:5173';
const out = process.env.UI_TEST_OUTPUT || '.visual-test';
await mkdir(out, { recursive: true });
await mkdir('public/icons', { recursive: true });
const admin = { id: 'synthetic-admin', nome: 'Administrador de teste' };
const d = { id: '11111111-1111-4111-8111-111111111111', tipo_pessoa: 'PF', nome_razao_social: 'Cliente Sintético Alfa', cpf_cnpj: null, telefone: '1100000000', celular: '11000000000', email: 'cliente@example.test', cep: '01310100', logradouro: 'Endereço de teste', numero: '100', bairro: 'Bairro sintético', cidade: 'São Paulo', uf: 'SP', status: 'ativo', foto_path: null, created_at: '2026-11-01T12:00:00Z', total_em_aberto: 2500, total_registrado: 3000, total_pago: 500, qtd_dividas_abertas: 2, qtd_dividas_quitadas: 1 };
const v = { id: '22222222-2222-4222-8222-222222222222', devedor_id: d.id, devedor_nome: d.nome_razao_social, descricao: 'Registro financeiro sintético', valor_original: 1500, total_pago: 500, saldo: 1000, status: 'em_aberto', data_registro: '2026-11-01', data_vencimento: '2026-12-01', observacoes: null };
const p = { id: '33333333-3333-4333-8333-333333333333', divida_id: v.id, devedor_id: d.id, devedor_nome: d.nome_razao_social, divida_descricao: v.descricao, divida_status: 'em_aberto', valor: 500, data_pagamento: '2026-11-05', status: 'valido', observacao: 'Recebimento sintético', comprovante_path: null };
const vars = `const D=${JSON.stringify(d)},V=${JSON.stringify(v)},P=${JSON.stringify(p)},A=${JSON.stringify(admin)};const wait=async()=>{await new Promise(r=>setTimeout(r,window.__mockDelay||30));if(window.__mockError)throw new Error('Falha de rede simulada');};const list=(itens,opts={})=>{const filtered=(window.__mockEmpty||opts.busca==='inexistente')?[]:itens;return {itens:filtered,total:filtered.length,pagina:1,porPagina:20};};`;
const services = {
  auth: `${vars} export const obterAdmin=async()=>window.__mockAdmin===false?null:A;export const limparCache=()=>{};export const entrar=async()=>{await wait();window.__mockAdmin=true;return A;};export const sair=async()=>{window.__mockAdmin=false;};export const solicitarRecuperacao=async()=>wait();export const redefinirSenha=async()=>wait();export const temSessao=async()=>true;`,
  devedores: `${vars} export const ORDENS={nome_asc:[],nome_desc:[],recentes:[],antigos:[]};export const listarPagina=async o=>{await wait();return list([D,{...D,id:'cliente-beta',nome_razao_social:'Empresa Sintética Beta',tipo_pessoa:'PJ',status:'inativo',total_em_aberto:0}],o);};export const listar=async()=>[D];export const nomesPorId=async()=>({[D.id]:D.nome_razao_social});export const obter=async()=>{await wait();return D;};export const urlsFotos=async()=>({});export const urlFoto=async()=>null;export const criar=async dados=>{await wait();return {...D,...dados};};export const atualizar=async(id,dados)=>{await wait();return {...D,...dados};};export const alterarStatus=async()=>({requer_confirmacao:true,qtd_dividas_abertas:2,valor_em_aberto:2500});export const definirFoto=async()=>wait();export const removerFotoDoCadastro=async()=>wait();`,
  dashboard: `${vars} export const obterIndicadores=async()=>{await wait();return {total_devedores:2,devedores_ativos:1,devedores_inativos:1,dividas_em_aberto:2,dividas_quitadas:1,valor_total_em_aberto:2500};};export const obterTotaisFinanceiros=async()=>({totalRegistradoC:300000,totalRecebidoC:50000,totalEmAbertoC:250000});export const ultimosCadastros=async()=>window.__mockEmpty?[]:[D];`,
  dividas: `${vars} export const listarPagina=async o=>{await wait();return list([V,{...V,id:'divida-beta',descricao:'Registro de teste quitado',saldo:0,total_pago:700,valor_original:700,status:'quitada'}],o);};export const listarPorDevedor=async()=>[V,{...V,id:'divida-beta',valor_original:800,total_pago:0,saldo:800},{...V,id:'divida-gama',valor_original:700,total_pago:0,saldo:700}];export const obter=async()=>{await wait();return V;};export const registrar=async()=>{await wait();window.__writes=(window.__writes||0)+1;return V;};export const editar=async()=>wait();export const alterarValor=async()=>wait();`,
  pagamentos: `${vars} export const listarPagina=async o=>{await wait();return list([P,{...P,id:'p-beta',status:'estornado',motivo_estorno:'Correção de teste',estornado_em:'2026-11-06T12:00:00Z'}],o);};export const listarPorDevedor=async()=>[P];export const listarPorDivida=async()=>[P];export const registrar=async()=>{await wait();window.__writes=(window.__writes||0)+1;return P;};export const estornar=async()=>wait();export const urlComprovante=async()=>origin;`,
  auditoria: `${vars} const M=[{id:1,usuario_id:A.id,operacao:'INSERT',entidade:'pagamentos',entidade_id:P.id,devedor_id:D.id,dados_antes:null,dados_depois:{valor:500,data_pagamento:'2026-11-05'},created_at:'2026-11-05T12:00:00Z'},{id:2,usuario_id:A.id,operacao:'INSERT',entidade:'dividas',entidade_id:V.id,devedor_id:D.id,dados_depois:V,created_at:'2026-11-01T12:00:00Z'}];export const listarRecentes=async()=>window.__mockEmpty?[]:M;export const listarPorDevedor=async()=>M;`,
  documentos: `${vars} export const TIPOS_DOCUMENTO={identificacao:'Identificação',comprovante_endereco:'Comprovante de endereço',outro:'Outro'};export const listar=async()=>[];export const adicionar=async()=>wait();export const remover=async()=>wait();export const urlDocumento=async()=>origin;`,
  configuracoes: `export const obterLimitesUpload=async()=>({foto:5242880,documento:10485760,comprovante:10485760});`,
  viacep: `export const buscarCEP=async()=>({logradouro:'Endereço de teste',bairro:'Bairro sintético',cidade:'São Paulo',uf:'SP'});`,
};
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
await context.addInitScript(() => { window.__mockAdmin=true; });
await context.route('**/src/core/supabase.js*', route=>route.fulfill({contentType:'application/javascript',body:'export const diagnostico={ok:true};export const supabase={auth:{onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}};'}));
await context.route('**/src/services/*.js*', async route=>{
  const name=new URL(route.request().url()).pathname.split('/').at(-1).replace('.js','');
  if(services[name])return route.fulfill({contentType:'application/javascript',body:services[name]});
  return route.continue();
});
const page=await context.newPage();
let errors=[];
page.on('pageerror', e=>errors.push(e.message));
// PWA icons are deterministic renditions of the actual UI monogram.
await page.goto(origin);
await page.waitForSelector('.brand-mark');
await page.evaluate(async()=>{
  const {marca}=await import('/src/components/pagina.js');
  document.body.innerHTML=`<div id="app-icon">${marca()}</div>`;
  const style=document.createElement('style');style.textContent='#app-icon{width:512px;height:512px;background:#080808;display:grid;place-items:center}#app-icon .brand-name{display:none}#app-icon .brand-mark{width:244px;height:272px;font-size:260px;border-width:3px;border-color:#34302a;border-radius:12px}#app-icon .brand-mark span{font-size:138px;right:20px;bottom:12px}';document.head.append(style);await document.fonts.ready;
});
await page.locator('#app-icon').screenshot({path:'public/icons/icon-512.png'});
await page.setViewportSize({width:192,height:192});
await page.addStyleTag({content:'#app-icon{transform:scale(.375);transform-origin:top left}body{width:192px;height:192px;overflow:hidden}'});
await page.screenshot({path:'public/icons/icon-192.png'});
await page.goto(`${origin}/?visual-reset=1`);
const routes=[['dashboard','/','.cards'],['clientes','/devedores','#tabela table'],['cadastro','/devedores/novo','#nome_razao_social'],['perfil',`/devedores/${d.id}`,'.profile-header'],['editar',`/devedores/${d.id}/editar`,'#nome_razao_social'],['divida',`/devedores/${d.id}/dividas/nova`,'#valor'],['pagamento',`/dividas/${v.id}/pagamento`,'#saldo-apos'],['dividas','/dividas','#tabela table'],['pagamentos','/pagamentos','#tabela table'],['seletor-cliente','/dividas/nova','[data-selecao] table'],['seletor-divida','/pagamentos/novo','[data-selecao] table'],['login','/login','#senha'],['recuperar','/recuperar-senha','#email'],['redefinir','/redefinir-senha','#s1']];
const widths=[320,390,768,1024,1440];
let checks=[];
for(const width of widths){
  await page.setViewportSize({width,height:width<768?844:1000});
  for(const [name,path,selector] of routes){
    await page.evaluate((name)=>{window.__mockAdmin=name!=='login';}, name);
    await page.goto(`${origin}/#${path}`);
    if(name==='login'){await page.evaluate(()=>{window.__mockAdmin=false;location.hash='/login';});}
    try { await page.waitForSelector(selector,{timeout:10000}); }
    catch (error) { console.log('DIAGNOSTIC', name, page.url(), errors, await page.locator('body').innerText()); await page.screenshot({path:`${out}/failure.png`,fullPage:true}); throw error; }
    await page.evaluate(()=>document.fonts.ready);
    const layout=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
    const overflow=layout.document>width+1||layout.body>width+1;
    checks.push({name,width,overflow,...layout});
    if(overflow)console.log('OVERFLOW',name,width,layout);
    if(['dashboard','login','clientes','pagamento','perfil'].includes(name)&&[390,1440].includes(width)) {
      await page.evaluate(()=>{const badge=document.createElement('div');badge.id='test-only-label';badge.textContent='VALIDAÇÃO VISUAL · DADOS SINTÉTICOS';badge.style.cssText='position:fixed;bottom:80px;right:8px;z-index:100;background:#171717;color:#E8DFC9;border:1px solid #34302A;border-radius:4px;padding:5px 8px;font:9px sans-serif;pointer-events:none';document.body.append(badge);});
      await page.screenshot({path:`${out}/${name}-${width}.png`,fullPage:true});
      await page.locator('#test-only-label').evaluate(el=>el.remove());
    }
    console.log(`Visual ${name} ${width}px: ${overflow?'OVERFLOW':'OK'}`);
  }
}
// Textos longos nas atividades recentes precisam quebrar dentro do painel.
await page.setViewportSize({width:320,height:844});
await page.goto(`${origin}/#/`);await page.waitForSelector('.historico');
const estourouAtividade=await page.evaluate(()=>{
  const bloco=document.querySelector('.historico li div');
  const original=bloco.innerHTML;
  bloco.textContent='ClienteSemEspacosComNomeMuitoLongoParaConferirAQuebraDeLinhaNoMobile';
  const limite=document.documentElement.clientWidth;
  const estourou=document.documentElement.scrollWidth>limite+1;
  bloco.innerHTML=original;
  return estourou;
});
assert(!estourouAtividade,'Atividades recentes devem conter textos longos no mobile');

// Functional interaction checks use only the intercepted, in-memory services.
await page.setViewportSize({width:1440,height:1000});
await page.goto(`${origin}/#/`);await page.waitForSelector('.cards');
await page.locator('.skip-link').evaluate(el=>el.click());
assert(page.url().endsWith('#/'),'Pular conteúdo não deve trocar a rota');
assert(await page.locator('#conteudo').evaluate(el=>el===document.activeElement));
await page.locator('#recolher-menu').click();assert(await page.locator('.sidebar-collapsed').count());
await page.locator('#recolher-menu').click();
await page.goto(`${origin}/#/dividas/nova`);await page.waitForSelector('[data-selecao] table');
assert(page.url().includes('#/dividas/nova'),'Seletor deve manter hash');
await page.locator('[data-selecionar]').first().click();await page.waitForSelector('#valor');
await page.goto(`${origin}/#/pagamentos/novo`);await page.waitForSelector('[data-selecao] table');
assert(page.url().includes('#/pagamentos/novo'),'Seletor deve manter hash');
await page.locator('[data-selecionar]').first().click();await page.waitForSelector('#saldo-apos');
await page.locator('#valor').fill('100,00');assert((await page.locator('#saldo-apos').textContent()).includes('900,00'));
await page.locator('#quitar').click();assert((await page.locator('#saldo-apos').textContent()).includes('0,00'));
await page.locator('#valor').fill('1000,01');await page.locator('#salvar').click();assert((await page.locator('#msg').textContent()).includes('maior que o saldo'));
await page.goto(`${origin}/#/devedores/novo`);await page.waitForSelector('#nome_razao_social');
await page.locator('#salvar').click();assert(await page.locator('#nome_razao_social').getAttribute('aria-invalid')==='true');
await page.locator('input[value="PJ"]').check();assert(await page.locator('#rg').isDisabled());
await page.goto(`${origin}/#/devedores`);await page.waitForSelector('#tabela table');
await page.locator('#busca').fill('inexistente');await page.waitForSelector('#tabela .empty-state');
await page.evaluate(()=>{window.__mockError=true;});await page.locator('#limpar').click();await page.waitForSelector('#tabela .error-state');
await page.evaluate(()=>{window.__mockError=false;});await page.locator('[data-retry]').click();await page.waitForSelector('#tabela table');
await page.goto(`${origin}/#/pagamentos`);await page.waitForSelector('#tabela table');
await page.evaluate(()=>{window.__mockError=true;});await page.locator('#limpar').click();await page.waitForSelector('#tabela .error-state');
await page.evaluate(()=>{window.__mockError=false;});await page.locator('[data-retry]').click();await page.waitForSelector('#tabela table');
await page.evaluate(()=>{window.__mockAdmin=false;location.hash='/login';});await page.waitForSelector('#senha');
await page.locator('[data-password-toggle]').click();assert(await page.locator('#senha').getAttribute('type')==='text');
await page.locator('button[type="submit"]').click();assert(await page.locator('#email').getAttribute('aria-invalid')==='true');
await page.locator('#email').fill('admin@example.test');await page.locator('#senha').fill('SenhaSintetica!123');await page.locator('button[type="submit"]').click();await page.waitForSelector('.cards');
await writeFile(`${out}/results.json`,JSON.stringify({synthetic:true,checks,errors,interactions:'passed'},null,2));
await browser.close();
assert(!checks.some(c=>c.overflow),'Overflow horizontal encontrado');
assert.equal(errors.length,0,`Erros no console: ${errors.join('; ')}`);
console.log(`${checks.length} verificações de layout; interações OK; nenhum erro de execução.`);
