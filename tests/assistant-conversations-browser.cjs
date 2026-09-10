const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [390,1366]){
 const page=await browser.newPage({viewport:{width,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));const conversations=[],messages=new Map();let generations=0;
 await page.route('**/__conversations',async route=>{const {args}=route.request().postDataJSON(),p=args.p_payload;assert.equal(p.employee,'TEST');let data=[];
  if(args.p_action==='conversations')data=conversations;
  if(args.p_action==='create_conversation'){data={id:p.id,title:p.title,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),context_kind:'general'};conversations.unshift(data);messages.set(p.id,[]);}
  if(args.p_action==='list'){assert.ok(messages.has(p.conversationId));data=messages.get(p.conversationId);}
  if(args.p_action==='append'){assert.ok(messages.has(p.conversationId));data={id:generations,message:p.message,reply:p.reply,created_at:new Date().toISOString()};messages.get(p.conversationId).push(data);}
  await route.fulfill({json:{data,error:null}});
 });
 await page.route('**/api/ai',async route=>{generations++;const id=route.request().headers()['x-conversation-id'];assert.ok(messages.has(id));const body=route.request().postDataJSON();assert.equal(body.context.conversationHistory,undefined);await route.fulfill({json:{reply:`Resposta para ${body.message}`,proposedFlights:[],sources:[]}});});
 await page.goto((process.env.TEST_BASE_URL||'http://127.0.0.1:3210')+'/conversations-test');
 await page.getByRole('button',{name:'Nova conversa',exact:true}).waitFor();assert.equal(conversations.length,0);
 async function create(title){await page.getByRole('button',{name:'Nova conversa',exact:true}).click();await page.getByLabel('Título da conversa',{exact:true}).fill(title);await page.getByRole('button',{name:'Criar conversa',exact:true}).click();await page.getByLabel('Mensagem ao assistente').waitFor();}
 async function send(text){await page.getByLabel('Mensagem ao assistente').fill(text);await page.getByRole('button',{name:'Enviar ao assistente',exact:true}).click();await page.getByText(`Resposta para ${text}`,{exact:true}).waitFor();}
 await create('Relato CHT');await send('Tema A');await page.getByRole('button',{name:'Voltar às conversas'}).click();
 await create('Secagens');assert.equal(await page.getByText('Resposta para Tema A',{exact:true}).count(),0);await send('Tema B');await page.getByRole('button',{name:'Voltar às conversas'}).click();
 await page.getByRole('button',{name:/Relato CHT/}).click();await page.getByText('Resposta para Tema A',{exact:true}).waitFor();assert.equal(await page.getByText('Resposta para Tema B',{exact:true}).count(),0);
 await page.getByRole('button',{name:'Voltar às conversas'}).click();assert.equal(conversations.length,2);assert.equal(generations,2);
 await page.screenshot({path:`assistant-conversations-${width}.png`,fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);await page.close();console.log('PASS conversations',width);
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
