const {chromium}=require('C:/Users/rbkco/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [390,1366]){
 const page=await browser.newPage({viewport:{width,height:1050}});const errors=[];let calls=0;let payload;
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/__closure_test',async route=>{
 const {args}=route.request().postDataJSON();calls++;payload=args;
 if(calls===1)return route.fulfill({json:{data:null,error:{message:'Outra pendência exige avaliação'}}});
 const row={revision:2,data:{resolved:true,sourceClosed:!!args.p_closure,actions:[{id:'action',status:'resolved',executions:[{result:'satisfactory',at:'2026-09-11T11:00:00Z'}]}]}};
 return route.fulfill({json:{data:row,error:null}});
 });
 await page.goto('http://localhost:3011/maintenance-closure-test',{timeout:90000});
 assert.match(await page.getByTestId('giro').getAttribute('class'),/border-emerald-500/);assert.match(await page.getByTestId('source').getAttribute('class'),/border-red-500/);
 await page.getByRole('button',{name:'Encerrar ação',exact:true}).click();await page.getByLabel('Conclusão do responsável',{exact:true}).fill('Resultado revisado pelo inspetor');
 assert.equal(await page.getByRole('button',{name:'Confirmar encerramento',exact:true}).isDisabled(),true);
 await page.getByLabel('Referência da APRS confirmada',{exact:true}).fill('QA-APRS');await page.getByLabel('Confirmo as referências acima, o encerramento do relato e a disponibilidade',{exact:true}).check();
 await page.screenshot({path:`tmp/maintenance-closure-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:'Confirmar encerramento',exact:true}).click();await page.getByRole('alert').filter({hasText:'Outra pendência'}).waitFor();assert.equal(await page.getByLabel('Conclusão do responsável',{exact:true}).inputValue(),'Resultado revisado pelo inspetor');assert.match(await page.getByTestId('source').getAttribute('class'),/border-red-500/);
 await page.getByRole('button',{name:'Confirmar encerramento',exact:true}).click();await page.getByTestId('source').filter({hasText:'Caso encerrado'}).waitFor();assert.match(await page.getByTestId('source').getAttribute('class'),/border-emerald-500/);assert.equal(payload.p_closure.aprsRef,'QA-APRS');assert.equal(payload.p_closure.revision,2);assert.equal(payload.p_expected_revision,1);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(errors,[]);await page.close();console.log('PASS',width,'green result, explicit inspector review, error preservation, signed closure, responsive layout');
 }}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});