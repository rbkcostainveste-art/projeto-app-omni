const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [390,1366]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));let calls=0,deny=false;
 const id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
 await page.route('**/api/ai/drying?*',async route=>{calls++;assert.equal(route.request().headers()['x-employee'],'42');await route.fulfill({status:deny?404:200,contentType:'application/json',body:JSON.stringify(deny?{error:'Registro indisponível ou sem acesso.'}:{items:[{id,prefix:'PR-TEST',model:'S-92A',base:'Macaé',reason:'Lavagem dos compressores',status:'pending',triggered_at:'2026-09-08T15:00:00Z'}],queriedAt:'2026-09-09T18:00:00Z',scope:'Base Macaé',period:'Pendências atuais',notice:'Não determina quais foram lavados hoje.',truncated:false})});});
 await page.goto((process.env.TEST_BASE_URL||'http://127.0.0.1:3210')+'/drying-test');
 await page.getByRole('button',{name:'Consultar dados reais'}).click();await page.getByRole('button',{name:'Abrir card no Trilho'}).waitFor();
 await page.getByRole('button',{name:'Abrir card no Trilho'}).click();await page.getByText(`Destino recebido: ${id}`).waitFor();assert.equal(calls,2);
 deny=true;await page.getByRole('button',{name:'Abrir card no Trilho'}).click();await page.getByRole('region',{name:'Consulta operacional de secagens'}).getByRole('alert').waitFor();assert.match(await page.getByRole('region',{name:'Consulta operacional de secagens'}).getByRole('alert').innerText(),/indisponível/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 await page.screenshot({path:`assistant-drying-${width}.png`,fullPage:true});await page.close();console.log(`PASS ${width}`);
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
