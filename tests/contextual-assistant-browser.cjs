// Requires a temporary /context-test page rendering CreateRecord with a synthetic client.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const width of [390,1366]){
  const page=await browser.newPage({viewport:{width,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));let pending=null;
  await page.route('**/api/ai/context',route=>{pending=route;});
  await page.goto((process.env.TEST_BASE_URL||'http://127.0.0.1:3210')+'/context-test');
  const description=page.getByLabel('Descrição',{exact:true});
  await description.fill('Vi óleo perto do filtro.');
  await page.getByRole('button',{name:'Conversar com IA neste relato'}).click();
  await page.getByRole('button',{name:'Nova conversa',exact:true}).click();
  await page.getByLabel('Título da conversa',{exact:true}).fill('Revisão do relato');
  await page.getByRole('button',{name:'Criar conversa',exact:true}).click();
  await page.getByLabel('Pedido à IA',{exact:true}).fill('Organize este relato');
  await page.getByRole('button',{name:'Enviar à IA',exact:true}).click();
  await page.getByRole('button',{name:'Processando…'}).waitFor();
  for(let i=0;!pending&&i<100;i++)await new Promise(r=>setTimeout(r,50));assert.ok(pending,'request did not arrive');
  const request=pending.request().postDataJSON();assert.equal(request.context.fields.description,'Vi óleo perto do filtro.');assert.equal(request.context.prefix,'PR-TEST');
  await pending.fulfill({json:{contextId:request.context.id,reply:'Preparei uma sugestão para revisão.',proposal:{title:'Evidência de óleo',description:'Foi observada evidência de óleo próximo ao filtro.'},sources:[]}});pending=null;
  await page.getByRole('button',{name:'Aplicar ao rascunho',exact:true}).click();
  assert.equal(await description.inputValue(),'Foi observada evidência de óleo próximo ao filtro.');
  await page.getByRole('button',{name:'Desfazer última aplicação'}).click();assert.equal(await description.inputValue(),'Vi óleo perto do filtro.');
  await page.getByLabel('Pedido à IA',{exact:true}).fill('Melhore novamente');await page.getByRole('button',{name:'Enviar à IA',exact:true}).click();
  for(let i=0;!pending&&i<100;i++)await new Promise(r=>setTimeout(r,50));assert.ok(pending,'request did not arrive');
  await description.fill('Minha edição posterior');
  await pending.fulfill({json:{contextId:request.context.id,reply:'Outra proposta.',proposal:{title:null,description:'Resposta antiga'},sources:[]}});pending=null;
  await page.getByText('O rascunho mudou. Peça uma nova sugestão antes de aplicar.',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Aplicar ao rascunho',exact:true}).isDisabled(),true);
  await page.screenshot({path:`contextual-assistant-${width}.png`,fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await page.getByRole('button',{name:'Fechar assistente do relato'}).click();await page.getByRole('button',{name:/Revisão do relato/}).click();await page.getByText('Outra proposta.',{exact:false}).waitFor();
  assert.deepEqual(errors,[]);await page.close();console.log('PASS contextual draft',width);
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
