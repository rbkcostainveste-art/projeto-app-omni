const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
for(const width of [390,1366]){
 const page=await browser.newPage({viewport:{width,height:900},timezoneId:'America/Sao_Paulo'});
 await page.clock.install({time:new Date('2026-09-08T15:00:00Z')});
 await page.goto('http://localhost:3010/reading-test');
 await page.getByRole('button',{name:'Discrepâncias',exact:true}).click();
 await page.getByText('Discrepância antiga pendente',{exact:true}).waitFor();
 assert.equal(await page.getByText('Discrepância antiga encerrada',{exact:true}).count(),0);
 await page.getByRole('button',{name:'Filtros',exact:true}).click();
 const dates=page.getByLabel('Data dos registros');
 await dates.selectOption('2026-09-06');
 assert.equal(await page.getByText('Discrepância antiga pendente',{exact:true}).count(),0);
 await dates.selectOption('2026-09-07');
 await page.getByText('Discrepância antiga encerrada',{exact:true}).waitFor();
 await dates.selectOption('2026-09-08');
 await page.clock.setSystemTime(new Date('2026-09-09T15:00:00Z'));
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await page.waitForFunction(()=>document.querySelector('[aria-label="Data dos registros"]').value==='2026-09-09');
 await page.getByText('Discrepância antiga pendente',{exact:true}).waitFor();
 await dates.selectOption('2026-09-07');
 await page.clock.setSystemTime(new Date('2026-09-10T15:00:00Z'));
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 assert.equal(await dates.inputValue(),'2026-09-07');
 await dates.selectOption('2026-09-10');
 await page.getByRole('button',{name:'Serviços',exact:true}).click();
 await page.getByText('Serviço antigo pendente',{exact:true}).waitFor();
 await page.getByText('Discrepância antiga pendente',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Panes',exact:true}).click();
 await page.getByText('Verificar indicação do radar meteorológico',{exact:true}).waitFor();
 console.log('PASS pending records, custom dates, day rollover',width);await page.close();
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
