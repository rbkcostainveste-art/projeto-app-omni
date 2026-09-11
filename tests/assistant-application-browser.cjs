const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:3010';
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [390,1366]){
 const page=await browser.newPage({viewport:{width,height:1050}});page.setDefaultTimeout(25000);const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});let mutations=[],fail=false,version=1;
 await page.route('**/api/ai/context',route=>{const body=route.request().postDataJSON();return route.fulfill({json:{contextId:body.context.id,reply:'Preparei a sugestão.',proposal:{title:'HSI miscompare',description:'HSI miscompare observed.',technical:{ata:'34'}},sources:[]}});});
 await page.route('**/api/fixture-technical',route=>{const body=route.request().postDataJSON();if(fail)return route.fulfill({json:{error:{message:'Caso alterado em outro aparelho. Reabra antes de confirmar'},data:null}});mutations.push(body);const p=body.p_payload;assert.equal(p.revision,version);version++;return route.fulfill({json:{data:{id:'11111111-1111-4111-8111-111111111111',title:p.title,data:{description:p.description},technical_case:p.case,revision:version,tc:p.tc||''},error:null}});});
 await page.route('**/api/ai',route=>route.fulfill({json:{reply:'Preparei os campos.',draftPatch:{id:'application-form',values:{title:'Título corrigido'}},sources:[]}}));
 async function load(){await page.goto(base+'/application-test',{waitUntil:'domcontentloaded',timeout:180000});await page.locator('[data-hydrated=true]').waitFor();await page.addStyleTag({content:'nextjs-portal{display:none!important}'});}
 async function open(){await page.getByRole('button',{name:'Abrir relato',exact:true}).click();await page.getByRole('button',{name:'Conversar com IA neste relato'}).click();await page.getByLabel('Pedido à IA',{exact:true}).waitFor();}
 async function send(text){await page.getByLabel('Pedido à IA',{exact:true}).fill(text);await page.getByRole('button',{name:'Enviar à IA',exact:true}).click();}
 await load();await open();await send('melhore esse relato');await page.getByRole('button',{name:'Aplicar e salvar no relato'}).waitFor();assert.equal(mutations.length,0);
 await send('coloque em ingles e aplique, procure no conhecimento geral a referencia da ata e coloqe também e ja pode escrever novo texto com correções');
 await page.getByText('Atualizei e salvei o relato. O novo texto já aparece no card; a observação original foi preservada.',{exact:true}).first().waitFor();
 await page.locator('[role="dialog"]').getByText('HSI miscompare',{exact:true}).first().waitFor();assert.equal(mutations.length,1);assert.equal(mutations[0].p_payload.case.document.ata,'34');assert.equal(mutations[0].p_payload.case.originalObservation.description,'hsi miscompaire');assert.equal(mutations[0].p_payload.case.report,'report');assert.ok(mutations[0].p_payload.case.reason);
 assert.equal(await page.getByText('Sugestão aplicada à revisão.',{exact:false}).count(),0);console.log('PASS saved correction updates original card and preserves raw text',width);
 await page.screenshot({path:`tmp/assistant-application-saved-${width}.png`});
 // Failed persistence preserves the original card and a retryable proposal.
 await load();version=1;mutations=[];fail=true;await open();await send('Traduza e aplique');await page.getByRole('alert').filter({hasText:'Caso alterado'}).first().waitFor();assert.equal(mutations.length,0);await page.locator('[role="dialog"]').getByText('hsi miscompaire',{exact:true}).first().waitFor();fail=false;await page.getByRole('button',{name:'Aplicar e salvar no relato'}).click();await page.getByText('Atualizei e salvei o relato.',{exact:false}).first().waitFor();assert.equal(mutations.length,1);console.log('PASS failed save and retry',width);
 // Cancelled signature does not claim application or invoke update.
 await load();version=1;mutations=[];await page.getByLabel('Autorizar assinatura').uncheck();await open();await send('Traduza e aplique');await page.getByRole('alert').filter({hasText:'A alteração não foi confirmada'}).first().waitFor();assert.equal(mutations.length,0);console.log('PASS cancelled authorization',width);
 // Explicit draft-only instructions remain draft-only and can be undone.
 await load();await open();await send('Pode aplicar a correção sem salvar o registro');await page.getByText('Preenchi a revisão, sem salvar, como solicitado.',{exact:false}).first().waitFor();assert.equal(mutations.length,0);await page.getByRole('button',{name:'Desfazer última aplicação'}).click();await page.getByText('Aplicação desfeita no rascunho.',{exact:true}).waitFor();console.log('PASS draft-only and undo',width);
 for(const mode of ['draft','saved','failed','noop']){
  await load();await page.getByLabel('Modo do teste').selectOption(mode);await page.getByRole('button',{name:'Preencher ou conversar com IA'}).click();await page.getByLabel('Mensagem ao assistente').fill('Corrija o título e aplique');await page.getByRole('button',{name:'Enviar ao assistente',exact:true}).click();
  if(mode==='failed'){await page.getByText('Não apliquei a sugestão: Gravação recusada pelo servidor.',{exact:true}).waitFor();assert.equal(await page.getByLabel('Título do formulário').inputValue(),'Original');}
  else if(mode==='noop'){await page.getByText('Não apliquei a sugestão: Os campos não foram atualizados.',{exact:false}).waitFor();assert.equal(await page.getByLabel('Título do formulário').inputValue(),'Original');}
  else {await page.getByText(mode==='saved'?'Alteração salva e confirmada pelo servidor.':'Campos preenchidos no formulário. O registro ainda não foi salvo.',{exact:true}).first().waitFor();assert.equal(await page.getByLabel('Título do formulário').inputValue(),'Título corrigido');}
  console.log('PASS shared sector form',mode,width);
 }
 assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.close();
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
