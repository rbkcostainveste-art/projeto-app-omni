const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});try{
 for(const scenario of ['microphone','camera','busy','incoming']){
  const context=await browser.newContext({viewport:{width:390,height:844},permissions:['camera','microphone']});const page=await context.newPage();const requests=[],errors=[];let call=null;page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({scenario})=>{window.captured=[];window.failedDevice=scenario==='microphone'||scenario==='busy'?'audio':'video';const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async c=>{if(c[window.failedDevice])throw new DOMException('simulated',scenario==='busy'?'NotReadableError':'NotAllowedError');const s=await original(c);window.captured.push(s);return s;};},{scenario});
  await page.route('**/__call_test',async route=>{const {args}=route.request().postDataJSON(),action=args.p_action,p=args.p_payload;requests.push({action,p});let data={};
   if(action==='incoming')data=scenario==='incoming'&&!call?[{id:'incoming-video',conversation_id:'test-conversation',mode:'video',caller_name:'Colega',created_at:new Date().toISOString()}]:[];
   if(action==='start'||action==='join')call={id:p.id,conversation_id:'test-conversation',mode:scenario==='incoming'?'video':p.mode,started_by:'A',created_at:new Date().toISOString(),ended_at:null};
   if(['start','join','poll'].includes(action))data={call,ended:false,members:[],signals:[]};await route.fulfill({json:{data,error:null}});
  });
  await page.goto('http://localhost:3010/calls-test');await page.waitForTimeout(300);
  await page.getByRole('button',{name:scenario==='incoming'?'Atender':scenario==='microphone'||scenario==='busy'?'Ligar por voz':'Ligar por vídeo',exact:true}).click();
  await page.getByRole('button',{name:'Tentar novamente'}).waitFor();assert.equal(requests.filter(r=>['start','join'].includes(r.action)).length,0);
  if(scenario==='busy')await page.getByRole('alert').filter({hasText:'Encerre outras chamadas'}).waitFor();
  else await page.getByRole('alert').filter({hasText:scenario==='microphone'?'não liberou o microfone':'não liberou a câmera'}).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));if(scenario==='camera')await page.screenshot({path:'call-permission-mobile.png'});
  assert.ok(await page.evaluate(()=>window.captured.every(s=>s.getTracks().every(t=>t.readyState==='ended'))));
  if(scenario==='camera'||scenario==='incoming'){await page.getByRole('button',{name:'Entrar só com áudio'}).click();}
  else{assert.equal(await page.getByRole('button',{name:'Entrar só com áudio'}).count(),0);await page.evaluate(()=>{window.failedDevice='none';});await page.getByRole('button',{name:'Tentar novamente'}).click();}
  await page.getByRole('heading',{name:'Chamando / conectando…'}).waitFor();const joined=requests.filter(r=>['start','join'].includes(r.action));assert.equal(joined.length,1);assert.equal(joined[0].p.mode,'audio');if(scenario==='incoming'){assert.equal(joined[0].action,'join');assert.equal(joined[0].p.id,'incoming-video');}
  assert.deepEqual(errors,[]);await context.close();console.log('PASS permission recovery',scenario);
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
