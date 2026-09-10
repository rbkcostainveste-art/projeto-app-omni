const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [390,1366]){const page=await browser.newPage({viewport:{width,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/ai/flight-import',async route=>{const body=route.request().postDataJSON();assert.match(body.attachment.data,/^data:image\/png;base64,/);const base={prefix:'PR-TEST',date:'2026-09-10',departure:'08:00',destination:'P-1',duration:'01:30',fuelAmount:null,fuelUnit:null,notes:'Página 1; tripulação não informada'};await route.fulfill({json:{reply:'Revise os voos encontrados.',flights:[base,{...base,departure:'10:00'},{...base,prefix:'PR-UNKNOWN',date:null,departure:null,duration:null}]}});});
 await page.goto((process.env.TEST_BASE_URL||'http://127.0.0.1:3210')+'/flight-import-test');
 await page.getByRole('button',{name:'Importar programação com IA',exact:true}).click();
 await page.getByLabel('Arquivo da programação').setInputFiles({name:'programacao.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6YZYAAAAASUVORK5CYII=','base64')});
 await page.getByRole('button',{name:'Analisar programação',exact:true}).click();await page.getByText('Revise os voos encontrados.').waitFor();
 assert.equal(await page.getByLabel('Incluir voo 1',{exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Adicionar selecionados aos rascunhos'}).click();
 await page.getByRole('button',{name:'Programar 3 voos',exact:true}).waitFor();
 assert.equal(await page.getByLabel('Incluir voo 2',{exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Programar 3 voos',exact:true}).click();await page.getByText(/Confira os voos importados: revise/).waitFor();assert.equal(await page.getByTestId('saved').innerText(),'[]');
 await page.screenshot({path:`flight-import-${width}.png`,fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 // Remove untouched initial draft and unresolved import, leaving the valid imported row.
 await page.getByRole('button',{name:'Remover',exact:true}).first().click();await page.getByRole('button',{name:'Remover',exact:true}).last().click();
 await page.getByLabel('Conferi os dados deste voo importado',{exact:true}).check();
 await page.getByRole('button',{name:'Programar 1 voo',exact:true}).click();await page.getByText(/1 voo programado\. Documentação/).waitFor();
 const saved=JSON.parse(await page.getByTestId('saved').innerText());assert.equal(saved.length,1);assert.equal(saved[0].departure,'10:00');assert.equal(saved[0].planningStatus,'planned');assert.match(saved[0].history[0].value,/extração IA/);assert.deepEqual(errors,[]);await page.close();console.log('PASS flight import',width);
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
