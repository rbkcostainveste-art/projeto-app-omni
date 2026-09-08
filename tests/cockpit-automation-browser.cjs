const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});try{
 for(const width of [390,820,1366]){
  const context=await browser.newContext({viewport:{width,height:900},permissions:['microphone']}),page=await context.newPage();let rows=[],saved=[],uploads=[];const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({width})=>{navigator.geolocation.getCurrentPosition=(ok,fail)=>width===820?ok({coords:{latitude:-22.9,longitude:-43.2,accuracy:20},timestamp:Date.now()}):fail({code:1});},{width});
  await page.route('**/__upload_test',async route=>{uploads.push(route.request().postDataJSON());await route.fulfill({json:{data:{},error:null}});});
  await page.route('**/__cockpit_test',async route=>{const {name,args}=route.request().postDataJSON();let data={};
   if(name==='get_flight_position')data={history:[]};
   if(name==='get_flight_operation')data={events:[{id:'t',type:'takeoff',at:'2026-09-08T13:00:00Z'},{id:'l',type:'landing',at:'2026-09-08T14:00:00Z'}],checks:{},first:true,revision:2,day:'2026-09-08',canPilot:true,canSign:true};
   if(name==='crew_presentation')data={checkin:{checked_at:'2026-09-08T10:00:00Z',flight_snapshot:{prefix:'PR-CHT'}},date:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())};
   if(name==='cockpit'){
    if(args.p_action==='list')data=rows;
    if(args.p_action==='save'){const p=args.p_payload;data={id:p.id,kind:p.kind,subject:p.subject,flight_id:p.flightId,data:p.data,revision:(p.revision||0)+1,updated_at:new Date().toISOString()};saved.push(data);rows=[...rows.filter(r=>r.id!==p.id),data];}
   }
   await route.fulfill({json:{data,error:null}});
  });
  await page.goto('http://localhost:3010/cockpit-test');await page.getByRole('button',{name:'Registrar ocorrência',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Ocorrência',exact:true});await dialog.waitFor();
  assert.equal(await dialog.getByLabel('Aeronave vinculada ao voo').inputValue(),'PR-CHT');assert.ok(await dialog.getByLabel('Aeronave vinculada ao voo').isDisabled());
  assert.equal(await dialog.getByLabel('Tripulação envolvida').inputValue(),'Piloto teste, Copiloto teste');
  if(width===820){await dialog.getByRole('link',{name:'Ver local no mapa'}).waitFor();await dialog.getByText('Precisão estimada: 20 m',{exact:false}).waitFor();await dialog.getByLabel('Latitude decimal').fill('-22.8');assert.equal(await dialog.getByText('Precisão estimada:',{exact:false}).count(),0);}else await dialog.getByText('Não foi possível obter a localização.',{exact:false}).waitFor();
  await dialog.getByLabel('Título',{exact:true}).fill('Ocorrência teste');await dialog.getByLabel('Descrição / observações').fill('Registro com localização negada');
  await dialog.getByLabel('Adicionar imagem, áudio ou vídeo',{exact:true}).setInputFiles({name:'audio.mp3',mimeType:'audio/mpeg',buffer:Buffer.from('fixture audio')});
  if(width===390){await dialog.getByRole('button',{name:'Gravar áudio',exact:true}).click();await dialog.getByText('Gravando',{exact:false}).waitFor();await page.waitForTimeout(350);assert.ok(await dialog.getByRole('button',{name:'Salvar',exact:true}).isDisabled());await dialog.getByRole('button',{name:'Enviar gravação'}).click();await dialog.getByRole('button',{name:'Gravar áudio',exact:true}).waitFor();}
  await dialog.getByRole('button',{name:'Salvar',exact:true}).click();await dialog.getByText('Registro salvo.',{exact:true}).waitFor();
  assert.equal(saved[0].flight_id,'flight-test');assert.equal(saved[0].data.latitude,width===820?'-22.8':undefined);assert.equal(JSON.parse(saved[0].data.mediaJson).length,width===390?2:1);assert.equal(uploads.length,width===390?2:1);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await dialog.getByRole('button',{name:'Fechar cadastro Cockpit'}).click();await page.getByRole('button',{name:'Meu dia teste'}).click();
  await page.getByRole('button',{name:'Minha jornada / registrar liberação'}).click();
  const duty=page.getByRole('dialog',{name:'Jornada / papeleta',exact:true});await duty.waitFor();
  assert.ok(await duty.getByLabel('Apresentação efetiva').inputValue());assert.equal(await duty.getByLabel('Liberação',{exact:true}).inputValue(),'');
  await duty.getByText('Referência de decolagem a pouso: 60 min.',{exact:false}).waitFor();assert.equal(await duty.getByLabel('Total de voo conferido (minutos)').inputValue(),'');
  await duty.getByRole('button',{name:'Registrar liberação',exact:true}).click();await duty.getByText('Registro salvo.',{exact:true}).waitFor();
  assert.ok(saved.at(-1).data.release);assert.equal(saved.at(-1).flight_id,null);assert.equal(saved.at(-1).data.flightMinutes,undefined);
  await page.screenshot({path:`cockpit-automation-${width}.png`,fullPage:true});assert.deepEqual(errors,[]);await context.close();console.log('PASS cockpit occurrence and duty',width);
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
