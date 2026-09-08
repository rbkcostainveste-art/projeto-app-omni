// Local-only fixture; see tests/INTEGRATED-CALLS.md. No production requests.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');

(async()=>{

 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});

 const errors=[];let current=null,members=[],signals=[],sequence=0;

 try{

 const context=await browser.newContext({permissions:['camera','microphone'],viewport:{width:390,height:844}});

 await context.addInitScript(()=>{let uuidCounter=0;crypto.randomUUID=()=>`${new URLSearchParams(location.search).get('user')==='A'?'ffffffff':new URLSearchParams(location.search).get('user')==='B'?'88888888':'11111111'}-0000-4000-8000-${(++uuidCounter).toString(16).padStart(12,'0')}`;window.testStreams=[];window.testPeers=[];const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async constraints=>{window.facingRequests=window.facingRequests||[];window.facingRequests.push(constraints.video?.facingMode);if(constraints.video?.facingMode?.exact)constraints.video={...constraints.video,facingMode:undefined};const stream=await original(constraints);window.testStreams.push(stream);return stream;};const PC=window.RTCPeerConnection;window.RTCPeerConnection=class extends PC{constructor(...args){super(...args);window.testPeers.push(this);}};navigator.mediaDevices.getDisplayMedia=async()=>{const canvas=document.createElement('canvas');canvas.width=120;canvas.height=80;const ctx=canvas.getContext('2d');const timer=setInterval(()=>{ctx.fillStyle='red';ctx.fillRect(0,0,120,80);},100);const stream=canvas.captureStream(10);window.testStreams.push(stream);stream.getVideoTracks()[0].addEventListener('ended',()=>clearInterval(timer));return stream;};});

 await context.route('**/__call_test',async route=>{const {who,args}=route.request().postDataJSON(),p=args.p_payload,action=args.p_action;let data={};

  if(action==='incoming')data=current&&!current.ended_at&&members.some(m=>m.employee===who&&m.state==='invited')?[current]:[];

  else{

   if(action==='leave'&&p.id!==current?.id){await route.fulfill({json:{data:{},error:null}});return;}
   if(action==='start'){current={id:p.id,conversation_id:p.conversation,started_by:who,mode:p.mode,created_at:new Date().toISOString(),ended_at:null,caller_name:who,title:'Conversa QA'};members=['A','B','C'].map(employee=>({employee,name:employee,session:null,state:'invited'}));signals=[];}

   const mine=members.find(m=>m.employee===who);

   if(action==='start'||action==='join'){mine.state='joined';mine.session=p.session;}

   if(action==='signal')signals.push({id:++sequence,sender:p.session,recipient:p.recipient,payload:p.signal});

   if(action==='decline')mine.state='declined';

   if(action==='leave'){mine.state='left';if(!members.some(m=>m.state==='joined'))current.ended_at=new Date().toISOString();}

   data={call:current,ended:!!current?.ended_at,members,signals:action==='poll'?signals.filter(s=>s.recipient===p.session&&s.id>(p.after||0)):[]};

  }

  await route.fulfill({json:{data,error:null}});

 });

 const a=await context.newPage(),b=await context.newPage(),c=await context.newPage();

 for(const [page,user] of [[a,'A'],[b,'B'],[c,'C']]){page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:3010/calls-test?user='+user);}

 await a.bringToFront();await a.waitForTimeout(800);

 for(const type of ['áudio','vídeo']){await a.getByRole('button',{name:'Gravar '+type,exact:true}).click();await a.getByRole('button',{name:'Enviar gravação'}).waitFor();await a.waitForTimeout(1600);if(type==='vídeo'){await a.getByRole('button',{name:'Trocar câmera'}).click();await a.waitForTimeout(800);assert.ok(await a.evaluate(()=>window.facingRequests.some(f=>f?.exact==='environment')));}await a.getByRole('button',{name:'Enviar gravação'}).click();await a.waitForTimeout(900);assert.match(await a.getByTestId('sent').innerText(),type==='áudio'?/^audio\/.*:[1-9]/:/^video\/.*:[1-9]/);assert.equal(await a.getByText('Usar gravação').count(),0);}

 await a.getByRole('button',{name:'Gravar áudio',exact:true}).click();await a.getByRole('button',{name:'Cancelar gravação'}).click({timeout:6000}).catch(async e=>{console.log(await a.locator('body').innerText());throw e;});await a.getByRole('button',{name:'Enviar gravação'}).waitFor({state:'hidden'});

 console.log('PASS direct audio/video send and cancel');

 await a.getByRole('button',{name:'Ligar por vídeo'}).click();await a.getByRole('heading',{name:'Chamando / conectando…'}).waitFor();

 await b.bringToFront();await b.getByRole('button',{name:'Atender',exact:true}).click({timeout:12000});

 await b.getByRole('heading',{name:'Em chamada',exact:true}).waitFor({timeout:25000});await a.getByRole('heading',{name:'Em chamada',exact:true}).waitFor({timeout:25000});

 await b.waitForFunction(()=>{const el=document.querySelector('video[aria-label="A"]');return el&&el.videoWidth>0;});

 await c.bringToFront();await c.getByRole('button',{name:'Atender',exact:true}).click({timeout:12000});await c.getByRole('heading',{name:'Em chamada',exact:true}).waitFor({timeout:25000});

 await c.waitForFunction(()=>document.querySelectorAll('video').length===3);

 await c.getByRole('button',{name:'Silenciar microfone'}).click();assert.equal(await c.getByRole('button',{name:'Ativar microfone'}).count(),1);

 await c.getByRole('button',{name:'Desligar câmera'}).click();assert.equal(await c.getByRole('button',{name:'Ligar câmera',exact:true}).count(),1);

 await a.bringToFront();await a.getByRole('button',{name:'Compartilhar tela'}).click();await b.waitForFunction(()=>document.querySelector('video[aria-label="A"]')?.videoWidth===120);
 await a.getByRole('button',{name:'Gravar chamada',exact:true}).click();await b.getByText('Um participante está gravando esta chamada',{exact:false}).waitFor();await a.waitForTimeout(2200);await a.getByRole('button',{name:'Parar gravação',exact:false}).click();await a.getByRole('heading',{name:'Gravação pronta'}).waitFor();await a.waitForFunction(()=>document.querySelector('a[download]')?.getAttribute('href')?.startsWith('blob:'));assert.ok(await a.locator('a[download]').evaluate(async el=>(await (await fetch(el.href)).blob()).size>1000));await a.getByRole('button',{name:'Descartar',exact:true}).click();
 await a.getByRole('button',{name:'Parar compartilhamento'}).click();
 console.log('PASS screen share in video call, recording and participant notification');
 await c.screenshot({path:'calls-check.png'});

 for(const page of [c,b,a]){await page.getByRole('button',{name:'Encerrar chamada',exact:true}).click();await page.getByRole('button',{name:'Fechar chamada'}).click();}

 assert.ok(current.ended_at);assert.deepEqual(errors,[]);console.log('PASS integrated 3-way WebRTC video received, accept, mute, camera and hangup; no external tab');

 for(const page of [a,b,c])assert.ok(await page.evaluate(()=>window.testStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))));

 await a.waitForTimeout(1800);await a.bringToFront();await a.getByRole('button',{name:'Ligar por voz'}).click();await b.bringToFront();await b.getByRole('button',{name:'Atender',exact:true}).click({timeout:12000});await b.getByRole('heading',{name:'Em chamada',exact:true}).waitFor({timeout:25000});

 await b.waitForFunction(async()=>{for(const pc of window.testPeers){if(pc.connectionState!=='connected')continue;const stats=await pc.getStats();for(const row of stats.values())if(row.type==='inbound-rtp'&&row.kind==='audio'&&row.packetsReceived>0)return true;}return false;});

 for(const page of [a,b]){assert.equal(await page.getByRole('button',{name:'Ligar câmera',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Compartilhar tela'}).count(),0);assert.equal(await page.locator('video').count(),0);await page.getByRole('button',{name:'Encerrar chamada',exact:true}).click();await page.getByRole('button',{name:'Fechar chamada'}).click();}
 console.log('PASS audio packets and audio-only controls');
 await a.bringToFront();await a.evaluate(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied','NotAllowedError');};});await a.getByRole('button',{name:'Ligar por voz'}).click();await a.getByText('O navegador não liberou o microfone. Confira as permissões do site e do celular abaixo.').waitFor();assert.ok(current.ended_at);assert.equal(context.pages().length,3);console.log('PASS denied permission does not create call; caller exercised answering peer branch');

 }finally{await browser.close();}

})().catch(e=>{console.error(e);process.exitCode=1;});
