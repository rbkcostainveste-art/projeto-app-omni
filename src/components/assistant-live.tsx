"use client";
import {useEffect,useRef,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {Video,SwitchCamera,Mic,MicOff,PhoneOff} from 'lucide-react';

export function AssistantLive({conversationId,client,user,disabled,onActive,onTranscript}:{conversationId?:string;client:SupabaseClient|null;user:string;disabled:boolean;onActive:(active:boolean)=>void;onTranscript:(message:string,reply:string)=>void}){
 const [active,setActive]=useState(false),[ready,setReady]=useState(false),[muted,setMuted]=useState(false),[error,setError]=useState(''),[caption,setCaption]=useState(''),[switching,setSwitching]=useState(false);
 const video=useRef<HTMLVideoElement>(null),audio=useRef<HTMLAudioElement>(null),media=useRef<MediaStream|null>(null),peer=useRef<RTCPeerConnection|null>(null),channel=useRef<RTCDataChannel|null>(null),timer=useRef<ReturnType<typeof setInterval>|null>(null),limit=useRef<ReturnType<typeof setTimeout>|null>(null),timeout=useRef<ReturnType<typeof setTimeout>|null>(null),abort=useRef<AbortController|null>(null);
 const generation=useRef(0),facing=useRef<'user'|'environment'>('environment'),lastImage=useRef(''),lines=useRef<{role:string;text:string}[]>([]),callbacks=useRef({onActive,onTranscript});
 useEffect(()=>{callbacks.current={onActive,onTranscript};},[onActive,onTranscript]);
 function release(){generation.current++;abort.current?.abort();if(timer.current)clearInterval(timer.current);if(limit.current)clearTimeout(limit.current);if(timeout.current)clearTimeout(timeout.current);channel.current?.close();peer.current?.close();media.current?.getTracks().forEach(t=>t.stop());media.current=null;peer.current=null;channel.current=null;callbacks.current.onActive(false);
  const recorded=lines.current;lines.current=[];if(recorded.length)callbacks.current.onTranscript('[Conversa ao vivo com câmera]\n'+recorded.filter(x=>x.role==='user').map(x=>x.text).join('\n'),recorded.filter(x=>x.role==='assistant').map(x=>x.text).join('\n')||'Conversa encerrada sem resposta da IA.');
 }
 useEffect(()=>()=>release(),[]); // Release camera, audio and connection when leaving Messages.
 function stop(){release();setActive(false);setReady(false);}
 function sendFrame(){const el=video.current,dc=channel.current;if(!el?.videoWidth||dc?.readyState!=='open'||dc.bufferedAmount>100000)return;
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=Math.round(el.videoHeight*512/el.videoWidth);canvas.getContext('2d')!.drawImage(el,0,0,canvas.width,canvas.height);
  let image=canvas.toDataURL('image/jpeg',0.55);if(image.length>60000){canvas.width=320;canvas.height=Math.round(el.videoHeight*320/el.videoWidth);canvas.getContext('2d')!.drawImage(el,0,0,canvas.width,canvas.height);image=canvas.toDataURL('image/jpeg',0.4);}if(image.length>60000)return;
  const id='item_'+crypto.randomUUID().replaceAll('-','').slice(0,24);
  dc.send(JSON.stringify({type:'conversation.item.create',item:{id,type:'message',role:'user',content:[{type:'input_image',image_url:image}]}}));
  if(lastImage.current)dc.send(JSON.stringify({type:'conversation.item.delete',item_id:lastImage.current}));lastImage.current=id;
 }
 async function start(){if(active||disabled)return;const current=++generation.current;setActive(true);setReady(false);setError('');setCaption('');setMuted(false);lines.current=[];lastImage.current='';callbacks.current.onActive(true);
  try{
   if(!client||!navigator.mediaDevices?.getUserMedia)throw Error('Permita câmera e microfone em um navegador atualizado.');
   const captured=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:{facingMode:facing.current,width:{ideal:640},height:{ideal:480}}});
   if(current!==generation.current){captured.getTracks().forEach(t=>t.stop());return;}media.current=captured;if(video.current)video.current.srcObject=captured;
   const pc=new RTCPeerConnection();peer.current=pc;captured.getAudioTracks().forEach(t=>pc.addTrack(t,captured));
   pc.ontrack=e=>{if(audio.current){audio.current.srcObject=e.streams[0]||new MediaStream([e.track]);void audio.current.play().catch(()=>setError('Toque no player de áudio para ouvir o assistente.'));}};
   pc.onconnectionstatechange=()=>{if(current===generation.current&&pc.connectionState==='failed'){setError('A conexão caiu. Inicie novamente.');stop();}};
   const dc=pc.createDataChannel('oai-events');channel.current=dc;
   dc.onopen=()=>{if(current!==generation.current)return;if(timeout.current)clearTimeout(timeout.current);setReady(true);sendFrame();timer.current=setInterval(()=>{if(document.visibilityState==='visible')sendFrame();},3000);limit.current=setTimeout(()=>{setError('Sessão de 5 minutos concluída. Você pode iniciar outra.');stop();},300000);};
   dc.onclose=()=>{if(current===generation.current){setError('A sessão ao vivo foi encerrada.');stop();}};
   dc.onmessage=e=>{if(current!==generation.current)return;try{const event=JSON.parse(e.data);
    if(event.type==='error')setError(event.error?.message||'Falha na conversa ao vivo.');
    if(event.type==='conversation.item.input_audio_transcription.completed'&&event.transcript){lines.current.push({role:'user',text:event.transcript});setCaption('Você: '+event.transcript);}
    if((event.type==='response.output_audio_transcript.done'||event.type==='response.audio_transcript.done')&&event.transcript){lines.current.push({role:'assistant',text:event.transcript});setCaption('Assistente: '+event.transcript);}
   }catch{}};
   const offer=await pc.createOffer();await pc.setLocalDescription(offer);
   const {data}=await client.auth.getSession();if(!data.session)throw Error('Entre novamente para usar a câmera com IA.');
   if(current!==generation.current)return;abort.current=new AbortController();
   const response=await fetch('/api/ai/live',{method:'POST',headers:{'Content-Type':'application/sdp',Authorization:`Bearer ${data.session.access_token}`,'x-employee':user,...(conversationId?{'x-conversation-id':conversationId}:{})},body:offer.sdp,signal:abort.current.signal});
   if(!response.ok){const data=await response.json();throw Error(data.error||'Não foi possível conectar.');}
   const answer=await response.text();if(current!==generation.current)return;await pc.setRemoteDescription({type:'answer',sdp:answer});
   timeout.current=setTimeout(()=>{if(dc.readyState!=='open'){setError('A IA não conectou. Tente novamente.');stop();}},20000);
  }catch(e){if(current!==generation.current)return;setError((e as Error).name==='NotAllowedError'?'Permita câmera e microfone nas configurações do navegador.':(e as Error).message);stop();}
 }
 async function flip(){if(switching||!media.current)return;setSwitching(true);const current=generation.current,next=facing.current==='user'?'environment':'user';media.current.getVideoTracks().forEach(t=>{t.stop();media.current?.removeTrack(t);});try{const replacement=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{exact:next},width:{ideal:640},height:{ideal:480}}});if(current!==generation.current){replacement.getTracks().forEach(t=>t.stop());return;}replacement.getVideoTracks().forEach(t=>media.current?.addTrack(t));facing.current=next;if(video.current){video.current.srcObject=null;video.current.srcObject=media.current;}}catch{setError('Não foi possível trocar a câmera. Encerre e reconecte para tentar novamente.');}finally{setSwitching(false);}}
 return <div>{!active?<button disabled={disabled} onClick={()=>void start()} className="flex items-center gap-2 rounded-full px-3 py-2 text-sm text-emerald-800 disabled:opacity-40" aria-label="Câmera ao vivo com assistente"><Video size={20}/>Câmera ao vivo</button>:<section className="rounded-xl bg-slate-900 p-3 text-white"><video ref={video} muted autoPlay playsInline className="max-h-64 w-full rounded-lg object-contain"/><audio ref={audio} autoPlay controls className="mt-2 h-8 w-full"/><p role="status" className="my-2 text-xs">{ready?'Ao vivo · fale com a IA. A imagem é atualizada a cada 3 segundos.':'Conectando câmera e voz…'}</p><div className="flex flex-wrap gap-2"><button aria-label="Trocar câmera" disabled={switching} onClick={()=>void flip()} className="rounded-full bg-slate-700 p-3"><SwitchCamera size={20}/></button><button aria-label={muted?'Ativar microfone':'Silenciar microfone'} onClick={()=>{media.current?.getAudioTracks().forEach(t=>t.enabled=muted);setMuted(!muted);}} className="rounded-full bg-slate-700 p-3">{muted?<MicOff size={20}/>:<Mic size={20}/>}</button><button disabled={!ready} onClick={()=>{sendFrame();channel.current?.send(JSON.stringify({type:'response.create',response:{instructions:'Descreva brevemente o que vê na imagem mais recente e pergunte como pode ajudar.'}}));}} className="rounded-full bg-emerald-700 px-3 text-xs">Analisar agora</button><button aria-label="Encerrar câmera com IA" onClick={stop} className="rounded-full bg-red-700 p-3"><PhoneOff size={20}/></button></div>{caption?<p className="mt-2 text-sm">{caption}</p>:null}</section>}{error?<p role="alert" className="p-2 text-sm text-red-700">{error}</p>:null}</div>;
}
