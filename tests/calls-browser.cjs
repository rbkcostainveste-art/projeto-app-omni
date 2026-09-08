// Local-only fixture; see tests/INTEGRATED-CALLS.md. No production requests.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 const errors=[];let current=null,members=[],signals=[],sequence=0;
 try{
 const context=await browser.newContext({permissions:['camera','microphone'],viewport:{width:390,height:844}});
 await context.addInitScript(()=>{let uuidCounter=0;crypto.randomUUID=()=>`${new URLSearchParams(location.search).get('user')==='A'?'ffffffff':new URLSearchParams(location.search).get('user')==='B'?'88888888':'11111111'}-0000-4000-8000-${(++uuidCounter).toString(16).padStart(12,'0')}`;window.testStreams=[];window.testPeers=[];const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async constraints=>{const stream=await original(constraints);window.testStreams.push(stream);return stream;};const PC=window.RTCPeerConnection;window.RTCPeerConnection=class extends PC{constructor(...args){super(...args);window.testPeers.push(this);}};navigator.mediaDevices.getDisplayMedia=async()=>{const canvas=document.createElement('canvas');canvas.width=120;canvas.height=80;const ctx=canvas.getContext('2d');const timer=setInterval(()=>{ctx.fillStyle='red';ctx.fillRect(0,0,120,80);},100);const stream=canvas.captureStream(10);window.testStreams.push(stream);stream.getVideoTracks()[0].addEventListener('ended',()=>clearInterval(timer));return stream;};});
 await context.route('**/__call_test',async route=>{const {who,args}=route.request().postDataJSON(),p=args.p_payload,action=args.p_action;let data={};
  if(action==='incoming')data=current&&!current.ended_at&&members.some(m=>m.employee===who&&m.state==='invited')?[current]:[];
  else{
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
 for(const type of ['áudio','vídeo']){await a.getByRole('button',{name:'Gravar '+type,exact:true}).click();await a.getByRole('button',{name:'Enviar gravação'}).waitFor();await a.waitForTimeout(1600);await a.getByRole('button',{name:'Enviar gravação'}).click();await a.waitForTimeout(900);assert.match(await a.getByTestId('sent').innerText(),type==='áudio'?/^audio\/.*:[1-9]/:/^video\/.*:[1-9]/);assert.equal(await a.getByText('Usar gravação').count(),0);}
 await a.getByRole('button',{name:'Gravar áudio',exact:true}).click();await a.getByRole('button',{name:'Cancelar gravação'}).click();await a.getByRole('button',{name:'Enviar gravação'}).waitFor({state:'hidden'});
 console.log('PASS direct audio/video send and cancel');
 await a.getByRole('button',{name:'Ligar por vídeo'}).click();await a.getByRole('heading',{name:'Chamando / conectando…'}).waitFor();
 await b.bringToFront();await b.getByRole('button',{name:'Atender',exact:true}).click({timeout:12000});
 await b.getByRole('heading',{name:'Em chamada',exact:true}).waitFor({timeout:25000});await a.getByRole('heading',{name:'Em chamada',exact:true}).waitFor({timeout:25000});
 await b.waitForFunction(()=>{const el=document.querySelector('video[aria-label="A"]');return el&&el.videoWidth>0;});
 await c.bringToFront();await c.getByRole('button',{name:'Atender',exact:true}).click({timeout:12000});await c.getByRole('heading',{name:'Em chamada',exact:true}).waitFor({timeout:25000});
 await c.waitForFunction(()=>document.querySelectorAll('video').length===3);
 await c.getByRole('button',{name:'Silenciar microfone'}).click();assert.equal(await c.getByRole('button',{name:'Ativar microfone'}).count(),1);
 await c.getByRole('button',{name:'Desligar câmera'}).click();assert.equal(await c.getByRole('button',{name:'Ligar câmera',exact:true}).count(),1);
 await c.screenshot({path:'calls-check.png'});
 for(const page of [c,b,a])await page.getByRole('button',{name:'Encerrar chamada',exact:true}).click();
 assert.ok(current.ended_at);assert.deepEqual(errors,[]);console.log('PASS integrated 3-way WebRTC video received, accept, mute, camera and hangup; no external tab');
 for(const page of [a,b,c])assert.ok(await page.evaluate(()=>window.testStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))));
 await a.bringToFront();await a.getByRole('button',{name:'Ligar por voz'}).click();await b.bringToFront();await b.getByRole('button',{name:'Atender',exact:true}).click({timeout:12000});await b.getByRole('heading',{name:'Em chamada',exact:true}).waitFor({timeout:25000});
 await b.waitForFunction(async()=>{for(const pc of window.testPeers){if(pc.connectionState!=='connected')continue;const stats=await pc.getStats();for(const row of stats.values())if(row.type==='inbound-rtp'&&row.kind==='audio'&&row.packetsReceived>0)return true;}return false;});
 await a.getByRole('button',{name:'Compartilhar tela'}).click();await b.waitForFunction(()=>document.querySelector('video[aria-label="A"]')?.videoWidth===120,{},{timeout:8000}).catch(async e=>{for(const page of [a,b])console.log(await page.evaluate(()=>({videos:[...document.querySelectorAll('video')].map(v=>({name:v.getAttribute('aria-label'),width:v.videoWidth,ready:v.readyState,paused:v.paused})),peers:window.testPeers.filter(pc=>pc.connectionState==='connected').map(pc=>pc.getTransceivers().map(t=>({direction:t.currentDirection,sender:t.sender.track?.kind,receiver:t.receiver.track.kind,muted:t.receiver.track.muted}))),alerts:[...document.querySelectorAll('[role=alert]')].map(el=>el.textContent)})));throw e;});
 await a.getByRole('button',{name:'Parar compartilhamento'}).click();await a.getByRole('button',{name:'Ligar câmera',exact:true}).click();await b.waitForFunction(()=>document.querySelector('video[aria-label="A"]')?.videoWidth===640);
 await a.getByRole('button',{name:'Encerrar chamada',exact:true}).click();await b.getByRole('button',{name:'Encerrar chamada',exact:true}).click();
 assert.deepEqual(errors,[]);console.log('PASS audio packets received, screen share inside voice call, camera activation, media cleanup');
 await a.bringToFront();await a.evaluate(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied','NotAllowedError');};});await a.getByRole('button',{name:'Ligar por voz'}).click();await a.getByText('Permita o microfone e a câmera para iniciar a chamada.').waitFor();assert.ok(current.ended_at);assert.equal(context.pages().length,3);console.log('PASS denied permission does not create call; caller exercised answering peer branch');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
