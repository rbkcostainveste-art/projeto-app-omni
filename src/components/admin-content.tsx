"use client";
import {useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {Trash2,X} from 'lucide-react';
import {ModalLayer} from './modal-layer';

type Kind={kind:string;label:string;count:number};
type Row={key:Record<string,string|number>;label:string;date?:string};
type FileRemoval={bucket:string;name:string};
export function AdminContent({client}:{client:SupabaseClient|null}){
 const [open,setOpen]=useState(false),[kinds,setKinds]=useState<Kind[]>([]),[kind,setKind]=useState('shared_flights'),[rows,setRows]=useState<Row[]>([]),[selected,setSelected]=useState<Set<number>>(new Set()),[offset,setOffset]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 async function rpc<T>(action:string,extra:Record<string,unknown>={}):Promise<T>{
  if(!client)throw Error('Conexão indisponível');
  const {data,error}=await client.rpc('admin_content',{p_action:action,...extra});if(error)throw Error(error.message);return data as T;
 }
 async function load(nextKind=kind,nextOffset=offset){
  setBusy(true);setError('');setSelected(new Set());
  try{const catalog=await rpc<Kind[]>('catalog');const page=await rpc<{rows:Row[]}>('list',{p_kind:nextKind,p_offset:nextOffset});setKinds(catalog);setRows(page.rows);setKind(nextKind);setOffset(nextOffset);}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function cleanFiles(){
  const files=await rpc<FileRemoval[]>('pending_files');
  for(const bucket of new Set(files.map(file=>file.bucket))){
   const group=files.filter(file=>file.bucket===bucket);
   for(let i=0;i<group.length;i+=100){const batch=group.slice(i,i+100);const {error}=await client!.storage.from(bucket).remove(batch.map(file=>file.name));if(error)throw Error(`Registros excluídos; anexos pendentes: ${error.message}`);await rpc('file_done',{p_keys:batch});}
  }
 }
 async function remove(){
  if(!selected.size||!window.confirm(`Excluir definitivamente ${selected.size} item(ns) de ${kinds.find(item=>item.kind===kind)?.label}? Os registros e anexos vinculados também serão removidos.`))return;
  setBusy(true);setError('');setMessage('');
  try{await rpc('delete',{p_kind:kind,p_keys:rows.filter((_,i)=>selected.has(i)).map(row=>row.key),p_confirmation:'EXCLUIR'});await cleanFiles();setMessage('Conteúdo excluído.');window.dispatchEvent(new Event('flight-ia-chat-refresh'));await load(kind,0);}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <><button onClick={()=>{setOpen(true);setMessage('');void load(kind,0);}} className="m-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-300 px-4 py-2 font-semibold text-red-700"><Trash2 size={18}/>Gerenciar e excluir conteúdo</button>{open?<ModalLayer><div className="fixed inset-0 flex items-center justify-center bg-slate-950/60 p-3"><section aria-label="Exclusão de conteúdo" className="flex max-h-[92dvh] w-full max-w-3xl flex-col rounded-2xl bg-white text-slate-800 shadow-xl"><header className="flex items-center justify-between border-b p-4"><h2 className="font-bold">Conteúdo do aplicativo · ADM</h2><button disabled={busy} aria-label="Fechar exclusão de conteúdo" onClick={()=>setOpen(false)} className="p-2"><X/></button></header><div className="overflow-y-auto p-4"><p className="mb-3 text-sm">Selecione os registros para exclusão definitiva, inclusive encerrados e criados por outras pessoas. Cadastros de pessoas, aeronaves e bases são gerenciados nas respectivas áreas.</p><label className="block text-sm font-semibold">Tipo de conteúdo<select disabled={busy} value={kind} onChange={e=>{setMessage('');void load(e.target.value,0);}} className="mt-1 min-h-11 w-full rounded-lg border p-2">{kinds.map(item=><option key={item.kind} value={item.kind}>{item.label} · {item.count}</option>)}</select></label>{error?<p role="alert" className="my-3 text-sm text-red-700">{error}</p>:null}{message?<p role="status" className="my-3 text-sm text-emerald-700">{message}</p>:null}<div className="my-3 flex flex-wrap gap-2"><button disabled={busy||!rows.length} onClick={()=>setSelected(selected.size===rows.length?new Set():new Set(rows.map((_,i)=>i)))} className="min-h-11 rounded-lg border px-3">Selecionar esta página</button><button disabled={busy||!selected.size} onClick={()=>void remove()} className="min-h-11 rounded-lg bg-red-700 px-3 text-white disabled:opacity-40">Excluir selecionados ({selected.size})</button><button disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await cleanFiles();await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}} className="min-h-11 rounded-lg border px-3">Concluir exclusão de anexos</button></div>{busy?<p role="status">Aguarde…</p>:null}<ul className="divide-y">{rows.map((row,i)=><li key={JSON.stringify(row.key)}><label className="flex cursor-pointer items-start gap-3 py-3"><input type="checkbox" disabled={busy} checked={selected.has(i)} onChange={()=>setSelected(current=>{const next=new Set(current);if(next.has(i))next.delete(i);else next.add(i);return next;})} className="mt-1 h-5 w-5 shrink-0"/><span className="min-w-0 break-words text-sm"><strong>{row.label}</strong>{row.date?<small className="block text-slate-500">{row.date}</small>:null}<small className="block break-all text-slate-500">{Object.values(row.key).join(' · ')}</small></span></label></li>)}</ul>{!busy&&!rows.length?<p className="py-6 text-center text-sm">Nenhum conteúdo nesta categoria.</p>:null}<div className="mt-3 flex justify-between"><button disabled={busy||offset===0} onClick={()=>void load(kind,Math.max(0,offset-100))} className="min-h-11 px-3 disabled:opacity-40">Anterior</button><button disabled={busy||rows.length<100} onClick={()=>void load(kind,offset+100)} className="min-h-11 px-3 disabled:opacity-40">Próxima</button></div></div></section></div></ModalLayer>:null}</>;
}
