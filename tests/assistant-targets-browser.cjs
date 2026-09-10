const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [390,1366]){
 const page=await browser.newPage({viewport:{width,height:950}}),errors=[],conversations=[],messages=new Map();let generations=0,revoked=false,checks=0;
 page.on('pageerror',e=>errors.push(e.message));const id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
 await page.route('**/__conversations',async route=>{const {args}=route.request().postDataJSON(),p=args.p_payload;let data=[];
  if(args.p_action==='conversations')data=conversations;
  if(args.p_action==='create_conversation'){data={id:p.id,title:'Relato CHT',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),context_kind:'general'};conversations.unshift(data);messages.set(p.id,[]);}
  if(args.p_action==='list')data=messages.get(p.conversationId)||[];
  if(args.p_action==='append'){data={id:++generations,message:p.message,reply:p.reply,created_at:new Date().toISOString()};messages.get(p.conversationId).push(data);}
  await route.fulfill({json:{data,error:null}});
 });
 await page.route('**/api/ai',r=>r.fulfill({json:{reply:`Tem um relato do PR-CHT sobre o altímetro.\n\n[PR-CHT · Altímetro · Relato técnico](flight-ia://maintenance/${id})`,proposedFlights:[],sources:[]}}));
 await page.route('**/api/ai/targets?*',r=>{checks++;assert.equal(new URL(r.request().url()).searchParams.get('id'),id);return r.fulfill({status:revoked?404:200,json:revoked?{error:'Registro indisponível ou sem acesso na sua base atual.'}:{target:{kind:'maintenance',id}}});});
 await page.goto('http://localhost:3210/targets-test');await page.getByRole('button',{name:'Nova conversa',exact:true}).click();await page.getByLabel('Mensagem ao assistente').fill('E relato técnico do CHT?');await page.getByRole('button',{name:'Enviar ao assistente',exact:true}).click();
 await page.getByRole('button',{name:'Abrir relato',exact:true}).click();await page.getByLabel('Destino aberto').filter({hasText:`maintenance:${id}`}).waitFor();assert.equal(checks,1);
 await page.getByRole('button',{name:'Voltar às conversas'}).click();await page.getByRole('button',{name:/^Relato CHT/}).click();await page.getByRole('button',{name:'Abrir relato',exact:true}).waitFor();assert.equal(generations,1);
 revoked=true;await page.getByRole('button',{name:'Abrir relato',exact:true}).click();await page.getByRole('alert').filter({hasText:'Registro indisponível'}).waitFor();assert.equal(checks,2);assert.equal(await page.getByText(/flight-ia:\/\//).count(),0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(errors,[]);await page.screenshot({path:`assistant-targets-${width}.png`,fullPage:true});await page.close();console.log('PASS persisted cards and access revalidation',width);
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
