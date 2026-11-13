// Não habilita modo demo na aplicação. Interceptação existe somente no navegador de teste.
// PLAYWRIGHT_MODULE pode apontar para uma instalação externa de playwright.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
// A marca é um ativo da pasta public/brand: os ícones da PWA são conferidos no tamanho final.
const dimensoesPng = (buffer) => ({ largura: buffer.readUInt32BE(16), altura: buffer.readUInt32BE(20) });
for (const [arquivo, lado] of [['public/brand/marca-96.png', 96], ['public/brand/marca-192.png', 192], ['public/icons/icon-192.png', 192], ['public/icons/icon-512.png', 512], ['public/icons/apple-touch-icon.png', 180]]) {
  const buffer = await readFile(arquivo).catch(() => null);
  assert(buffer, `Ativo de marca ausente: ${arquivo}`);
  const { largura, altura } = dimensoesPng(buffer);
  assert(largura === lado && altura === lado, `${arquivo} deve ter ${lado}x${lado} (tem ${largura}x${altura})`);
}
await page.goto(origin);
await page.waitForSelector('.brand-mark');
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
    const barras=await page.evaluate(()=>({raiz:getComputedStyle(document.documentElement).scrollbarWidth,corpo:getComputedStyle(document.body).scrollbarWidth}));
    if(width<768) assert(barras.raiz==='none'&&barras.corpo==='none',`${width}px: barras de rolagem devem estar ocultas (${barras.raiz}/${barras.corpo})`);
    else assert(barras.raiz!=='none',`${width}px: barra de rolagem deve continuar visível (${barras.raiz})`);
    if(name==='dividas'&&width<768){
      const alturas=await page.$$eval('td[data-label="Ações"] .acoes-linha > *',els=>[...new Set(els.map(e=>Math.round(e.getBoundingClientRect().height)))]);
      assert(alturas.length===1,`Botões dos cards de dívidas devem ter a mesma altura em ${width}px: ${alturas.join(', ')}`);
    }
    if(['dashboard','login','clientes','pagamento','perfil'].includes(name)&&[390,1440].includes(width)) {
      // O rótulo de dados sintéticos é o padrão; VISUAL_NO_LABEL=1 gera as capturas limpas da documentação.
      const rotular = !process.env.VISUAL_NO_LABEL;
      if (rotular) await page.evaluate(()=>{const badge=document.createElement('div');badge.id='test-only-label';badge.textContent='VALIDAÇÃO VISUAL · DADOS SINTÉTICOS';badge.style.cssText='position:fixed;bottom:80px;right:8px;z-index:100;background:#171717;color:#E8DFC9;border:1px solid #34302A;border-radius:4px;padding:5px 8px;font:9px sans-serif;pointer-events:none';document.body.append(badge);});
      await page.screenshot({path:`${out}/${name}-${width}.png`,fullPage:true});
      if (rotular) await page.locator('#test-only-label').evaluate(el=>el.remove());
    }
    console.log(`Visual ${name} ${width}px: ${overflow?'OVERFLOW':'OK'}`);
  }
}
// Diálogo com conteúdo rolável também esconde a barra no mobile.
await page.setViewportSize({width:390,height:600});
await page.goto(`${origin}/#/`);await page.waitForSelector('.cards');
await page.evaluate(()=>{window.__mockAdmin=true;});
await page.goto(`${origin}/#/`);await page.waitForSelector('#sair-mobile');
assert(await page.locator('#sair').isHidden(),'A barra lateral não deve aparecer no mobile');
await page.click('#sair-mobile');
await page.waitForSelector('dialog[open]',{timeout:5000});
assert((await page.locator('dialog[open]').innerText()).includes('Encerrar a sessão'),'Saída no mobile deve avisar antes de encerrar');
const barraDialogo=await page.evaluate(()=>getComputedStyle(document.querySelector('dialog[open]')).scrollbarWidth);
assert(barraDialogo==='none',`Diálogo rolável deve esconder a barra no mobile (${barraDialogo})`);
await page.keyboard.press('Escape');
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
await page.setViewportSize({width:1440,height:1000});
await page.goto(`${origin}/#/`);await page.waitForSelector('#sair');
await page.click('#sair');
await page.waitForSelector('dialog[open]');
assert((await page.locator('dialog[open]').innerText()).includes('Encerrar a sessão'),'Saída no desktop deve avisar antes de encerrar');
await page.locator('dialog[open] [data-n]').click();
await page.waitForTimeout(100);
assert(await page.locator('dialog[open]').count()===0,'Cancelar deve fechar o aviso de saída');
assert(page.url().includes('#/'),'Cancelar não deve encerrar a sessão');
await page.goto(`${origin}/#/devedores`);await page.waitForSelector('#tabela table');
assert(await page.locator('#filtros-painel').isHidden(),'Filtros devem nascer recolhidos no desktop');
await page.locator('#filtro-toggle').click();
assert(await page.locator('#filtros-painel').isVisible(),'Botão de filtros deve abrir o cartão no desktop');
const alinhamento=await page.evaluate(()=>{
  const medir=(seletor)=>{const b=document.querySelector(seletor).getBoundingClientRect();return {topo:Math.round(b.top),altura:Math.round(b.height)};};
  return {busca:medir('#busca'),principal:medir('.list-toolbar > .btn:not(.filtro-toggle)'),filtro:medir('#filtro-toggle')};
});
assert(alinhamento.busca.altura===alinhamento.principal.altura&&alinhamento.principal.altura===alinhamento.filtro.altura,`Botões da barra com alturas diferentes: ${JSON.stringify(alinhamento)}`);
assert(alinhamento.busca.topo===alinhamento.filtro.topo&&alinhamento.principal.topo===alinhamento.filtro.topo,`Botão de filtros desalinhado da busca/ação: ${JSON.stringify(alinhamento)}`);
await page.locator('#busca').fill('inexistente');await page.waitForSelector('#tabela .empty-state');
await page.evaluate(()=>{window.__mockError=true;});await page.locator('#limpar').click();await page.waitForSelector('#tabela .error-state');
await page.evaluate(()=>{window.__mockError=false;});await page.locator('[data-retry]').click();await page.waitForSelector('#tabela table');
await page.goto(`${origin}/#/dividas`);await page.waitForSelector('#tabela table');
const acoes=await page.$$eval('td[data-label="Ações"] .acoes-linha > *',els=>els.map(e=>`${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`));
assert(acoes.length>=5,'Lista de dívidas deve exibir as ações das linhas');
assert(new Set(acoes).size===1,`Botões de ação devem ter o mesmo tamanho: ${[...new Set(acoes)].join(', ')}`);
assert(await page.evaluate(()=>{const r=document.querySelector('#tabela .rolagem');return r.scrollWidth<=r.clientWidth+1;}),'Tabela de dívidas não deve rolar na horizontal em 1440');
await page.setViewportSize({width:1280,height:900});await page.reload();await page.waitForSelector('#tabela table');
const acoes1280=await page.$$eval('td[data-label="Ações"] .acoes-linha > *',els=>els.map(e=>`${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`));
assert(new Set(acoes1280).size===1,'Botões de ação devem manter o mesmo tamanho em 1280');
assert(await page.evaluate(()=>{const r=document.querySelector('#tabela .rolagem');return r.scrollWidth<=r.clientWidth+1;}),'Tabela de dívidas não deve rolar na horizontal em 1280');
await page.setViewportSize({width:1440,height:1000});
// Ícones de cards e de diálogos ficam centrados com o texto ao lado.
for (const largura of [1440, 1190, 390]) {
  await page.setViewportSize({ width: largura, height: 900 });
  await page.evaluate(() => { window.__mockAdmin = true; });
  await page.goto(`${origin}/#/`); await page.waitForSelector('.cards .card-top');
  const desvios = await page.evaluate(() => [...document.querySelectorAll('.card')].map((c) => {
    const rot = c.querySelector('.rot').getBoundingClientRect(); const ico = c.querySelector('.metric-icon').getBoundingClientRect();
    return { rotulo: c.querySelector('.rot').textContent.trim(), desvio: Math.round((ico.top + ico.height / 2) - (rot.top + rot.height / 2)) };
  }));
  desvios.forEach(({ rotulo, desvio }) => assert(Math.abs(desvio) <= 1, `Ícone do card "${rotulo}" desalinhado em ${largura}px (${desvio}px)`));
}
await page.setViewportSize({ width: 1440, height: 1000 });
await page.goto(`${origin}/#/devedores/${d.id}`); await page.waitForSelector('[data-acao="apagar-divida"]');
await page.locator('[data-acao="apagar-divida"]').first().click();
await page.waitForSelector('dialog[open]');
const dialogo = await page.evaluate(() => {
  const d = document.querySelector('dialog[open]');
  const ico = d.querySelector('.dialog-head .icon').getBoundingClientRect(); const tit = d.querySelector('.dialog-head h2').getBoundingClientRect();
  return { desvio: Math.round((ico.top + ico.height / 2) - (tit.top + tit.height / 2)), mesmaLinha: Math.round(ico.right) <= Math.round(tit.left) };
});
assert(Math.abs(dialogo.desvio) <= 1, `Ícone do diálogo desalinhado do título (${dialogo.desvio}px)`);
assert(dialogo.mesmaLinha, 'Ícone do diálogo deve ficar ao lado do título');
await page.keyboard.press('Escape');
// Conversão de mídia: imagem vira WebP e PDF é reotimizado antes do upload.
const midia=await page.evaluate(async()=>{
  const {prepararArquivo}=await import('/src/utils/midia.js');
  const canvas=document.createElement('canvas');canvas.width=2400;canvas.height=1600;
  const ctx=canvas.getContext('2d');const grad=ctx.createLinearGradient(0,0,2400,1600);
  grad.addColorStop(0,'#101010');grad.addColorStop(1,'#b89a62');ctx.fillStyle=grad;ctx.fillRect(0,0,2400,1600);
  for(let i=0;i<600;i+=1){ctx.fillStyle=`hsl(${(i*7)%360},45%,55%)`;ctx.fillRect((i*37)%2400,(i*53)%1600,70,45);}
  const png=await new Promise((r)=>canvas.toBlob(r,'image/png'));
  const imagem=await prepararArquivo(new File([png],'foto-teste.png',{type:'image/png'}),'foto');
  return {png:png.size,webp:imagem.arquivo.size,tipo:imagem.arquivo.type,nome:imagem.arquivo.name,convertido:imagem.convertido};
});
assert(midia.tipo==='image/webp',`Imagem deve ser convertida para WebP (recebido: ${midia.tipo})`);
assert(midia.nome==='foto-teste.webp',`Nome convertido deve ser foto-teste.webp (recebido: ${midia.nome})`);
assert(midia.convertido&&midia.webp<midia.png,`WebP (${midia.webp}) deve ser menor que o PNG (${midia.png})`);
const pdfBase64=(await page.pdf({format:'A4'})).toString('base64');
const pdf=await page.evaluate(async(b64)=>{
  const bytes=Uint8Array.from(atob(b64),(c)=>c.charCodeAt(0));
  const {prepararArquivo}=await import('/src/utils/midia.js');
  const r=await prepararArquivo(new File([bytes],'contrato.pdf',{type:'application/pdf'}),'documento');
  return {original:bytes.length,final:r.arquivo.size,tipo:r.arquivo.type};
},pdfBase64);
assert(pdf.tipo==='application/pdf','PDF deve continuar PDF depois da otimização');
assert(pdf.final<=pdf.original,`PDF otimizado (${pdf.final}) não pode ficar maior que o original (${pdf.original})`);
await page.goto(`${origin}/#/pagamentos`);await page.waitForSelector('#tabela table');
assert(await page.locator('#filtros-painel').isHidden(),'Filtros de pagamentos devem nascer recolhidos');
await page.locator('#filtro-toggle').click();
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
