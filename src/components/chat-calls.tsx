"use client";

import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import type {SupabaseClient} from "@supabase/supabase-js";
import {Mic,MicOff,Video,VideoOff,Phone,PhoneOff,MonitorUp,SwitchCamera,X} from "lucide-react";
import {CallRecording,RecordedCall} from "./call-recording";
import {ModalLayer} from "./modal-layer";

type Call = {id:string;conversation_id:string;started_by:string;mode:'audio'|'video';created_at:string;ended_at:string|null;caller_name?:string;title?:string};
type Member = {employee:string;name:string;session:string;state:string};
type Signal = {id:number;sender:string;payload:{type:'offer'|'answer'|'ice';sdp?:string;candidate?:RTCIceCandidateInit}};
type Snapshot = {call:Call;ended:boolean;members:Member[];signals:Signal[]};
type Active = {snapshot:Snapshot;stream:MediaStream;session:string};
export async function callRpc<T>(client:SupabaseClient,action:string,payload:Record<string,unknown>={}):Promise<T>{
 const {data,error}=await client.rpc('chat_call',{p_action:action,p_payload:payload});
 if(error)throw Error(error.message);return data as T;
}
export function StartChatCall({conversation,disabled}:{conversation:string;disabled?:boolean}){
 return <div className="flex"><button disabled={disabled} aria-label="Ligar por voz" title="Ligar por voz" className="p-2 text-emerald-700 disabled:opacity-40" onClick={()=>window.dispatchEvent(new CustomEvent('flight-ia-start-call',{detail:{conversation,mode:'audio'}}))}><Phone size={18}/></button><button disabled={disabled} aria-label="Ligar por vídeo" title="Ligar por vídeo" className="p-2 text-emerald-700 disabled:opacity-40" onClick={()=>window.dispatchEvent(new CustomEvent('flight-ia-start-call',{detail:{conversation,mode:'video'}}))}><Video size={18}/></button></div>;
}

// Mounted independently of the chat modal so a colleague can answer anywhere in the app.
export function ChatCalls({client,user}:{client:SupabaseClient;user:string}){
 const [recorded,setRecorded]=useState<{file:File;conversation:string}|null>(null);
 const [incoming,setIncoming]=useState<Call[]>([]),[active,setActive]=useState<Active|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const activeRef=useRef<Active|null>(null),joining=useRef(false),alive=useRef(true),sound=useRef<AudioContext|null>(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;activeRef.current?.stream.getTracks().forEach(t=>t.stop());};},[]);
 useEffect(()=>{const unlock=()=>{if(!sound.current){sound.current=new AudioContext();}void sound.current.resume().catch(()=>{});};document.addEventListener('pointerdown',unlock,{once:true});return()=>{document.removeEventListener('pointerdown',unlock);void sound.current?.close();sound.current=null;};},[]);
 useEffect(()=>{if(!incoming.length||active)return;const ring=()=>{const ctx=sound.current;if(!ctx||ctx.state!=='running')return;const oscillator=ctx.createOscillator(),gain=ctx.createGain();oscillator.frequency.value=620;gain.gain.setValueAtTime(0.06,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.5);oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start();oscillator.stop(ctx.currentTime+0.5);};ring();const timer=setInterval(ring,4000);return()=>clearInterval(timer);},[incoming.length,active]);
 useEffect(()=>{let running=false;let live=true;const refresh=async()=>{if(running||activeRef.current||document.visibilityState!=='visible')return;running=true;try{const data=await callRpc<Call[]>(client,'incoming');if(live)setIncoming(data);}catch{/* Inbox continues to work when the network is offline. */}finally{running=false;}};const timer=setInterval(()=>void refresh(),4000);void refresh();window.addEventListener('flight-ia-chat-refresh',refresh);document.addEventListener('visibilitychange',refresh);return()=>{live=false;clearInterval(timer);window.removeEventListener('flight-ia-chat-refresh',refresh);document.removeEventListener('visibilitychange',refresh);};},[client,user]);
 const enter=useCallback(async(mode:'audio'|'video',conversation?:string,callId?:string)=>{
  if(joining.current||activeRef.current){setError('Encerre a chamada atual antes de iniciar outra.');return;}
  joining.current=true;setBusy(true);setError('');let media:MediaStream|undefined;let session='';let joined:Snapshot|undefined;
  try{
   if(!navigator.mediaDevices?.getUserMedia||typeof RTCPeerConnection==='undefined')throw Error('Este navegador não suporta chamadas. Abra em um navegador atualizado.');
   media=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:mode==='video'?{width:{ideal:640},height:{ideal:480},frameRate:{ideal:20}}:false});
   if(!alive.current){media.getTracks().forEach(t=>t.stop());return;}
   session=crypto.randomUUID();joined=await callRpc<Snapshot>(client,callId?'join':'start',{id:callId||crypto.randomUUID(),conversation,mode,session});
   if(joined.ended)throw Error('Esta chamada já foi encerrada.');
   if(!alive.current){media.getTracks().forEach(t=>t.stop());void callRpc(client,'leave',{id:joined.call.id,session}).catch(()=>{});return;}
   const next={snapshot:joined,stream:media,session};activeRef.current=next;setActive(next);setIncoming([]);window.dispatchEvent(new Event('flight-ia-call-active'));window.dispatchEvent(new Event('flight-ia-chat-refresh'));
  }catch(e){media?.getTracks().forEach(t=>t.stop());if(alive.current)setError((e as Error).name==='NotAllowedError'?'Permita o microfone e a câmera para iniciar a chamada.':(e as Error).message);}
  finally{joining.current=false;if(alive.current)setBusy(false);}
 },[client]);
 useEffect(()=>{const handler=(e:Event)=>{const data=(e as CustomEvent<{conversation:string;mode:'audio'|'video'}>).detail;void enter(data.mode,data.conversation);};window.addEventListener('flight-ia-start-call',handler);return()=>window.removeEventListener('flight-ia-start-call',handler);},[enter]);
 const close=()=>{activeRef.current=null;setActive(null);setIncoming([]);window.dispatchEvent(new Event('flight-ia-chat-refresh'));};
 return <>{recorded?<ModalLayer><div className="m-auto w-[min(94vw,500px)]"><RecordedCall file={recorded.file} conversation={recorded.conversation} client={client} onDone={()=>setRecorded(null)}/></div></ModalLayer>:null}{active?<CallRoom key={active.snapshot.call.id} active={active} client={client} onClose={close} onRecorded={file=>setRecorded({file,conversation:active.snapshot.call.conversation_id})}/>:incoming.length||busy||error?<ModalLayer><section className="m-auto w-[min(92vw,420px)] rounded-2xl bg-white p-6 text-slate-800 shadow-xl"><h2 className="text-lg font-bold">{busy?'Preparando chamada…':incoming[0]?`${incoming[0].caller_name||'Colega'} está ligando`:'Chamada'}</h2>{incoming[0]?<><p className="my-2 text-sm">{incoming[0].mode==='video'?'Videochamada':'Chamada de voz'} · {incoming[0].title||'Conversa'}</p><div className="mt-4 flex gap-3"><button disabled={busy} className="rounded-full bg-emerald-700 px-5 py-3 text-white" onClick={()=>void enter(incoming[0].mode,undefined,incoming[0].id)}>Atender</button><button disabled={busy} className="rounded-full bg-red-700 px-5 py-3 text-white" onClick={async()=>{const item=incoming[0];try{await callRpc(client,'decline',{id:item.id});setIncoming(items=>items.filter(c=>c.id!==item.id));}catch(e){setError((e as Error).message);}}}>Recusar</button></div></>:null}{error?<p role="alert" className="my-3 text-sm text-red-700">{error}</p>:null}{!busy?<button className="mt-3 text-sm" onClick={()=>{setError('');setIncoming([]);}}>Fechar</button>:null}</section></ModalLayer>:null}</>;
}

function StreamView({stream,name,muted=false,audioOnly=false}:{stream:MediaStream;name:string;muted?:boolean;audioOnly?:boolean}){
 const ref=useRef<HTMLVideoElement>(null),[blocked,setBlocked]=useState(false);
 useEffect(()=>{const el=ref.current;if(!el)return;el.srcObject=stream;void el.play().catch(e=>{if(e.name==='NotAllowedError'&&!muted)setBlocked(true);});return()=>{el.srcObject=null;};},[stream,muted]);
 if(audioOnly)return <div className="rounded-xl bg-slate-800 p-4"><audio ref={ref as unknown as React.RefObject<HTMLAudioElement>} autoPlay muted={muted} onPlaying={()=>setBlocked(false)}/><p>{name}</p>{blocked?<button onClick={()=>void ref.current?.play()}>Toque para ouvir</button>:null}</div>;
 return <div className="relative min-h-32 overflow-hidden rounded-xl bg-slate-800"><video aria-label={name} ref={ref} autoPlay playsInline muted={muted} onPlaying={()=>setBlocked(false)} className="h-full max-h-[55vh] min-h-32 w-full object-contain"/><span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white">{name}</span>{blocked?<button className="absolute inset-0 text-white" onClick={()=>void ref.current?.play().then(()=>setBlocked(false)).catch(()=>{})}>Toque para ouvir e ver</button>:null}</div>;
}

function CallRoom({active,client,onClose,onRecorded}:{active:Active;client:SupabaseClient;onClose:()=>void;onRecorded:(file:File)=>void}){
 const {snapshot,stream,session}=active,id=snapshot.call.id;
 const videoCall=snapshot.call.mode==='video';
 const facing=useRef<'user'|'environment'>('user'),recording=useRef(false),channels=useRef(new Map<string,RTCDataChannel>());
 const [recorders,setRecorders]=useState<Record<string,boolean>>({});
 const recordingState=(value:boolean)=>{recording.current=value;channels.current.forEach(c=>{if(c.readyState==='open')c.send(JSON.stringify({recording:value}));});};
 const [members,setMembers]=useState(snapshot.members),[remote,setRemote]=useState<Record<string,MediaStream>>({}),[connections,setConnections]=useState<Record<string,string>>({}),[error,setError]=useState(''),[ended,setEnded]=useState(false),[muted,setMuted]=useState(false),[cameraOn,setCameraOn]=useState(!!stream.getVideoTracks().length),[sharing,setSharing]=useState(false),[local,setLocal]=useState(stream),[controlBusy,setControlBusy]=useState(false);
 const peers=useRef(new Map<string,RTCPeerConnection>()),screen=useRef<MediaStream|null>(null),camera=useRef<MediaStreamTrack|null>(stream.getVideoTracks()[0]||null),mounted=useRef(true),ending=useRef(false),leave=useRef(onClose);
 useEffect(()=>{leave.current=onClose;},[onClose]);
 const release=useCallback(()=>{stream.getTracks().forEach(t=>t.stop());camera.current?.stop();screen.current?.getTracks().forEach(t=>t.stop());peers.current.forEach(pc=>pc.close());peers.current.clear();},[stream]);
 const finish=useCallback(()=>{if(ending.current)return;ending.current=true;release();void callRpc(client,'leave',{id,session}).catch(()=>{});setEnded(true);},[client,id,session,release]);
 useEffect(()=>{
  mounted.current=true;ending.current=false;let stopped=false,started=false,polling=false,cursor=0,failures=0;const ice=new Map<string,RTCIceCandidateInit[]>();const outgoing=new Map<string,Promise<void>>();
  const send=(recipient:string,payload:Signal['payload'])=>{const requestId=crypto.randomUUID();const next=(outgoing.get(recipient)||Promise.resolve()).then(async()=>{if(stopped)return;for(let n=0;n<3;n++){try{await callRpc(client,'signal',{id,session,recipient,requestId,signal:payload});return;}catch(e){if(n===2)throw e;await new Promise(resolve=>setTimeout(resolve,400));}}});outgoing.set(recipient,next.catch(()=>{}));void next.catch(e=>{if(!stopped)setError((e as Error).message);});return next;};
  const create=(other:string)=>{
   const existing=peers.current.get(other);if(existing)return existing;
   const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun.cloudflare.com:3478'}]});peers.current.set(other,pc);
   const attach=(channel:RTCDataChannel)=>{channels.current.set(other,channel);channel.onopen=()=>channel.send(JSON.stringify({recording:recording.current}));channel.onmessage=e=>{try{const message=JSON.parse(e.data);if(typeof message.recording==='boolean')setRecorders(prev=>({...prev,[other]:message.recording}));}catch{}};channel.onclose=()=>{channels.current.delete(other);setRecorders(prev=>({...prev,[other]:false}));};};
   pc.ondatachannel=e=>attach(e.channel);if(session<other)attach(pc.createDataChannel('call-status'));
   stream.getAudioTracks().forEach(t=>pc.addTrack(t,stream));
   const video=screen.current?.getVideoTracks()[0]||camera.current;
   // Only the offerer reserves an empty video channel. The answerer reuses the
   // offered channel; pre-adding one there creates an unnegotiated extra sender.
   if(video)pc.addTrack(video,stream);else if(session<other)pc.addTransceiver('video',{direction:'sendrecv',streams:[stream]});
   const incomingStream=new MediaStream();
   pc.ontrack=e=>{incomingStream.addTrack(e.track);if(!stopped)setRemote(prev=>({...prev,[other]:incomingStream}));};
   pc.onicecandidate=e=>{if(e.candidate)void send(other,{type:'ice',candidate:e.candidate.toJSON()});};
   pc.onconnectionstatechange=()=>{if(stopped)return;setConnections(prev=>({...prev,[other]:pc.connectionState}));if(pc.connectionState==='failed')setError('A rede impediu a conexão. Tente outra rede Wi-Fi ou dados móveis.');};
   return pc;
  };
  const poll=async()=>{if(stopped||polling)return;polling=true;try{
   const data=await callRpc<Snapshot>(client,'poll',{id,session,after:cursor});if(stopped)return;failures=0;
   if(data.ended){setEnded(true);release();stopped=true;return;}
   setMembers(data.members);const present=new Set(data.members.filter(m=>m.state==='joined'&&m.session!==session).map(m=>m.session));
   for(const [key,pc] of peers.current)if(!present.has(key)){pc.close();peers.current.delete(key);ice.delete(key);setRemote(prev=>{const next={...prev};delete next[key];return next;});setConnections(prev=>{const next={...prev};delete next[key];return next;});}
   for(const other of present){if(peers.current.has(other))continue;const pc=create(other);if(session<other){await pc.setLocalDescription(await pc.createOffer());await send(other,{type:'offer',sdp:pc.localDescription!.sdp});}}
   for(const message of data.signals){if(stopped)return;if(!present.has(message.sender)){cursor=message.id;continue;}const pc=create(message.sender),payload=message.payload;
    if(payload.type==='ice'){if(pc.remoteDescription)await pc.addIceCandidate(payload.candidate);else ice.set(message.sender,[...(ice.get(message.sender)||[]),payload.candidate!]);}
    else {await pc.setRemoteDescription({type:payload.type,sdp:payload.sdp});for(const candidate of ice.get(message.sender)||[])await pc.addIceCandidate(candidate);ice.delete(message.sender);if(payload.type==='offer'){const videoChannel=pc.getTransceivers().find(t=>t.receiver.track.kind==='video');if(videoChannel){videoChannel.direction='sendrecv';videoChannel.sender.setStreams(stream);}await pc.setLocalDescription(await pc.createAnswer());await send(message.sender,{type:'answer',sdp:pc.localDescription!.sdp});}}
    cursor=message.id;
   }
  }catch(e){if(!stopped){failures++;setError((e as Error).message);if(failures>=5){setEnded(true);release();stopped=true;}}}finally{polling=false;}};
  const boot=setTimeout(()=>{started=true;void poll();},0),timer=setInterval(()=>void poll(),1200);
  const unload=()=>{release();void callRpc(client,'leave',{id,session}).catch(()=>{});};window.addEventListener('pagehide',unload);
  return()=>{stopped=true;mounted.current=false;clearTimeout(boot);clearInterval(timer);window.removeEventListener('pagehide',unload);if(started){release();void callRpc(client,'leave',{id,session}).catch(()=>{});}};
 },[client,id,session,stream,release]);
 async function replaceVideo(track:MediaStreamTrack|null){await Promise.all([...peers.current.values()].map(pc=>pc.getTransceivers().find(t=>t.receiver.track.kind==='video')?.sender.replaceTrack(track)));}
 async function toggleCamera(){setControlBusy(true);try{if(!camera.current){const media=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480}},audio:false});if(!mounted.current||ending.current){media.getTracks().forEach(t=>t.stop());return;}camera.current=media.getVideoTracks()[0];stream.addTrack(camera.current);}else camera.current.enabled=!cameraOn;setCameraOn(camera.current.enabled);if(!screen.current){await replaceVideo(camera.current);setLocal(new MediaStream([...stream.getAudioTracks(),camera.current]));}}catch(e){setError((e as Error).message);}finally{setControlBusy(false);}}
 async function stopSharing(){const old=screen.current;screen.current=null;old?.getTracks().forEach(t=>t.stop());if(!mounted.current||ending.current)return;await replaceVideo(camera.current);setSharing(false);setLocal(new MediaStream([...stream.getAudioTracks(),...(camera.current?[camera.current]:[])]));}
 async function share(){if(!navigator.mediaDevices?.getDisplayMedia){setError('Este navegador não permite compartilhar a tela. Use um computador com Chrome ou Edge. Você pode continuar vendo a tela compartilhada pelo colega.');return;}if(screen.current){await stopSharing();return;}setControlBusy(true);try{const media=await navigator.mediaDevices.getDisplayMedia({video:{width:{ideal:960},height:{ideal:540},frameRate:{ideal:15,max:20}},audio:false});if(!mounted.current||ending.current){media.getTracks().forEach(t=>t.stop());return;}screen.current=media;await replaceVideo(media.getVideoTracks()[0]);media.getVideoTracks()[0].onended=()=>void stopSharing().catch(e=>setError(e.message));setSharing(true);setLocal(media);}catch(e){screen.current?.getTracks().forEach(t=>t.stop());screen.current=null;setSharing(false);await replaceVideo(camera.current).catch(()=>{});setError((e as Error).name==='NotAllowedError'?'Compartilhamento cancelado ou bloqueado pelo navegador.':(e as Error).message);}finally{setControlBusy(false);}}
 async function flipCamera(){if(controlBusy||sharing)return;setControlBusy(true);const next=facing.current==='user'?'environment':'user';camera.current?.stop();try{const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:{exact:next},width:{ideal:640},height:{ideal:480}},audio:false});if(!mounted.current||ending.current){media.getTracks().forEach(t=>t.stop());return;}stream.getVideoTracks().forEach(t=>stream.removeTrack(t));camera.current=media.getVideoTracks()[0];stream.addTrack(camera.current);facing.current=next;await replaceVideo(camera.current);setCameraOn(true);setLocal(new MediaStream(stream.getTracks()));}catch{setError('Não foi possível abrir a outra câmera. Toque em Ligar câmera para tentar novamente.');camera.current=null;setCameraOn(false);}finally{setControlBusy(false);}}
 const recordingLocal=useMemo(()=>new MediaStream([...stream.getAudioTracks(),...local.getVideoTracks()]),[stream,local]);
 const connected=Object.values(connections).filter(s=>s==='connected').length;
 return <ModalLayer><section className="m-auto flex max-h-[94dvh] w-[min(96vw,1000px)] flex-col overflow-hidden rounded-2xl bg-slate-950 text-white shadow-xl"><header className="flex items-center justify-between p-4"><div><h2 className="font-bold">{ended?'Chamada encerrada':connected?'Em chamada':'Chamando / conectando…'}</h2><p className="text-xs text-slate-300">{members.filter(m=>m.state==='joined').length} participantes · até 6 pessoas</p></div><button aria-label={ended?"Fechar chamada":"Encerrar chamada"} onClick={ended?onClose:finish} className={`rounded-full bg-red-700 p-3 ${!videoCall&&!ended?"hidden":""}`}><PhoneOff size={20}/></button></header><div className="grid min-h-0 flex-1 gap-3 overflow-auto p-3 sm:grid-cols-2">{videoCall?<StreamView stream={local} name={sharing?'Sua tela':'Você'} muted/>:null}{Object.entries(remote).map(([key,media])=><StreamView key={key} audioOnly={!videoCall} stream={media} name={members.find(m=>m.session===key)?.name||'Colega'}/>)}{!connected&&!ended?<p role="status" className="p-4 text-sm">Aguardando os colegas atenderem e a conexão de áudio/vídeo.</p>:null}</div>{error?<p role="alert" className="px-4 py-2 text-sm text-amber-200">{error}</p>:null}<footer className="flex flex-wrap justify-center gap-3 p-4">{ended?<button onClick={onClose} className="rounded-xl bg-slate-700 px-4 py-2">Fechar</button>:<><button aria-label={muted?'Ativar microfone':'Silenciar microfone'} className="rounded-full bg-slate-700 p-3" onClick={()=>{stream.getAudioTracks().forEach(t=>t.enabled=muted);setMuted(!muted);}}>{muted?<MicOff/>:<Mic/>}</button>{videoCall?<><button disabled={controlBusy} aria-label={cameraOn?'Desligar câmera':'Ligar câmera'} className="rounded-full bg-slate-700 p-3" onClick={()=>void toggleCamera()}>{cameraOn?<Video/>:<VideoOff/>}</button><button disabled={controlBusy} aria-label={sharing?'Parar compartilhamento':'Compartilhar tela'} className="rounded-full bg-slate-700 p-3 disabled:opacity-30" onClick={()=>void share()}><MonitorUp/></button><button disabled={controlBusy||sharing} aria-label="Trocar câmera" onClick={()=>void flipCamera()} className="rounded-full bg-slate-700 p-3"><SwitchCamera/></button></>:null}<button aria-label={videoCall?"Encerrar":"Encerrar chamada"} onClick={finish} className="inline-flex items-center gap-2 rounded-full bg-red-700 px-5 py-3"><X size={18}/>Encerrar</button></>}</footer>{Object.entries(recorders).some(([key,value])=>value&&members.some(m=>m.session===key&&m.state==='joined'))?<p role="status" className="bg-red-800 p-2 text-center">● Um participante está gravando esta chamada</p>:null}{videoCall?<div className="p-3"><CallRecording streams={[recordingLocal,...Object.values(remote)]} ended={ended} onState={recordingState} onRecorded={onRecorded}/></div>:null}</section></ModalLayer>;
}
