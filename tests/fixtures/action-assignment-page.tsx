"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/immutability -- This fixture mutates an in-memory fake server, never application state. */
// Synthetic fixture, mounted only under a temporary local route.
import {useEffect,useMemo,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {ActionFields,type Person} from '../../src/components/action-fields';
import {TaskExecutionHistory} from '../../src/components/maintenance-records';
import {PostDialog,type WallPost} from '../../src/components/operational-wall';
const stamp=new Date().toISOString();
const people:Person[]=[{employeeNumber:'001',displayName:'Ana Mecânica',profile:'mechanic',assignedBase:'QA',fleets:['S92'],mission:'mission_1',workShift:'day'},{employeeNumber:'002',displayName:'Bruno Mecânico',profile:'mechanic',assignedBase:'QA',fleets:['AW139'],mission:'mission_2',workShift:'night'},{employeeNumber:'003',displayName:'Piloto excluído',profile:'commander',assignedBase:'QA',fleets:[],mission:'',workShift:''},{employeeNumber:'004',displayName:'Outra base',profile:'mechanic',assignedBase:'OTHER',fleets:[],mission:'',workShift:''}];
const initial:WallPost={id:'qa-post',title:'Verificar indicação',body:'Atividade sintética',base:'QA',audienceArea:'maintenance',category:'Procedimentos',priority:'routine',pinned:false,essential:false,resolved:false,createdBy:'AUTHOR',createdAt:stamp,updatedAt:stamp,revision:1,attachments:[],comments:[],views:[],acknowledgements:[],history:[],actions:[{id:'qa-action',prefix:'PR-QAT',title:'Verificar indicação',description:'',assignedTo:'',status:'pending',views:[],acknowledgements:[],executions:[],createdAt:stamp}]};
export default function Page(){
 const [ready,setReady]=useState(false),[screen,setScreen]=useState('create'),[viewer,setViewer]=useState('AUTHOR'),[post,setPost]=useState(initial),[assigned,setAssigned]=useState<string[]>([]),[title,setTitle]=useState('Verificar indicação'),[category,setCategory]=useState('Procedimentos'),[tc,setTc]=useState(''),[plan,setPlan]=useState({}),[error,setError]=useState(''),[signature,setSignature]=useState(true);
 useEffect(()=>{const timer=window.setTimeout(()=>setReady(true),0);return()=>window.clearTimeout(timer);},[]);
 const store=useMemo(()=>({post:structuredClone(initial)}),[]);
 const client=useMemo(()=>{
  const channel:any={on:()=>channel,subscribe:()=>channel};
  const query=()=>{const proxy:any=new Proxy({}, {get(_target,key){if(key==='then')return (resolve:any)=>Promise.resolve({data:{data:store.post,revision:store.post.revision,base:'QA'},error:null}).then(resolve);return ()=>proxy;}});return proxy;};
  return {auth:{getSession:async()=>({data:{session:{access_token:'synthetic',user:{id:'00000000-0000-4000-8000-000000000000'}}}})},channel:()=>channel,removeChannel:()=>{},from:query,rpc:async(name:string,args:any={})=>{
   if(name==='get_operational_assignments')return {data:people.map(p=>({employee_number:p.employeeNumber,display_name:p.displayName,access_profile:p.profile,assigned_base:p.assignedBase,fleets:p.fleets,mission:p.mission,work_shift:p.workShift})),error:null};
   if(name==='edit_maintenance_action'){const response=await fetch('/api/fixture-action',{method:'POST',body:JSON.stringify(args)});const result=await response.json();if(result.error)return result;store.post={...store.post,title:args.p_title,revision:store.post.revision+1,actions:store.post.actions.map(a=>a.id===args.p_action_id?{...a,title:args.p_title,assignedTo:args.p_assigned_to===null?a.assignedTo:args.p_assigned_to.join(', ')}:a)};return {data:{data:store.post,revision:store.post.revision},error:null};}
   if(name==='activity_chat')return {data:{conversations:[],exists:false,member:false},error:null};
   return {data:[],error:null};
  }} as unknown as SupabaseClient;
 },[store]);
 const requireSignature=async(action:()=>void|Promise<void>)=>{if(!signature)return false;await action();return true;};
 return <main data-hydrated={ready} className="min-h-screen bg-slate-50 p-4 text-slate-900"><nav className="mb-4 flex flex-wrap gap-3">{['create','record','activity'].map(s=><button key={s} className="rounded border bg-white p-3" onClick={()=>{if(s==="activity")setPost({...store.post});setScreen(s);}}>{s}</button>)}<label>Usuário<select aria-label="Usuário" value={viewer} onChange={e=>setViewer(e.target.value)}><option value="AUTHOR">Coordenador autor</option><option value="001">Mecânico destinatário</option></select></label><label><input type="checkbox" checked={signature} onChange={e=>setSignature(e.target.checked)}/>Autorizar assinatura</label></nav>
 {screen==='create'?<div className="mx-auto max-w-2xl"><ActionFields categories={['Procedimentos']} category={category} onCategory={setCategory} title={title} onTitle={setTitle} tc={tc} onTc={setTc} plan={plan} onPlan={setPlan} people={people.filter(p=>p.assignedBase==='QA')} assigned={assigned} onAssigned={setAssigned}/><output data-testid="selected">{assigned.join(',')}</output></div>:screen==='record'?<div className="mx-auto max-w-2xl"><TaskExecutionHistory people={people} supabase={client} postId={post.id} user={viewer} leadership={viewer==='AUTHOR'} canExecute={false} requireSignature={requireSignature} onError={setError}/></div>:<PostDialog post={post} user={viewer} isAdmin={viewer==='AUTHOR'} supabase={client} mediaUrls={{}} requireSignature={requireSignature} onActionSaved={async()=>setPost({...store.post})} onRecordTask={async()=>false} onClose={()=>setScreen('create')} canDelete={false} onDelete={()=>{}} onAddComment={async()=>false} onObserve={change=>setPost(change)} onChange={async change=>{setPost(change);return true;}} onError={setError}/>}
 {error?<p role="alert">{error}</p>:null}
 </main>;
}
