"use client";

import {useEffect,useRef,useState} from "react";
import {Mic,Video,Send,X,SwitchCamera} from "lucide-react";
import {composeMedia} from "@/lib/call-recording";
import {mediaFormat} from "@/lib/record-media";

export function ChatCapture({disabled,onSend,onRecording,onError}:{disabled:boolean;onSend:(file:File)=>Promise<void>;onRecording:(recording:boolean)=>void;onError:(message:string)=>void}){
 const composite=useRef<ReturnType<typeof composeMedia>|null>(null),facing=useRef<"user"|"environment">("user");
 const [switching,setSwitching]=useState(false);
 const recorder=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null),preview=useRef<HTMLVideoElement|null>(null),alive=useRef(true),discard=useRef(false),sendAfterStop=useRef(false),generation=useRef(0);
 const [mode,setMode]=useState<"audio"|"video"|null>(null),[starting,setStarting]=useState(false),[seconds,setSeconds]=useState(0),[draft,setDraft]=useState<File|null>(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;discard.current=true;if(recorder.current?.state==='recording')recorder.current.stop();stream.current?.getTracks().forEach(t=>t.stop());composite.current?.close();};},[]);
 useEffect(()=>{const cancel=()=>{generation.current++;discard.current=true;if(recorder.current?.state==='recording')recorder.current.stop();stream.current?.getTracks().forEach(t=>t.stop());composite.current?.close();setMode(null);setDraft(null);setStarting(false);onRecording(false);};window.addEventListener('flight-ia-call-active',cancel);return()=>window.removeEventListener('flight-ia-call-active',cancel);},[onRecording]);

 useEffect(()=>{if(!mode)return;const timer=setInterval(()=>setSeconds(s=>s+1),1000);return()=>clearInterval(timer);},[mode]);
 useEffect(()=>{if(mode&&seconds>=120&&recorder.current?.state==='recording')recorder.current.stop();},[seconds,mode]);
 useEffect(()=>{if(preview.current&&stream.current)preview.current.srcObject=stream.current;},[mode]);
 async function start(kind:"audio"|"video"){
  const current=++generation.current;setStarting(true);onRecording(true);onError('');discard.current=false;sendAfterStop.current=false;
  try{
   if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined')throw Error('Este navegador não permite gravar. Use o clipe para anexar um arquivo.');
   const media=await navigator.mediaDevices.getUserMedia({audio:true,video:kind==='video'?{width:{ideal:640},height:{ideal:480},facingMode:facing.current}:false});
   if(!alive.current||current!==generation.current){media.getTracks().forEach(t=>t.stop());return;}
   stream.current=media;
   const mime=(kind==='audio'?['audio/mp4','audio/webm;codecs=opus','audio/ogg;codecs=opus']:['video/mp4','video/webm;codecs=vp8,opus','video/webm']).find(t=>MediaRecorder.isTypeSupported(t));
   const recordingMedia=kind==='video'?(composite.current=composeMedia(()=>stream.current?[stream.current]:[])).stream:media;
   const rec=new MediaRecorder(recordingMedia,{...(mime?{mimeType:mime}:{}),audioBitsPerSecond:64000,...(kind==='video'?{videoBitsPerSecond:1000000}:{})});
   recorder.current=rec;const chunks:Blob[]=[];let size=0;
   rec.ondataavailable=e=>{if(e.data.size){chunks.push(e.data);size+=e.data.size;if(size>(kind==='audio'?9:48)*1024*1024&&rec.state==='recording')rec.stop();}};
   rec.onerror=()=>{discard.current=true;media.getTracks().forEach(t=>t.stop());if(alive.current){setMode(null);onRecording(false);onError('Não foi possível concluir a gravação. Tente novamente.');}};
   rec.onstop=()=>{stream.current?.getTracks().forEach(t=>t.stop());composite.current?.close();if(!alive.current)return;setMode(null);if(discard.current){onRecording(false);return;}try{const type=rec.mimeType||chunks[0]?.type||mime||'',ext=type.includes('mp4')?(kind==='audio'?'m4a':'mp4'):type.includes('ogg')?'ogg':'webm';const file=new File(chunks,`${kind==='audio'?'Audio':'Video'}-${Date.now()}.${ext}`,{type});mediaFormat(file);if(sendAfterStop.current){onRecording(false);void onSend(file);}else setDraft(file);}catch(e){onRecording(false);onError((e as Error).message);}};
   rec.start(1000);setSeconds(0);setMode(kind);
  }catch(e){onRecording(false);stream.current?.getTracks().forEach(t=>t.stop());composite.current?.close();if(alive.current)onError((e as Error).name==='NotAllowedError'?'Permita o acesso ao microfone e à câmera nas configurações do navegador.':(e as Error).message);}
  finally{if(alive.current)setStarting(false);}
 }
 async function flip(){
  if(switching||!stream.current)return;setSwitching(true);
  const media=stream.current,next=facing.current==='user'?'environment':'user';
  media.getVideoTracks().forEach(t=>{t.stop();media.removeTrack(t);});
  try{const replacement=await navigator.mediaDevices.getUserMedia({video:{facingMode:{exact:next},width:{ideal:640},height:{ideal:480}},audio:false});if(!alive.current||recorder.current?.state!=='recording'){replacement.getTracks().forEach(t=>t.stop());return;}facing.current=next;replacement.getVideoTracks().forEach(t=>media.addTrack(t));if(preview.current){preview.current.srcObject=null;preview.current.srcObject=media;}}
  catch{onError('A outra câmera não está disponível neste aparelho.');try{const restored=await navigator.mediaDevices.getUserMedia({video:{facingMode:facing.current},audio:false});if(!alive.current||recorder.current?.state!=='recording'){restored.getTracks().forEach(t=>t.stop());return;}restored.getVideoTracks().forEach(t=>media.addTrack(t));if(preview.current){preview.current.srcObject=null;preview.current.srcObject=media;}}catch{onError('Câmera indisponível. Envie o trecho já gravado ou cancele para tentar novamente.');}}
  finally{setSwitching(false);}
 }
 return <div className="flex min-w-0 items-center gap-1">
  {!starting&&!mode&&!draft?<><button type="button" title="Gravar áudio" aria-label="Gravar áudio" disabled={disabled} onClick={()=>void start('audio')} className="p-2 text-emerald-800 disabled:opacity-40"><Mic size={20}/></button><button type="button" title="Gravar vídeo" aria-label="Gravar vídeo" disabled={disabled} onClick={()=>void start('video')} className="p-2 text-emerald-800 disabled:opacity-40"><Video size={20}/></button></>:null}
  {starting?<p role="status" className="text-xs">Aguardando microfone/câmera…</p>:null}
  {mode||draft?<><button aria-label="Cancelar gravação" onClick={()=>{discard.current=true;if(recorder.current?.state==='recording')recorder.current.stop();setDraft(null);onRecording(false);}} className="p-2 text-red-700"><X size={20}/></button><span role="status" className="text-xs text-red-700">{mode?'Gravando':'Pronto'} · {seconds}s</span>{mode==='video'?<button disabled={switching} aria-label="Trocar câmera" onClick={()=>void flip()} className="p-2 text-emerald-800"><SwitchCamera size={22}/></button>:null}{mode==='video'?<video ref={preview} autoPlay muted playsInline className="absolute bottom-full right-3 mb-2 h-32 w-40 rounded-xl bg-black object-contain"/>:null}<button aria-label="Enviar gravação" disabled={disabled} onClick={()=>{if(draft){const file=draft;setDraft(null);onRecording(false);void onSend(file);}else if(recorder.current?.state==='recording'){sendAfterStop.current=true;recorder.current.stop();}}} className="grid h-11 w-11 place-items-center rounded-full bg-emerald-700 text-white disabled:opacity-40"><Send size={20}/></button></>:null}
 </div>;
}
