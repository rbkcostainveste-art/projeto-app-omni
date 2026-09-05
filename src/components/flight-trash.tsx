"use client";

import {useRef,useState} from 'react';
import {RotateCcw,Trash2,X} from 'lucide-react';

type TrashedFlight={id:string;prefix:string;date:string;departure:string;model:string;base:string;deletedBy?:string};
export function FlightTrash({flights,onClose,onRestore,onDelete}:{flights:TrashedFlight[];onClose:()=>void;onRestore:(id:string)=>void;onDelete:(id:string)=>Promise<boolean>}){
 const [selected,setSelected]=useState<Set<string>>(new Set());
 const [confirmation,setConfirmation]=useState<string[]|null>(null);
 const [busy,setBusy]=useState(false);const lock=useRef(false);
 const [message,setMessage]=useState('');const [progress,setProgress]=useState(0);
 const selectedIds=flights.filter(f=>selected.has(f.id)).map(f=>f.id);
 const allSelected=flights.length>0&&selectedIds.length===flights.length;
 async function remove(){
  if(!confirmation||lock.current)return;lock.current=true;setBusy(true);setMessage('');setProgress(0);
  const ids=confirmation.filter(id=>flights.some(f=>f.id===id));const failed:string[]=[];
  for(const [index,id] of ids.entries()){
   try{if(!await onDelete(id))failed.push(id);}catch{failed.push(id);}
   setProgress(index+1);
  }
  setSelected(current=>new Set([...current].filter(id=>!ids.includes(id)||failed.includes(id))));
  setMessage(`${ids.length-failed.length} voo(s) excluído(s).${failed.length?` ${failed.length} não foram excluídos e continuam selecionados para tentar novamente.`:''}`);
  setConfirmation(null);setBusy(false);lock.current=false;
 }
 return <div className="fixed inset-0 z-50 grid place-items-center bg-[#071a30]/60 p-2 backdrop-blur-sm" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose();}}><section role="dialog" aria-modal="true" aria-labelledby="flight-trash-title" className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
  <header className="flex justify-between gap-3 border-b p-4"><div><h2 id="flight-trash-title" className="text-xl font-bold">Lixeira de voos · {flights.length}</h2><p className="mt-1 text-xs text-[#718197]">Selecione todos e desmarque os voos que deseja manter.</p></div><button disabled={busy} onClick={onClose} aria-label="Fechar lixeira"><X size={20}/></button></header>
  <div className="flex flex-wrap items-center gap-3 border-b bg-slate-50 p-4"><label className="flex min-h-10 items-center gap-2 text-sm font-bold"><input type="checkbox" checked={allSelected} disabled={busy||!flights.length||Boolean(confirmation)} ref={node=>{if(node)node.indeterminate=selectedIds.length>0&&!allSelected;}} onChange={()=>setSelected(allSelected?new Set():new Set(flights.map(f=>f.id)))}/>Selecionar todos</label><span className="text-xs">{selectedIds.length} selecionado(s)</span><button disabled={busy||!selectedIds.length||Boolean(confirmation)} onClick={()=>setSelected(new Set())} className="text-xs text-blue-700 disabled:opacity-40">Limpar seleção</button><button disabled={busy||!selectedIds.length||Boolean(confirmation)} onClick={()=>setConfirmation(selectedIds)} className="min-h-10 rounded-lg bg-red-700 px-3 text-xs font-bold text-white disabled:opacity-40">Excluir selecionados ({selectedIds.length})</button><button disabled={busy||!flights.length||Boolean(confirmation)} onClick={()=>setConfirmation(flights.map(f=>f.id))} className="min-h-10 rounded-lg border border-red-200 px-3 text-xs font-bold text-red-700 disabled:opacity-40">Esvaziar lixeira</button></div>
  {confirmation?<div className="border-b border-red-200 bg-red-50 p-4"><p className="font-bold">Excluir definitivamente {confirmation.length} voo(s)?</p><p className="mt-1 text-sm">Esta ação não poderá ser desfeita.</p><div className="mt-3 flex gap-2"><button disabled={busy} onClick={()=>void remove()} className="min-h-10 rounded-lg bg-red-700 px-3 text-sm font-bold text-white disabled:opacity-50">{busy?`Excluindo ${progress}/${confirmation.length}…`:'Confirmar exclusão definitiva'}</button><button disabled={busy} onClick={()=>setConfirmation(null)} className="min-h-10 rounded-lg border bg-white px-3 text-sm">Cancelar</button></div></div>:null}
  {message?<p role="status" className="border-b p-3 text-sm">{message}</p>:null}
  <div className="flex-1 space-y-2 overflow-y-auto p-4">{flights.map(flight=><article key={flight.id} className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${selected.has(flight.id)?'border-blue-300 bg-blue-50':'border-slate-200'}`}><input type="checkbox" aria-label={`Selecionar ${flight.prefix} ${flight.date} ${flight.departure}`} checked={selected.has(flight.id)} disabled={busy||Boolean(confirmation)} onChange={()=>setSelected(current=>{const next=new Set(current);if(next.has(flight.id))next.delete(flight.id);else next.add(flight.id);return next;})}/><div className="min-w-0 flex-1"><p className="font-bold">{flight.prefix} · {flight.date} {flight.departure}</p><p className="text-xs text-[#718197]">{flight.model} · {flight.base} · enviado à lixeira por {flight.deletedBy??'administrador'}</p></div><button disabled={busy||Boolean(confirmation)} onClick={()=>onRestore(flight.id)} className="flex min-h-10 items-center gap-1 rounded-lg bg-blue-50 px-3 text-xs font-bold text-blue-700"><RotateCcw size={14}/>Restaurar</button><button disabled={busy||Boolean(confirmation)} onClick={()=>setConfirmation([flight.id])} className="flex min-h-10 items-center gap-1 rounded-lg bg-red-50 px-3 text-xs font-bold text-red-700"><Trash2 size={14}/>Excluir</button></article>)}{!flights.length?<p className="py-12 text-center font-bold">A lixeira está vazia.</p>:null}</div>
 </section></div>;
}
