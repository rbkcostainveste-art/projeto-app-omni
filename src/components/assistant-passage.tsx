"use client";
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Passage,PassageCheckKey} from './runway-handover';
import {passageAssistantForm,passageAssistantPatch} from '@/lib/assistant-passage';
import {AssistantForm} from './assistant-form';
import {ModalLayer} from './modal-layer';

export function PassageAssistant({item,labels,client,user,readOnly,onChange,requireSignature}:{item:Passage;labels:Partial<Record<PassageCheckKey,string>>;client:SupabaseClient|null;user:string;readOnly:boolean;onChange:(id:string,change:(item:Passage)=>Passage)=>void;requireSignature:(action:()=>void|Promise<void>,label?:string)=>Promise<boolean>}){
 const latest=useRef({item,readOnly});useLayoutEffect(()=>{latest.current={item,readOnly};},[item,readOnly]);
 const [washLabels,setWashLabels]=useState<string[]>([]);const resolveWash=useRef<((ok:boolean)=>void)|null>(null);
 useEffect(()=>()=>resolveWash.current?.(false),[]);
 function finish(ok:boolean){resolveWash.current?.(ok);resolveWash.current=null;setWashLabels([]);}
 async function apply(values:Record<string,string>){
  const snapshot=latest.current.item;if(latest.current.readOnly)throw Error('Registro somente para leitura.');
  const proposed=passageAssistantPatch(snapshot,labels,values,user,new Date().toISOString());
  if(proposed.washes.length){const accepted=await new Promise<boolean>(resolve=>{resolveWash.current=resolve;setWashLabels(proposed.washes.map(k=>labels[k]||k));});if(!accepted)throw Error('Lavagem não confirmada. Nenhuma alteração aplicada.');}
  const ok=await requireSignature(()=>{const current=latest.current;if(current.readOnly||current.item.revision!==snapshot.revision||current.item.updatedAt!==snapshot.updatedAt)throw Error('A passagem mudou. Revise o pedido novamente.');onChange(snapshot.id,record=>passageAssistantPatch(record,labels,values,user,new Date().toISOString()).next);},'Confirmar alterações da passagem');
  if(!ok)throw Error('Alteração não confirmada.');
 }
 return <><AssistantForm client={client} user={user} disabled={readOnly} form={passageAssistantForm(item,labels)} onApply={apply}/>{washLabels.length?<ModalLayer><section data-assistant-suspend role="dialog" aria-modal="true" aria-label="Confirmar lavagens propostas" className="fixed inset-0 grid place-items-center bg-slate-950/60 p-4"><div className="max-w-md rounded-2xl bg-white p-5"><h2 className="text-xl font-bold">Confirmar lavagem realizada</h2><p className="mt-3">{item.prefix} · {washLabels.join(', ')}</p><p className="mt-3 text-sm">Estas confirmações geram pendência de giro de secagem. Confirme somente as lavagens que foram realizadas.</p><div className="mt-5 flex flex-wrap justify-end gap-2"><button className="min-h-11 rounded-xl border px-4" onClick={()=>finish(false)}>Voltar</button><button className="min-h-11 rounded-xl bg-blue-700 px-4 text-white" onClick={()=>finish(true)}>Confirmar lavagem e gerar secagem</button></div></div></section></ModalLayer>:null}</>;
}
