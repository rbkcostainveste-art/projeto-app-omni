"use client";
import {useEffect,useMemo,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {RecordDialog,type MaintenanceRecord} from '@/components/maintenance-records';
import {AssistantForm} from '@/components/assistant-form';
import {AssistantWorkspaceProvider,AssistantTarget} from '@/components/assistant-workspace';
import type {AssistantApplyResult} from '@/lib/assistant-application';

const initial:MaintenanceRecord={id:'11111111-1111-4111-8111-111111111111',ticketCode:'QA-APPLICATION',prefix:'PR-OHG',model:'S92',base:'QA',recordType:'fault',priority:'not_logged',status:'open',title:'hsi miscompaire',description:'hsi miscompaire',tc:'',assignedTo:[],links:[],entries:[],createdBy:'TEST',createdAt:'2026-09-10T12:00:00Z',updatedAt:'2026-09-10T12:00:00Z',revision:1,technicalCase:{report:'report',official:'evaluation',aircraft:'evaluation',investigation:'triage',originalObservation:{title:'hsi miscompaire',description:'hsi miscompaire',spoken:'hsi miscompaire'}}};
function App(){
 const [ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);
 const [record,setRecord]=useState(initial),[opened,setOpened]=useState(false),[mode,setMode]=useState('report'),[title,setTitle]=useState('Original'),[permit,setPermit]=useState(true);
 const client=useMemo(()=>{
  const entries:unknown[]=[];const channel={on:()=>channel,subscribe:()=>channel};
  const result=()=>Promise.resolve({data:[],error:null});
  const query:unknown=new Proxy({}, {get:(_target,key)=>key==='then'?result().then.bind(result()):()=>query});
  return {channel:()=>channel,removeChannel:async()=>{},auth:{getSession:async()=>({data:{session:{access_token:'synthetic'}}})},from:()=>query,rpc:async(name:string,args:{p_action:string;p_payload:Record<string,string>})=>{
   if(name==='maintenance_chat')return {data:{record:{id:initial.id,type:'fault',code:initial.ticketCode},links:[],exists:false,member:false},error:null};
   if(name==='technical_case_action'){
    if(args.p_action==='config')return {data:{data:{cdlEnabled:false,procedures:[]},permissions:{},revision:1},error:null};
    return fetch('/api/fixture-technical',{method:'POST',body:JSON.stringify(args)}).then(r=>r.json());
   }
   if(name==='personal_assistant'){
    let data:unknown=[];if(args.p_action==='create_conversation')data={id:args.p_payload.id,title:'Teste',created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
    if(args.p_action==='list')data=entries;
    if(args.p_action==='append'){data={id:entries.length+1,message:args.p_payload.message,reply:args.p_payload.reply,created_at:new Date().toISOString()};entries.push(data);}
    return {data,error:null};
   }
   return {data:[],error:null};
  }} as unknown as SupabaseClient;
 },[]);
 async function applyForm(values:Record<string,string>):Promise<void|AssistantApplyResult>{
  if(mode==='noop')return;
  if(mode==='failed')throw Error('Gravação recusada pelo servidor.');
  if(values.title!==undefined)setTitle(values.title);
  if(mode==='saved')return {status:'saved',message:'Alteração salva e confirmada pelo servidor.'};
 }
 return <main data-hydrated={ready} className="p-4"><AssistantTarget id="root" label="Verificação da aplicação" priority={0} revision="1" content={null}/><h1>Verificação da aplicação da IA</h1><select aria-label="Modo do teste" value={mode} onChange={e=>{setMode(e.target.value);setTitle('Original');setRecord(initial);}}>{['report','draft','saved','failed','noop'].map(m=><option key={m}>{m}</option>)}</select><label><input aria-label="Autorizar assinatura" type="checkbox" checked={permit} onChange={e=>setPermit(e.target.checked)}/>Autorizar assinatura</label>{mode==='report'?<button onClick={()=>setOpened(true)}>Abrir relato</button>:<><label>Título do formulário<input aria-label="Título do formulário" value={title} onChange={e=>setTitle(e.target.value)}/></label><AssistantForm client={client} user="TEST" form={{id:'application-form',label:'Formulário do setor',mode:['saved','failed'].includes(mode)?'record':'draft',fields:{title:{label:'Título',value:title}}}} onApply={applyForm}/></>}{opened?<RecordDialog item={record} all={[record]} people={[]} user="TEST" userDirectory={{}} leadership={false} canExecute canDelete={false} supabase={client} requireSignature={async action=>{if(!permit)return false;await action();return true;}} onCommentsRead={()=>{}} onError={console.error} onClose={()=>setOpened(false)} onDelete={()=>{}} onUpdate={async()=>{}} onRecordSaved={row=>setRecord({...record,title:row.title,description:row.data.description||'',revision:row.revision,technicalCase:row.technical_case,tc:row.tc||''})} onLink={async()=>false} onGenerate={async()=>false}/>:null}</main>;
}
export default function Page(){return <AssistantWorkspaceProvider><App/></AssistantWorkspaceProvider>;}
