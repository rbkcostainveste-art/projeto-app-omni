"use client";

import {useEffect,useRef,useState} from "react";
import {Mic,Video,Square,X,Phone} from "lucide-react";
import {mediaFormat} from "@/lib/record-media";

export function ChatCapture({disabled,onAttach,onError}:{disabled:boolean;onAttach:(file:File)=>void;onError:(message:string)=>void}){
 const recorder=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null),preview=useRef<HTMLVideoElement|null>(null),alive=useRef(true),discard=useRef(false);
 const [mode,setMode]=useState<"audio"|"video"|null>(null),[starting,setStarting]=useState(false),[seconds,setSeconds]=useState(0),[draft,setDraft]=useState<{file:File;url:string}|null>(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;discard.current=true;if(recorder.current?.state==='recording')recorder.current.stop();stream.current?.getTracks().forEach(t=>t.stop());};},[]);
 useEffect(()=>()=>{if(draft)URL.revokeObjectURL(draft.url);},[draft]);
 useEffect(()=>{if(!mode)return;const timer=setInterval(()=>setSeconds(s=>s+1),1000);return()=>clearInterval(timer);},[mode]);
 useEffect(()=>{if(mode&&seconds>=120&&recorder.current?.state==='recording')recorder.current.stop();},[seconds,mode]);
 useEffect(()=>{if(preview.current&&stream.current)preview.current.srcObject=stream.current;},[mode]);
 async function start(kind:"audio"|"video"){
  setStarting(true);onError('');discard.current=false;
  try{
   if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined')throw Error('Este navegador não permite gravar. Use o clipe para anexar um arquivo.');
   const media=await navigator.mediaDevices.getUserMedia({audio:true,video:kind==='video'?{width:{ideal:640},height:{ideal:480},facingMode:'user'}:false});
   if(!alive.current){media.getTracks().forEach(t=>t.stop());return;}
   stream.current=media;
   const mime=(kind==='audio'?['audio/mp4','audio/webm;codecs=opus','audio/ogg;codecs=opus']:['video/mp4','video/webm;codecs=vp8,opus','video/webm']).find(t=>MediaRecorder.isTypeSupported(t));
   const rec=new MediaRecorder(media,{...(mime?{mimeType:mime}:{}),audioBitsPerSecond:64000,...(kind==='video'?{videoBitsPerSecond:1000000}:{})});
   recorder.current=rec;const chunks:Blob[]=[];let size=0;
   rec.ondataavailable=e=>{if(e.data.size){chunks.push(e.data);size+=e.data.size;if(size>(kind==='audio'?9:48)*1024*1024&&rec.state==='recording')rec.stop();}};
   rec.onerror=()=>{discard.current=true;media.getTracks().forEach(t=>t.stop());if(alive.current){setMode(null);onError('Não foi possível concluir a gravação. Tente novamente.');}};
   rec.onstop=()=>{media.getTracks().forEach(t=>t.stop());if(!alive.current)return;setMode(null);if(discard.current)return;try{const type=rec.mimeType||chunks[0]?.type||mime||'',ext=type.includes('mp4')?(kind==='audio'?'m4a':'mp4'):type.includes('ogg')?'ogg':'webm';const file=new File(chunks,`${kind==='audio'?'Audio':'Video'}-${Date.now()}.${ext}`,{type});mediaFormat(file);setDraft({file,url:URL.createObjectURL(file)});}catch(e){onError((e as Error).message);}};
   rec.start(1000);setSeconds(0);setMode(kind);
  }catch(e){stream.current?.getTracks().forEach(t=>t.stop());if(alive.current)onError((e as Error).name==='NotAllowedError'?'Permita o acesso ao microfone e à câmera nas configurações do navegador.':(e as Error).message);}
  finally{if(alive.current)setStarting(false);}
 }
 return <div className="flex items-center gap-1">
  <button type="button" title="Gravar áudio" aria-label="Gravar áudio" disabled={disabled||starting||!!mode||!!draft} onClick={()=>void start('audio')} className="p-2 text-emerald-800 disabled:opacity-40"><Mic size={20}/></button>
  <button type="button" title="Gravar vídeo" aria-label="Gravar vídeo" disabled={disabled||starting||!!mode||!!draft} onClick={()=>void start('video')} className="p-2 text-emerald-800 disabled:opacity-40"><Video size={20}/></button>
  {starting||mode||draft?<div role="dialog" aria-label="Gravação da mensagem" className="absolute inset-x-2 bottom-full z-20 mb-2 rounded-xl border bg-white p-3 shadow-lg">
   {starting?<p role="status">Aguardando acesso ao microfone/câmera…</p>:null}
   {mode?<><p role="status" className="text-sm text-red-700">Gravando · {seconds}s / 120s</p>{mode==='video'?<video ref={preview} autoPlay muted playsInline className="max-h-44 w-full"/>:null}<button aria-label="Parar gravação" onClick={()=>recorder.current?.stop()} className="m-2 inline-flex items-center gap-2"><Square size={16}/>Parar</button><button onClick={()=>{discard.current=true;recorder.current?.stop();}} className="m-2">Cancelar</button></>:null}
   {draft?<>{draft.file.type.startsWith('video')?<video controls playsInline src={draft.url} className="max-h-44 w-full"/>:<audio controls src={draft.url} className="w-full"/>}<p className="mt-2 text-xs">Confira antes de anexar e enviar.</p><button disabled={disabled} onClick={()=>{onAttach(draft.file);setDraft(null);}} className="mt-2 rounded-lg bg-emerald-700 p-2 text-sm text-white">Usar gravação</button><button aria-label="Descartar gravação" onClick={()=>setDraft(null)} className="ml-3 p-2"><X size={18}/></button></>:null}
  </div>:null}
 </div>;
}

export function ChatCallTest({disabled,onInvite}:{disabled:boolean;onInvite:(text:string)=>void}){
 const [open,setOpen]=useState(false);
 return <div><button aria-label="Chamada de voz ou vídeo" title="Chamada de voz ou vídeo" onClick={()=>setOpen(v=>!v)} className="p-2 text-emerald-800"><Phone size={18}/></button>{open?<div className="absolute inset-x-3 top-14 z-30 rounded-xl border bg-white p-4 shadow-xl"><p className="font-bold">Chamada pelo Jitsi · teste</p><p className="my-2 text-xs">Abre em outra aba. Quem inicia precisa entrar numa conta no Jitsi. Compartilhe o convite nesta conversa; quem tiver o link poderá entrar. A gravação da reunião não será salva no aplicativo.</p><div className="flex flex-wrap gap-2">{(['Voz','Vídeo'] as const).map(kind=><button key={kind} disabled={disabled} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white disabled:opacity-40" onClick={()=>{const url=`https://meet.jit.si/FlightIA-${crypto.randomUUID()}${kind==='Voz'?'#config.startWithVideoMuted=true':''}`;onInvite(`Convite para chamada de ${kind.toLowerCase()} pelo Jitsi:\n${url}`);setOpen(false);}}>Preparar convite de {kind.toLowerCase()}</button>)}<button className="p-2 text-sm" onClick={()=>setOpen(false)}>Cancelar</button></div></div>:null}</div>;
}
