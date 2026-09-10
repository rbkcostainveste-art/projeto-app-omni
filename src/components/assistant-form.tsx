"use client";
import type {SupabaseClient} from '@supabase/supabase-js';
import {useEffect,useState} from 'react';
import type {AssistantFormContext} from '@/lib/assistant-form';
import {AssistantTarget,useAssistantWorkspace} from './assistant-workspace';
import {AssistantConversations} from './assistant-conversations';
import {AiAssistant} from './flight-board';

/** Explicit adapter: only the owner of a form can apply its validated fields. */
export function AssistantForm({form,client,user:providedUser,onApply,disabled=false}:{form:AssistantFormContext;client:SupabaseClient|null;user?:string;onApply:(values:Record<string,string>)=>void|Promise<void>;disabled?:boolean}){
 const workspace=useAssistantWorkspace();
 const [identity,setIdentity]=useState('');
 useEffect(()=>{if(providedUser||!client)return;let live=true;void Promise.resolve(client.rpc('refresh_current_device')).then(({data,error})=>{if(live)setIdentity(!error&&typeof data?.employeeNumber==='string'?data.employeeNumber:'');}).catch(()=>{if(live)setIdentity('');});return()=>{live=false;};},[client,providedUser]);
 const user=providedUser||identity;if(!user)return null;
 const content=<AssistantConversations direct client={client} user={user} context={{id:form.id,label:form.label,kind:'general'}} onClose={()=>workspace?.close()} renderConversation={(id,back,title)=><AiAssistant key={id} conversationId={id} conversationTitle={title} area={form.label} form={form} onApplyForm={onApply} disabled={disabled} client={client} user={user} onClose={back} allowFlightCreation={false} flights={[]} catalogs={{aircraft:[],bases:[],models:[],users:[]}} onCreate={()=>{}}/>}/>;
 return <><AssistantTarget id={`form:${form.id}`} label={form.label} priority={5} revision={JSON.stringify([form,disabled])} content={content}/><button type="button" aria-label={`Preencher ou conversar com IA · ${form.label}`} disabled={disabled} onClick={()=>workspace?.open(`form:${form.id}`)} className="mb-3 min-h-11 rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-700">Preencher ou conversar com IA</button></>;
}
