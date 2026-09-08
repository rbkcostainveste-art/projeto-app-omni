const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [390,820,1366]){
 const page=await browser.newPage({viewport:{width,height:900}});let rows=[],revision=1;const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/__cockpit_test',async route=>{const {name,args}=route.request().postDataJSON();let data={};
  if(name==='get_flight_position')data={history:[]};
  if(name==='get_flight_operation')data={events:[{type:'engine1_on',at:'2026-09-08T10:00:00Z'}],counters:[{key:'engine1_minutes',label:'Motor 1 · funcionamento',value:revision===1?25:26,unit:'Minutos',inProgress:false}],checks:{fuel:{kind:'fuel',targetFlightId:'flight-test',approval:{actor:'M1',at:'2026-09-08T10:00:00Z',result:'ok'}}},revision,first:true,day:'2026-09-08',canPilot:true,canSign:false};
  if(name==='cockpit'){if(args.p_action==='technical_history')data=[];if(args.p_action==='list')data=rows;if(args.p_action==='save'){const p=args.p_payload;data={id:p.id,kind:'counter',flight_id:p.flightId,revision:(p.revision||0)+1,data:{...p.data,title:'Motor 1 · funcionamento',current:Number(p.data.previous)+(revision===1?25:26)},updated_at:new Date().toISOString()};rows=[data];}}
  await route.fulfill({json:{data,error:null}});
 });
 await page.goto('http://localhost:3010/counters-test');const counters=page.locator('details').filter({has:page.locator('summary',{hasText:'Contadores do voo'})});await counters.locator('summary').click();
 await counters.getByRole('button',{name:'Registrar leitura'}).click();await counters.getByLabel('Valor anterior do contador').fill('100');await counters.getByRole('button',{name:'Salvar leitura'}).click();await counters.getByText('Conferido · acumulado 125',{exact:true}).waitFor();
 assert.equal(rows[0].flight_id,'flight-test');assert.equal(rows[0].data.sourceRevision,1);
 await page.getByText('Mais ações',{exact:true}).click();await page.getByRole('button',{name:'Contadores',exact:true}).click();
 await page.getByText('Conferido · acumulado 125',{exact:true}).waitFor();
 revision=2;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.getByText('Eventos alterados · confira novamente',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Atualizar leitura',exact:true}).click();await page.getByRole('button',{name:'Salvar leitura',exact:true}).click();await page.getByText('Conferido · acumulado 126',{exact:true}).waitFor();assert.equal(rows.length,1);
 await page.screenshot({path:`counter-panel-${width}.png`,fullPage:true});await page.getByRole('button',{name:'Documentos / eDB',exact:true}).click();await page.getByText('Verificações vinculadas ao voo',{exact:true}).click();await page.getByText('Conferido · OK',{exact:true}).waitFor();await page.getByText('Conferência: mat. M1',{exact:false}).waitFor();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await page.screenshot({path:`counters-${width}.png`,fullPage:true});await page.close();console.log('PASS shared counters and maintenance checks',width);
 }}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
