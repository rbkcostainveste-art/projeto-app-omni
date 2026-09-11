"use client";
import {useEffect,useState,useId} from "react";
import type {SupabaseClient} from "@supabase/supabase-js";
import {PowerCheckResult,type CrewFlight,type CrewMaintenanceAction} from "./crew-dashboard";
import {ModalLayer} from "./modal-layer";
import {Clock3,Wrench,X} from "lucide-react";
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

export function PowerCheckTrailCard(props:Props){
 const[open,setOpen]=useState(false);
 const{flight}=props;
 const returned=Boolean(flight.actualShutdown||flight.shutdown==="ok"||flight.operationEndedAt);
 return <><button type="button" onClick={()=>setOpen(true)} aria-label={`Abrir Power Check · ${flight.prefix}`} className="animate-rise w-full self-start rounded-2xl border border-l-[5px] border-violet-400 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Wrench size={17} className="text-violet-600"/><h3 className="font-mono text-xl font-extrabold text-[#17324d]">{flight.prefix}</h3></div><p className="mt-1 text-xs font-semibold text-[#526b82]">{flight.model} · {flight.destination||flight.base}</p><p className="mt-2 text-xs font-bold text-[#17324d]">Power Check</p></div><span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-extrabold text-violet-700">Pendente</span></div><div className="mt-4 grid grid-cols-2 gap-2 text-sm"><div><span className="block text-[#7d8da0]">Voo vinculado</span><strong className="mt-1 flex items-center gap-1"><Clock3 size={13}/>{flight.departure}</strong></div><div><span className="block text-[#7d8da0]">Resultado</span><strong className="mt-1 block text-xs">{returned?"A confirmar":"Após o retorno"}</strong></div></div><div className="mt-3 flex items-center justify-between border-t border-[#e6edf4] pt-3 text-[10px] font-semibold text-[#718197]"><span>{flight.date.split("-").reverse().join("/")}</span><span>Não bloqueia o voo</span></div></button>{open?<ModalLayer><div className="fixed inset-0 z-50 grid place-items-end bg-[#071a30]/60 backdrop-blur-sm sm:place-items-center sm:p-4" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false);}}><section role="dialog" aria-modal="true" aria-label={`Power Check · ${flight.prefix}`} className="max-h-[94dvh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl"><header className="flex items-center justify-between border-b p-4"><h2 className="font-bold">{flight.prefix} · Power Check</h2><button type="button" aria-label="Fechar Power Check" onClick={()=>setOpen(false)} className="rounded-full border p-2"><X size={19}/></button></header><PowerCheckFlightPanel {...props}/></section></div></ModalLayer>:null}</>;
}
