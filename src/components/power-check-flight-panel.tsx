"use client";
import {useEffect,useState,useId} from "react";
import type {SupabaseClient} from "@supabase/supabase-js";
import {PowerCheckResult,type CrewFlight,type CrewMaintenanceAction} from "./crew-dashboard";
import {uploadRecordMedia} from "@/lib/record-media";

type Props={client:SupabaseClient|null;flight:CrewFlight;flights:CrewFlight[];user:string;isCrew:boolean;readOnly:boolean;requireSignature:(action:()=>void|Promise<void>,label?:string)=>Promise<boolean>;onError:(message:string)=>void};
export function PowerCheckFlightPanel({client,flight,flights,user,isCrew,readOnly,requireSignature,onError}:Props){
 const subscriptionId=useId();
 const[items,setItems]=useState<CrewMaintenanceAction[]>([]);
 useEffect(()=>{
  if(!client)return;
  let active=true;
  const load=async()=>{
   if(isCrew){
    const{data,error}=await client.rpc("list_crew_maintenance_actions");
    if(error){onError(error.message);return;}
    if(active)setItems((data as CrewMaintenanceAction[]||[]).filter(a=>a.category==="Power Check"&&a.flightId===flight.id));
   }else{
    const{data,error}=await client.from("operational_wall_posts").select("id,data,created_at").eq("resolved",false).eq("base",flight.base).eq("data->>category","Power Check");
    if(error){onError(error.message);return;}
    const next:CrewMaintenanceAction[]=[];
    for(const post of data||[]){
     if(post.data?.category!=="Power Check")continue;
     for(const action of post.data.actions||[]){
      if(["satisfactory","resolved","closed","ok"].includes(action.status))continue;
      const createdDay=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(post.created_at));
      const candidate=flights.filter(f=>f.prefix===action.prefix&&f.base===flight.base&&!f.deletedAt&&!f.cancelled&&!f.maintenancePostId&&(!(f.operationEndedAt||f.actualShutdown)||Date.parse(f.operationEndedAt||`${f.date}T${f.actualShutdown}:00-03:00`)>=Date.parse(post.created_at))&&f.date>=createdDay).sort((a,b)=>(a.date+a.departure).localeCompare(b.date+b.departure))[0];
      if(candidate?.id===flight.id)next.push({...action,postId:post.id,category:"Power Check",createdAt:post.created_at});
     }
    }
    if(active)setItems(next);
   }
  };
  void load();const timer=setInterval(()=>void load(),15000);
  const channel=client.channel(`power-check-flight-${flight.id}-${subscriptionId}`).on("postgres_changes",{event:"*",schema:"public",table:"operational_wall_posts"},()=>void load()).subscribe();
  return()=>{active=false;clearInterval(timer);void client.removeChannel(channel);};
 },[client,flight.id,flight.base,flights,isCrew,onError,subscriptionId]);
 const pending=items.filter(a=>!["satisfactory","resolved","closed","ok","completed"].includes(a.status));
 if(!pending.length)return null;
 return <section aria-label="Manutenção do voo" className="m-3 rounded-xl border border-violet-200 bg-violet-50 p-3"><h3 className="font-bold">Manutenção · Power Check</h3>{pending.map(item=><PowerCheckResult key={item.id} returned={Boolean(flight.actualShutdown||flight.shutdown==="ok"||flight.operationEndedAt)} readOnly={readOnly} onSave={async(description,result,files)=>{
  if(!client||!item.postId||readOnly)return false;
  let saved=false;
  await requireSignature(async()=>{
   const attachments=await uploadRecordMedia(client,files,`wall/${item.postId}`,user);
   const{error}=await client.rpc("record_maintenance_task_result",{p_post_id:item.postId,p_description:description,p_result:result,p_request_id:crypto.randomUUID(),p_attachments:attachments});
   if(error){onError(error.message);return;}
   saved=true;setItems(current=>current.map(a=>a.id===item.id?{...a,status:result}:a));
  },"Confirmar resultado do Power Check");
  return saved;
 }}/>)}</section>;
}
