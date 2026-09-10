const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [390,1366]){
 const page=await browser.newPage({viewport:{width,height:1000}});let status='pending',revision=1;const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const state=()=>({status,canConfirm:status!=='reconfirm',pending:[],blocked:false,fingerprint:'qa-context',...(status==='pending'?{}:{actor:'M-DEMO',at:'2026-09-10T11:15:00Z'})});
 await page.route('**/__preparation_test',async route=>{const {name,args}=route.request().postDataJSON();let data={};
  if(name==='get_preparation_statuses')data={'qa-flight':state()};
  if(name==='get_flight_position')data={history:[]};
  if(name==='cockpit')data=[];
  if(name==='record_flight_operation'){assert.equal(args.p_action,'confirm_preparation');assert.equal(args.p_payload.fingerprint,'qa-context');status='ready';revision++;}
  if(['get_flight_operation','record_flight_operation'].includes(name))data={preparation:state(),events:[],checks:{fuel:{kind:'fuel',targetFlightId:'qa-flight',approval:{actor:'M-DEMO',at:'2026-09-10T11:10:00Z',result:'ok'}},inspection:{kind:'preflight',targetFlightId:'qa-flight',approval:{actor:'M-DEMO',at:'2026-09-10T11:12:00Z',result:'ok'}}},counters:[],revision,first:true,day:'2026-09-10',canPilot:false,canSign:true,canExecute:false,closed:false};
  await route.fulfill({json:{data,error:null}});
 });
 await page.goto('http://localhost:3010/preparation-mel-test');await page.addStyleTag({content:'nextjs-portal{display:none!important}'});await page.getByRole('button',{name:'Confirmar preparação concluída'}).click();
 await page.locator('#ready-shot').getByText('✓ Preparação concluída').waitFor();
 await page.locator('#ready-shot').screenshot({path:`output/pdf/assets/preparation-ready-${width}.png`});
 await page.locator('#mechanic-shot').screenshot({path:`output/pdf/assets/preparation-mechanic-${width}.png`});
 await page.locator('#mel-shot').screenshot({path:`output/pdf/assets/mel-deadline-${width}.png`});
 await page.getByLabel('Categoria MEL',{exact:true}).selectOption('C');assert.equal(await page.getByLabel('Dias calendáricos do item').inputValue(),'10');
 await page.getByLabel('Categoria MEL',{exact:true}).selectOption('A');await page.getByText('Categoria A: informe a regra',{exact:false}).waitFor();assert.equal(await page.getByLabel('Dias calendáricos do item').count(),0);
 status='reconfirm';await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.locator('#ready-shot').getByText('Preparação precisa ser reconfirmada',{exact:false}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Confirmar preparação concluída'}).isDisabled(),true);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 await page.close();console.log('PASS preparation, revocation, MEL controls, layout',width);
 }}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
