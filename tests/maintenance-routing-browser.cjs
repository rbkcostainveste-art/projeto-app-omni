const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const width of [390,1366]){
  const page=await browser.newPage({viewport:{width,height:950}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(20000);
  await page.goto((process.env.TEST_BASE_URL||'http://localhost:3010')+'/maintenance-routing-test'+(width===390?'?crewError=1':''),{waitUntil:'domcontentloaded',timeout:90000});
  await page.locator('main[data-hydrated=true]').waitFor({timeout:60000});console.log('Hydrated',width);
  await page.getByRole('button',{name:'pilot',exact:true}).click();
  await page.getByText('Nenhuma atividade de manutenção para você hoje.').waitFor();console.log('Pilot unassigned verified',width);
  await page.getByRole('button',{name:'coordination',exact:true}).click();
  await page.getByRole('button',{name:'Voo de manutenção 1 atividade(s)',exact:true}).click();
  await page.getByText('Aguardando programação',{exact:true}).waitFor();console.log('Coord waiting verified',width);
  await page.getByRole('button',{name:'Programar no trilho',exact:true}).click();
  await page.getByRole('button').filter({hasText:'Abrir verificações e eventos'}).click();
  await page.getByRole('button',{name:'Programar voo/giro',exact:true}).click();console.log('Plan opened',width);
  if(width===390){
   await page.getByRole('alert').filter({hasText:'Falha de consulta simulada'}).waitFor();
   assert.equal(await page.getByLabel('Piloto',{exact:true}).isDisabled(),true);
   assert.equal(await page.getByRole('button',{name:'Salvar programação',exact:true}).isDisabled(),true);
   await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();
  }
  await page.getByLabel('Piloto',{exact:true}).locator('option[value=P1]').waitFor({state:'attached'});
  for(const field of ['Piloto','Copiloto']){
   const options=await page.getByLabel(field,{exact:true}).locator('option').evaluateAll(nodes=>nodes.map(n=>n.value));
   assert.deepEqual(options.sort(),['','P1','P2']);
  }
  await page.screenshot({path:`tmp/maintenance-crew-options-${width}.png`,fullPage:true});
  const date=await page.getByLabel('Data',{exact:true}).inputValue();
  await page.getByLabel('Horário previsto',{exact:true}).fill('11:00');
  await page.getByLabel('Piloto',{exact:true}).selectOption('P1');
  await page.getByLabel('Copiloto',{exact:true}).selectOption('P1');
  await page.getByRole('button',{name:'Salvar programação',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'pessoas diferentes'}).waitFor();
  await page.getByLabel('Copiloto',{exact:true}).selectOption('P2');
  await page.getByLabel('Posição (opcional)',{exact:true}).fill('a3');
  await page.getByRole('button',{name:'Salvar programação',exact:true}).click();
  await page.getByText('Programado · '+date.split('-').reverse().join('/')+' · 11:00',{exact:true}).waitFor();
  const calls=JSON.parse(await page.getByTestId('calls').textContent());
  assert.equal(calls.length,1);assert.equal(calls[0].p_plan.commander,'P1');assert.equal(calls[0].p_plan.copilot,'P2');assert.equal(calls[0].p_plan.expectedRevision,1);
  await page.screenshot({path:`tmp/maintenance-routing-trail-${width}.png`,fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.getByRole('button',{name:'pilot',exact:true}).click();
  await page.getByText('Verificar se normalizou',{exact:true}).waitFor();
  assert.equal(await page.getByText('Nenhuma atividade de manutenção para você hoje.').count(),0);
  await page.screenshot({path:`tmp/maintenance-routing-pilot-${width}.png`,fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
  await page.close();console.log('PASS contact-only catalog → operational S92 roster → date/crew → trail saved → assigned pilot',width);
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
