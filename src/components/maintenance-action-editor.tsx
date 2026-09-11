"use client";
import {useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {assignmentIds} from '@/lib/action-assignment';
import {AssignmentPicker,type Person} from './action-fields';

export type SavedActionPost = {data:Record<string,unknown>;revision:number};
export function MaintenanceActionEditor({client,postId,actionId,title,assignedTo,revision,base,canEdit,people:providedPeople,onSaved,requireSignature}:{
 client:SupabaseClient|null;postId:string;actionId:string;title:string;assignedTo:string;revision:number;base:string;canEdit:boolean;people?:Person[];
 onSaved:(row:SavedActionPost)=>void|Promise<void>;requireSignature:(action:()=>void|Promise<void>,label?:string)=>Promise<boolean>;
}){
 const [editing,setEditing]=useState(false),[text,setText]=useState(''),[assigned,setAssigned]=useState<string[]>([]),[expected,setExpected]=useState(0),[people,setPeople]=useState<Person[]>(providedPeople||[]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const names=assignmentIds(assignedTo).map(id=>(providedPeople||people).find(p=>p.employeeNumber===id)?.displayName||`Mat. ${id}`);
 async function start(){
  if(!client||busy)return;setBusy(true);setError('');
  try{
   if(!providedPeople){const {data,error}=await client.rpc('get_operational_assignments');if(error)throw Error(error.message);setPeople((data||[]).map((p:{employee_number:string;display_name:string;access_profile:string;assigned_base:string;fleets:string[];mission:string;work_shift:string})=>({employeeNumber:p.employee_number,displayName:p.display_name,profile:p.access_profile,assignedBase:p.assigned_base||'',fleets:p.fleets||[],mission:p.mission||'',workShift:p.work_shift||''})));}
   setText(title);setAssigned(assignmentIds(assignedTo));setExpected(revision);setEditing(true);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function save(){
  if(!client||busy||!text.trim())return;setBusy(true);setError('');
  try{await requireSignature(async()=>{
   const changed=JSON.stringify(assigned)!==JSON.stringify(assignmentIds(assignedTo));
   const {data,error}=await client.rpc('edit_maintenance_action',{p_post_id:postId,p_title:text.trim(),p_expected_revision:expected,p_assigned_to:changed?assigned:null,p_action_id:actionId});
   if(error)throw Error(error.message);if(!data?.data||typeof data.revision!=='number')throw Error('O servidor não confirmou a alteração.');
   await onSaved(data);setEditing(false);
  },'Confirmar alteração da ação');}catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <section aria-label="Designação da ação" className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/40 p-3">
  <p className="text-sm"><strong>Executantes: </strong>{names.length?names.join(', '):'Ainda não designados'}</p>
  {canEdit&&!editing?<button type="button" disabled={busy} onClick={()=>void start()} className="min-h-11 rounded-lg border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-800">{busy?'Carregando…':'Editar ação e designação'}</button>:null}
  {editing?<><label className="block text-sm font-semibold">Finalidade da ação<textarea aria-label="Finalidade da ação" rows={4} value={text} onChange={e=>setText(e.target.value)} disabled={busy} className="mt-2 w-full rounded-xl border bg-white p-3 font-normal"/></label><AssignmentPicker expanded people={(providedPeople||people).filter(p=>p.assignedBase===base)} value={assigned} onChange={setAssigned} disabled={busy}/><p className="text-xs text-slate-600">A alteração fica no histórico e é destacada para a equipe.</p><div className="flex flex-wrap gap-2"><button type="button" disabled={busy||!text.trim()} onClick={()=>void save()} className="min-h-11 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white disabled:opacity-50">{busy?'Salvando…':'Salvar alterações da ação'}</button><button type="button" disabled={busy} onClick={()=>setEditing(false)} className="min-h-11 rounded-lg border bg-white px-4 text-sm">Cancelar</button></div></>:null}
  {error?<p role="alert" className="text-sm text-red-700">{error}</p>:null}
 </section>;
}
