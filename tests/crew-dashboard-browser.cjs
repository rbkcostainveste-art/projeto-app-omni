const {chromium}=require('C:/Users/rbkco/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [390,1366]){
 const page=await browser.newPage({viewport:{width,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:3011/crew-dashboard-test',{timeout:120000});
 const filters=page.getByRole('group',{name:'Filtrar voos por situação'});
 for(const [label,count,heading,ids] of [['Confirmados',1,'Voos confirmados',['confirmed']],['Planejados',1,'Voos planejados',['planned']],['Cancelados',1,'Voos cancelados',['cancelled']],['Retornados',1,'Voos retornados',['returned']],['Finalizados',2,'Voos finalizados',['finished','maintenance-finished']],['Manutenção',1,'Ações de manutenção',['maintenance']]]){
  const button=filters.getByRole('button',{name:`${count} ${label}`,exact:true});await button.click();assert.equal(await button.getAttribute('aria-pressed'),'true');
  const section=page.locator('section').filter({has:page.getByRole('heading',{name:heading,exact:true})}).last();
  await section.getByRole('heading',{name:heading,exact:true}).waitFor();
  assert.equal(await section.getByRole('button').count(),ids.length);
  for(const id of ids)assert.equal(await section.locator('strong').filter({hasText:new RegExp(`^${id}$`)}).count(),1);
 }
 await filters.getByRole('button',{name:'2 Finalizados',exact:true}).click();
 await page.screenshot({path:`tmp/crew-dashboard-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:/^finished S92/}).click();await page.getByRole('heading',{name:'finished',exact:true}).waitFor();
 assert.equal(await page.getByText('Voo finalizado',{exact:true}).count(),1);
 await page.getByRole('button',{name:'Abrir este voo no Trilho'}).click();assert.equal(await page.locator('output').textContent(),'finished');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(errors,[]);
 await page.close();console.log('PASS',width,'six filters, counts, no completed duplicates, details, trail, responsive');
 }}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
