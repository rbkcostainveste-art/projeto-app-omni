const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});try{for(const width of [390,1366]){
 const page=await browser.newPage({viewport:{width,height:950}}),errors=[],conversations=[],entries=[],updates=[];
 page.setDefaultTimeout(12000); page.on('pageerror',e=>errors.push(e.message));let consults=0,transcriptions=0,fail=false;
 await page.route('**/__technical_test',async route=>{const {args}=route.request().postDataJSON();let data=[];const p=args.p_payload||{};
  if(args.p_action==='config')data={revision:1,permissions:{},data:{procedures:[],cdlEnabled:false}};
  if(args.p_action==='conversations')data=conversations;
  if(args.p_action==='create_conversation'){data={id:p.id,title:p.title,context_kind:p.contextKind,context_id:p.contextId,context_label:p.contextLabel,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};conversations.push(data);}
  if(args.p_action==='list')data=entries;
  if(args.p_action==='append'){data={id:entries.length+1,...p,created_at:new Date().toISOString()};entries.push(data);}
  if(args.p_action==='update'){updates.push(p);data={};}
  await route.fulfill({json:{data,error:null}});
 });
 await page.route('**/api/ai/transcribe',r=>{transcriptions++;return r.fulfill({json:{text:'Corrija o texto PR-CHT'}});});
 await page.route('**/api/ai/context',r=>{consults++;const p=r.request().postDataJSON();assert.equal(p.context.record.id,'00000000-0000-4000-8000-000000000123');assert.equal(p.context.record.revision,1);return r.fulfill({status:fail?502:200,json:fail?{error:'Consulta indisponível'}:{contextId:p.context.id,reply:'Organizei o texto para revisão.',proposal:{title:'HSI intermitente em voo',description:'Intermitência observada no HSI.'},sources:[]}});});
 await page.goto((process.env.TEST_BASE_URL||'http://localhost:3210')+'/technical-test');
 await page.getByRole('button',{name:'Conversar com IA neste relato',exact:true}).click();
 await page.getByRole('button',{name:'Nova conversa',exact:true}).click();await page.getByRole('button',{name:'Criar conversa',exact:true}).click();
 const input=page.getByLabel('Pedido à IA',{exact:true});
 assert.equal(await page.getByLabel('Modo de envio do áudio').inputValue(),'review');
 async function record(){await page.getByRole('button',{name:'Gravar áudio',exact:true}).click();await page.getByRole('button',{name:'Enviar gravação',exact:true}).waitFor();await page.waitForTimeout(1100);await page.getByRole('button',{name:'Enviar gravação',exact:true}).click();}
 await record();await page.getByText('Transcrição pronta. Confira o texto e toque em enviar.',{exact:true}).waitFor();assert.equal(consults,0);assert.equal(await input.inputValue(),'Corrija o texto PR-CHT');
 await page.getByRole('button',{name:'Enviar à IA',exact:true}).click();await page.getByRole('button',{name:'Aplicar ao rascunho',exact:true}).click();
 assert.equal(updates.length,0);assert.equal(await page.getByLabel('Descrição',{exact:true}).inputValue(),'Intermitência observada no HSI.');
 await page.getByRole('button',{name:'Desfazer última aplicação'}).click();assert.equal(await page.getByLabel('Descrição',{exact:true}).inputValue(),'Sintoma observado');
 await page.getByLabel('Modo de envio do áudio').selectOption('auto');fail=true;await record();await page.getByText('Consulta indisponível',{exact:true}).waitFor();assert.equal(await input.inputValue(),'Corrija o texto PR-CHT');assert.equal(await page.getByRole('button',{name:'Tentar transcrever novamente'}).count(),0);
 fail=false;await page.getByRole('button',{name:'Enviar à IA',exact:true}).click();await page.getByRole('button',{name:'Aplicar ao rascunho',exact:true}).click();assert.equal(transcriptions,2);
 await page.getByLabel('Justificativa da alteração / confirmação').fill('Correção de redação revisada');await page.getByRole('button',{name:'Confirmar atualização',exact:true}).click();await page.getByText('Confirmação registrada',{exact:true}).waitFor();assert.equal(updates.length,1);assert.equal(updates[0].revision,1);assert.equal(updates[0].description,'Intermitência observada no HSI.');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(errors,[]);await page.screenshot({path:`contextual-record-audio-${width}.png`,fullPage:true});await page.close();console.log('PASS saved record and contextual audio',width);
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
