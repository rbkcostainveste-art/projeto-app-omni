"use client";
import {useEffect,useRef,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {composeMedia} from '@/lib/call-recording';
import {mediaFormat,type RecordMedia} from '@/lib/record-media';

export function CallRecording({streams,ended,onRecorded,onState}:{streams:MediaStream[];ended:boolean;onRecorded:(file:File)=>void;onState:(active:boolean)=>void}){
 const latest=useRef(streams);useEffect(()=>{latest.current=streams;},[streams]);
 const recorder=useRef<MediaRecorder|null>(null),cleanup=useRef<()=>void>(()=>{}),callbacks=useRef({onRecorded,onState});useEffect(()=>{callbacks.current={onRecorded,onState};},[onRecorded,onState]);
 const [recording,setRecording]=useState(false),[error,setError]=useState('');
 useEffect(()=>()=>{if(recorder.current?.state==='recording')recorder.current.stop();else cleanup.current();},[]);
 useEffect(()=>{if(ended&&recorder.current?.state==='recording')recorder.current.stop();},[ended]);
 function start(){try{
  const composite=composeMedia(()=>latest.current);cleanup.current=composite.close;
  const mime=['video/webm;codecs=vp8,opus','video/mp4','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
  const rec=new MediaRecorder(composite.stream,{...(mime?{mimeType:mime}:{}),videoBitsPerSecond:900000,audioBitsPerSecond:64000});recorder.current=rec;
  const chunks:Blob[]=[];let size=0;const timer=setTimeout(()=>{if(rec.state==='recording')rec.stop();},300000);
  rec.ondataavailable=e=>{if(e.data.size){chunks.push(e.data);size+=e.data.size;if(size>=45*1024*1024&&rec.state==='recording')rec.stop();}};
  rec.onstop=()=>{clearTimeout(timer);composite.close();setRecording(false);callbacks.current.onState(false);const type=rec.mimeType||mime||'video/webm';if(chunks.length)callbacks.current.onRecorded(new File(chunks,`Videochamada-${Date.now()}.${type.includes('mp4')?'mp4':'webm'}`,{type}));};
  rec.onerror=()=>{setError('A gravação foi interrompida. Salve o trecho disponível.');if(rec.state==='recording')rec.stop();};
  rec.start(1000);setRecording(true);callbacks.current.onState(true);
 }catch(e){cleanup.current();setError((e as Error).message);}}
 return <div className="text-center"><button disabled={ended&&!recording} className="rounded-full bg-slate-700 px-4 py-3 disabled:opacity-40" onClick={()=>recording?recorder.current?.stop():start()}>{recording?'● Parar gravação':'Gravar chamada'}</button><p className="mt-1 text-xs">{recording?'Gravando áudio e vídeo':'Até 5 minutos por trecho'}</p>{error?<p role="alert">{error}</p>:null}</div>;
}

export function RecordedCall({file,conversation,client,onDone}:{file:File;conversation:string;client:SupabaseClient;onDone:()=>void}){
 const [url,setUrl]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const attempt=useRef<{requestId:string;attachment?:RecordMedia}>({requestId:crypto.randomUUID()});
 useEffect(()=>{const value=URL.createObjectURL(file);const timer=setTimeout(()=>setUrl(value),0);return()=>{clearTimeout(timer);URL.revokeObjectURL(value);};},[file]);
 async function send(){if(busy)return;setBusy(true);setError('');try{
  if(!attempt.current.attachment){const format=mediaFormat(file),{data,error}=await client.auth.getUser();if(error||!data.user)throw Error('Entre novamente para enviar.');const id=crypto.randomUUID(),path=`${conversation}/${data.user.id}/${id}.${file.name.split('.').pop()}`;const uploaded=await client.storage.from('internal-chat').upload(path,file,{contentType:format.contentType});if(uploaded.error)throw uploaded.error;attempt.current.attachment={id,name:file.name,type:'video',url:path,bucket:'internal-chat'};}
  const {error}=await client.rpc('internal_chat',{p_action:'send',p_payload:{id:conversation,requestId:attempt.current.requestId,body:'Gravação da videochamada',attachments:[attempt.current.attachment]}});if(error)throw error;window.dispatchEvent(new Event('flight-ia-chat-refresh'));onDone();
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="rounded-xl bg-white p-4 text-slate-900"><h3 className="font-bold">Gravação pronta</h3><p className="my-2 text-sm">Salve ou envie antes de sair desta página.</p><video controls src={url||undefined} className="max-h-40 w-full"/><div className="mt-3 flex flex-wrap gap-3"><a href={url} download={file.name} className="rounded-lg border p-2">Salvar vídeo</a><button disabled={busy} onClick={()=>void send()} className="rounded-lg bg-emerald-700 p-2 text-white">{busy?'Enviando…':'Enviar na conversa'}</button><button disabled={busy} onClick={onDone}>Descartar</button></div>{error?<p role="alert" className="text-red-700">{error} Tente enviar novamente.</p>:null}</section>;
}
