"use client";

import { useEffect,useMemo,useRef,useState } from "react";
import { Bell,Bot,CalendarDays,Check,ChevronDown,Clock3,Fuel,Gauge,LogOut,Menu,Mic,MicOff,Plane,Plus,RotateCcw,Search,Settings,ShieldCheck,Trash2,Upload,UserRound,X } from "lucide-react";
import { createSupabaseClient } from "@/lib/supabase";
import { Passage,RunwayHandover } from "@/components/runway-handover";
import { AircraftPicker } from "@/components/aircraft-picker";

type CheckValue="pending"|"ok"|"no";
type TimelineView="all"|"operational"|"finished"|"cancelled";
type FuelUnit="L"|"lb"|"kg";
type FlightHistory={ field: string; value: string; employeeNumber: string; at: string; revision?: number };
type SpeechResultEvent={ results: ArrayLike<{ 0: { transcript: string } }> };
type SpeechRecognitionLike={ lang:string; interimResults:boolean; continuous:boolean; onresult:((event:SpeechResultEvent)=>void)|null; onerror:((event:{error:string})=>void)|null; onend:(()=>void)|null; start:()=>void; stop:()=>void };
type Flight={
  id: string; prefix: string; model: string; base: string; date: string; departure: string;
  duration: number; fuelAmount: number; fuelUnit: FuelUnit; fuel: CheckValue; preflight: CheckValue; hums: CheckValue;
  engineStart: CheckValue; shutdown: CheckValue; revision: number; acknowledged: Record<string,number>;
  actualEngineStart?: string; actualShutdown?: string; completedAt?: string; cancelled?: boolean; cancellationReason?: string; cancelledAt?: string; deletedAt?: string; deletedBy?: string; actionBy?: Record<string,string>; fieldRevisions?: Record<string,number>; history?: FlightHistory[]; createdBy: string; updatedBy: string;
};
type Catalogs={ bases: string[]; models: string[]; aircraft: { prefix: string; model: string; base: string; available?: boolean; unavailabilityReason?: string; availabilityUpdatedBy?: string; }[]; users: { employeeNumber: string; name: string; }[]; };

const demoCatalogs: Catalogs={
  bases: ["Jacarepaguá","Macaé","Cabo Frio","Vitória"],
  models: ["H145","AW139","S-76C++","H225"],
  aircraft: [
    { prefix: "PR-OMN",model: "H145",base: "Jacarepaguá" },{ prefix: "PP-AZU",model: "S-76C++",base: "Macaé" },{ prefix: "PR-LFT",model: "AW139",base: "Cabo Frio" },
  ],
  users: [{ employeeNumber: "1024",name: "Operador de teste" },{ employeeNumber: "1031",name: "Operador 1031" },{ employeeNumber: "1048",name: "Operador 1048" }],
};

const demoFlights: Flight[]=[];

const checkLabels={ fuel: "Abastecimento",preflight: "Pré-voo",hums: "HUMS",engineStart: "Acionamento",shutdown: "Corte" } as const;
type CheckKey=keyof typeof checkLabels;
const supabase=createSupabaseClient();
const vapidPublicKey="BBWuHqLMza7mVt6d3KJ34hlLQDAPiyzLS02IjP5wyiNMoUgegKawRUtrY0TBU3RSvZ9xmMZmbDWg4YX_HWSZPfU";

function arrivalTime(flight: Pick<Flight,"departure"|"duration"|"actualEngineStart">) {
  const [hour,minute]=(flight.actualEngineStart??flight.departure).split(":").map(Number);
  const total=hour*60+minute+Math.round(flight.duration*60);
  return `${String(Math.floor(total/60)%24).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`;
}

function flightStatus(flight: Flight,user: string) {
  if(flight.cancelled) return { key: "cancelled",label: "Voo cancelado",color: "#dc2626" };
  if(flight.shutdown==="ok") return { key: "finished",label: "Voo encerrado",color: "#94a3b8" };
  if(flight.engineStart==="ok") return { key: "flying",label: "Em voo",color: "#22a06b" };
  if((flight.acknowledged[user]??0)>=flight.revision) return { key: "aware",label: "Ciente",color: "#2383e2" };
  return { key: "attention",label: "Aguardando ciência",color: "#f2b824" };
}

function todayLocal() { const now=new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`; }
function durationToClock(duration:number) { const total=Math.max(0,Math.round(duration*60)); return `${String(Math.floor(total/60)).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`; }
function clockToDuration(value:string) { const [hours,minutes]=value.split(":").map(Number); return (hours*60+minutes)/60; }
function timelineCategory(flight:Flight):Exclude<TimelineView,"all"> { return flight.cancelled?"cancelled":flight.shutdown==="ok"||Boolean(flight.actualShutdown)?"finished":"operational"; }
function timelineTime(flight:Flight) { const latest=flight.history?.at(-1)?.at; return Date.parse(latest??flight.completedAt??flight.cancelledAt??`${flight.date}T${flight.departure}:00-03:00`); }
function fieldChanged(flight:Flight,user:string,field:string) { return (flight.fieldRevisions?.[field]??0)>(flight.acknowledged[user]??0); }
function urlBase64ToUint8Array(value:string) { const padding="=".repeat((4-value.length%4)%4); const base64=(value+padding).replace(/-/g,"+").replace(/_/g,"/"); return Uint8Array.from(atob(base64),(character)=>character.charCodeAt(0)); }
function changedPatch<T>(before:T,after:T):Partial<T> { const patch:Record<string,unknown>={}; for(const key of Object.keys(after as object)) { const previous=(before as Record<string,unknown>)[key]; const next=(after as Record<string,unknown>)[key]; if(JSON.stringify(previous)!==JSON.stringify(next)) patch[key]=next; } return patch as Partial<T>; }

export function FlightBoard() {
  const [workspace,setWorkspace]=useState<"flights"|"passage">("flights");
  const [user,setUser]=useState("");
  const [login,setLogin]=useState("1024");
  const [password,setPassword]=useState("1234");
  const [loginError,setLoginError]=useState("");
  const [flights,setFlights]=useState<Flight[]>(demoFlights);
  const [passages,setPassages]=useState<Passage[]>([]);
  const [hydrated,setHydrated]=useState(false);
  const [newOpen,setNewOpen]=useState(false);
  const [adminOpen,setAdminOpen]=useState(false);
  const [aiOpen,setAiOpen]=useState(false);
  const [trashOpen,setTrashOpen]=useState(false);
  const [catalogs,setCatalogs]=useState<Catalogs>(demoCatalogs);
  const [filtersOpen,setFiltersOpen]=useState(false);
  const [filters,setFilters]=useState({ date: todayLocal(),base: "",model: "",prefix: "" });
  const [timelineView,setTimelineView]=useState<TimelineView>("all");
  const [syncReady,setSyncReady]=useState(false);
  const [syncError,setSyncError]=useState("");
  const [alerts,setAlerts]=useState<Record<string,number>>({});
  const lastRemoteState=useRef("");
  const lastRemoteCatalogs=useRef("");
  const pendingMutations=useRef(0);
  const passageSaveTimers=useRef(new Map<string,{timer:number;patch:Partial<Passage>}>());
  const localSnapshot=useRef({flights,catalogs,passages});

  useEffect(() => {
    const restore=window.setTimeout(() => {
      const stored=localStorage.getItem("passagem-de-pista-flights");
      const storedUser=localStorage.getItem("passagem-de-pista-user");
      const storedCatalogs=localStorage.getItem("passagem-de-pista-catalogs");
      const storedPassages=localStorage.getItem("passagem-de-pista-cards");
      const isCurrentFlightData=localStorage.getItem("passagem-de-pista-flights-version")==="2";
      if(stored&&isCurrentFlightData) setFlights((JSON.parse(stored) as Flight[]).map((flight) => ({ ...flight,fuelUnit: flight.fuelUnit??"L",actionBy: flight.actionBy??{},history: flight.history??[] })));
      else { setFlights([]); localStorage.setItem("passagem-de-pista-flights-version","2"); }
      if(storedCatalogs) {
        const parsed=JSON.parse(storedCatalogs) as Catalogs;
        const isCurrentCatalog=localStorage.getItem("passagem-de-pista-catalogs-version")==="3";
        setCatalogs({ ...parsed,users: parsed.users??demoCatalogs.users,aircraft: parsed.aircraft.map((item) => ({ ...item,available: item.available??true,base: isCurrentCatalog&&item.base? item.base:demoCatalogs.aircraft.find((demo) => demo.prefix===item.prefix)?.base||parsed.bases[0]||"" })) });
      }
      if(storedPassages) setPassages(JSON.parse(storedPassages) as Passage[]);
      if(storedUser) setUser(storedUser);
      setHydrated(true);
    },0);
    return () => window.clearTimeout(restore);
  },[]);
  useEffect(() => { if(hydrated) localStorage.setItem("passagem-de-pista-flights",JSON.stringify(flights)); },[flights,hydrated]);
  useEffect(() => { if(hydrated) localStorage.setItem("passagem-de-pista-cards",JSON.stringify(passages)); },[passages,hydrated]);
  useEffect(() => { if(hydrated) { localStorage.setItem("passagem-de-pista-catalogs",JSON.stringify(catalogs)); localStorage.setItem("passagem-de-pista-catalogs-version","3"); } },[catalogs,hydrated]);
  useEffect(() => { localSnapshot.current={flights,catalogs,passages}; },[flights,catalogs,passages]);
  useEffect(() => { let knownDay=todayLocal(); const timer=window.setInterval(() => { const currentDay=todayLocal(); if(currentDay!==knownDay) { knownDay=currentDay; setFilters((current)=>({ ...current,date:currentDay })); } },60000); return () => window.clearInterval(timer); },[]);
  useEffect(() => { if("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").then((registration)=>registration.update()).catch(()=>undefined); },[]);

  useEffect(() => {
    if(!hydrated||!user||!supabase) return;
    let active=true;
    let channel: ReturnType<typeof supabase.channel>|undefined;
    async function connect() {
      const { data:sessionData }=await supabase!.auth.getSession();
      if(!sessionData.session) { const { error }=await supabase!.auth.signInAnonymously(); if(error) { if(active) setSyncError(error.message); return; } }
      const { error:claimError }=await supabase!.rpc("claim_device_identity",{ p_employee_number:user,p_password:"1234" });
      if(claimError) { if(active) setSyncError(claimError.message); return; }
      const { data,error }=await supabase!.from("shared_app_state").select("flights,catalogs,passages,revision").eq("id","main").maybeSingle();
      if(error) { if(active) setSyncError(error.message); return; }
      if(data) { const serialized=JSON.stringify({flights:data.flights,catalogs:data.catalogs,passages:data.passages??[]}); lastRemoteState.current=serialized; lastRemoteCatalogs.current=JSON.stringify(data.catalogs); if(active) { setFlights(data.flights as Flight[]); setCatalogs(data.catalogs as Catalogs); setPassages((data.passages??[]) as Passage[]); } }
      else if(user==="0001") { const initial=localSnapshot.current; const serialized=JSON.stringify(initial); const { error:initError }=await supabase!.rpc("save_shared_state",{p_flights:initial.flights,p_catalogs:initial.catalogs,p_passages:initial.passages}); if(initError) { if(active) setSyncError(initError.message); return; } lastRemoteState.current=serialized; }
      else { if(active) setSyncError("Aguardando o administrador iniciar a sincronização."); return; }
      if(active) { setSyncError(""); setSyncReady(true); }
      channel=supabase!.channel("flight-ia-shared-state").on("postgres_changes",{event:"UPDATE",schema:"public",table:"shared_app_state",filter:"id=eq.main"},(payload)=>{ const row=payload.new as {flights:Flight[];catalogs:Catalogs;passages?:Passage[]}; const serialized=JSON.stringify({flights:row.flights,catalogs:row.catalogs,passages:row.passages??[]}); if(serialized===lastRemoteState.current) return; lastRemoteState.current=serialized; lastRemoteCatalogs.current=JSON.stringify(row.catalogs); setFlights(row.flights); setCatalogs(row.catalogs); setPassages(row.passages??[]); }).subscribe((status)=>{ if(status==="SUBSCRIBED") setSyncError(""); else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT") setSyncError("Reconectando a sincronização em tempo real…"); });
    }
    void connect();
    return () => { active=false; setSyncReady(false); if(channel) void supabase.removeChannel(channel); };
  },[hydrated,user]);

  useEffect(() => {
    if(!syncReady||!supabase||user!=="0001") return;
    const serialized=JSON.stringify(catalogs);
    if(serialized===lastRemoteCatalogs.current) return;
    const timer=window.setTimeout(async()=>{ const {error}=await supabase!.rpc("save_shared_catalogs",{p_catalogs:catalogs}); if(error) setSyncError(error.message); else { lastRemoteCatalogs.current=serialized; setSyncError(""); } },250);
    return ()=>window.clearTimeout(timer);
  },[catalogs,syncReady,user]);

  useEffect(() => { if(!syncReady||!supabase) return; void supabase.rpc("get_my_flight_alerts").then(({data,error})=>{ if(error) { setSyncError(error.message); return; } setAlerts(Object.fromEntries(((data??[]) as {flight_id:string;minutes_before:number}[]).map((alert)=>[alert.flight_id,alert.minutes_before]))); }); },[syncReady,user]);

  useEffect(() => {
    if(!syncReady||!supabase||!user) return;
    let active=true;
    async function refreshSharedState() {
      if(pendingMutations.current>0) return;
      const { data,error }=await supabase!.from("shared_app_state").select("flights,catalogs,passages").eq("id","main").maybeSingle();
      if(!active) return;
      if(error) { setSyncError(error.message); return; }
      if(!data) return;
      const serialized=JSON.stringify({flights:data.flights,catalogs:data.catalogs,passages:data.passages??[]});
      if(serialized===lastRemoteState.current) return;
      lastRemoteState.current=serialized;
      lastRemoteCatalogs.current=JSON.stringify(data.catalogs);
      setFlights(data.flights as Flight[]);
      setCatalogs(data.catalogs as Catalogs);
      setPassages((data.passages??[]) as Passage[]);
      setSyncError("");
    }
    const timer=window.setInterval(()=>void refreshSharedState(),4000);
    const refreshOnFocus=()=>void refreshSharedState();
    window.addEventListener("focus",refreshOnFocus);
    document.addEventListener("visibilitychange",refreshOnFocus);
    return () => { active=false; window.clearInterval(timer); window.removeEventListener("focus",refreshOnFocus); document.removeEventListener("visibilitychange",refreshOnFocus); };
  },[syncReady,user]);

  const options=useMemo(() => ({ bases: catalogs.bases,models: catalogs.models,prefixes: catalogs.aircraft.map((item) => item.prefix) }),[catalogs]);
  const filteredFlights=useMemo(() => flights.filter((item) =>
    !item.deletedAt&&(!filters.date||item.date===filters.date)&&(!filters.base||item.base===filters.base)&&
    (!filters.model||item.model===filters.model)&&(!filters.prefix||item.prefix===filters.prefix)
  ),[flights,filters]);
  const timelineCounts=useMemo(() => ({all:filteredFlights.length,operational:filteredFlights.filter((flight)=>timelineCategory(flight)==="operational").length,finished:filteredFlights.filter((flight)=>timelineCategory(flight)==="finished").length,cancelled:filteredFlights.filter((flight)=>timelineCategory(flight)==="cancelled").length}),[filteredFlights]);
  const visible=useMemo(() => filteredFlights.filter((flight)=>timelineView==="all"||timelineCategory(flight)===timelineView).sort((a,b) => { const ranks={operational:0,finished:1,cancelled:2}; const categoryDifference=ranks[timelineCategory(a)]-ranks[timelineCategory(b)]; return categoryDifference||timelineTime(b)-timelineTime(a); }),[filteredFlights,timelineView]);

  async function reloadSharedState() {
    if(!supabase) return;
    const {data,error}=await supabase.from("shared_app_state").select("flights,catalogs,passages").eq("id","main").single();
    if(error) { setSyncError(error.message); return; }
    const serialized=JSON.stringify({flights:data.flights,catalogs:data.catalogs,passages:data.passages??[]});
    lastRemoteState.current=serialized; lastRemoteCatalogs.current=JSON.stringify(data.catalogs);
    setFlights(data.flights as Flight[]); setCatalogs(data.catalogs as Catalogs); setPassages((data.passages??[]) as Passage[]);
  }
  async function persistItem(collection:"flights"|"passages",id:string,patch:object,operation:"create"|"update"|"delete"="update",changedFields:string[]=[],historyEvent:FlightHistory|null=null,incrementRevision=true) {
    if(!supabase||!syncReady) return;
    pendingMutations.current++;
    const {data,error}=await supabase.rpc("mutate_shared_item",{p_collection:collection,p_item_id:id,p_patch:patch,p_operation:operation,p_changed_fields:changedFields,p_history_event:historyEvent,p_increment_revision:incrementRevision});
    pendingMutations.current=Math.max(0,pendingMutations.current-1);
    if(error) { setSyncError(`Alteração não sincronizada: ${error.message}`); await reloadSharedState(); return; }
    const result=data as {item:Flight|Passage|null};
    if(operation==="delete") {
      if(collection==="flights") setFlights((items)=>items.filter((item)=>item.id!==id)); else setPassages((items)=>items.filter((item)=>item.id!==id));
    } else if(collection==="flights"&&result.item) {
      const serverItem=result.item as Flight;
      setFlights((items)=>{ const existing=items.find((item)=>item.id===id); if(existing&&existing.revision>serverItem.revision)return items; return existing?items.map((item)=>item.id===id?serverItem:item):[serverItem,...items]; });
    } else if(collection==="passages"&&result.item) {
      const serverItem=result.item as Passage;
      setPassages((items)=>{ const existing=items.find((item)=>item.id===id); if(existing&&(existing.revision??0)>(serverItem.revision??0))return items; return existing?items.map((item)=>item.id===id?serverItem:item):[serverItem,...items]; });
    }
    setSyncError("");
  }
  function changeFlight(id:string,changedFields:string[],historyEvent:FlightHistory|null,change:(flight:Flight)=>Flight) {
    const current=localSnapshot.current.flights.find((flight)=>flight.id===id);
    if(!current) return;
    const revision=current.revision+1;
    const nextBase=change(current);
    const event=historyEvent?{...historyEvent,revision}:null;
    const next={...nextBase,revision,fieldRevisions:{...current.fieldRevisions,...Object.fromEntries(changedFields.map((field)=>[field,revision]))},acknowledged:{...current.acknowledged,[user]:revision},history:event?[...(current.history??[]),event]:current.history,updatedBy:user};
    localSnapshot.current={...localSnapshot.current,flights:localSnapshot.current.flights.map((flight)=>flight.id===id?next:flight)};
    setFlights((items)=>items.map((flight)=>flight.id===id?next:flight));
    const patch=changedPatch(current,next) as Record<string,unknown>;
    delete patch.revision; delete patch.fieldRevisions; delete patch.acknowledged; delete patch.history;
    void persistItem("flights",id,patch,"update",changedFields,historyEvent);
  }
  function createFlight(flight:Flight) { localSnapshot.current={...localSnapshot.current,flights:[flight,...localSnapshot.current.flights]}; setFlights((items)=>[flight,...items]); void persistItem("flights",flight.id,flight,"create",["created"]); }
  function changePassage(id:string,change:(item:Passage)=>Passage) { const current=localSnapshot.current.passages.find((item)=>item.id===id); if(!current)return; const next=change(current); localSnapshot.current={...localSnapshot.current,passages:localSnapshot.current.passages.map((item)=>item.id===id?next:item)}; setPassages((items)=>items.map((item)=>item.id===id?next:item)); const patch=changedPatch(current,next); const scheduled=passageSaveTimers.current.get(id); if(scheduled)window.clearTimeout(scheduled.timer); const combined={...(scheduled?.patch??{}),...patch}; const timer=window.setTimeout(()=>{passageSaveTimers.current.delete(id);void persistItem("passages",id,combined);},300); passageSaveTimers.current.set(id,{timer,patch:combined}); }
  function createPassage(item:Passage) { setPassages((items)=>[item,...items]); void persistItem("passages",item.id,item,"create"); }

  async function enter(event: React.FormEvent) {
    event.preventDefault();
    if(password!=="1234") { setLoginError("Matrícula não cadastrada ou senha inválida."); return; }
    if(supabase) { const { data }=await supabase.auth.getSession(); if(!data.session) { const { error }=await supabase.auth.signInAnonymously(); if(error) { setLoginError("Não foi possível conectar ao serviço compartilhado."); return; } } const { error }=await supabase.rpc("claim_device_identity",{p_employee_number:login,p_password:password}); if(error) { setLoginError("Matrícula não autorizada no servidor."); return; } }
    else if(login!=="0001"&&!catalogs.users.some((item)=>item.employeeNumber===login)) { setLoginError("Matrícula não cadastrada ou senha inválida."); return; }
    localStorage.setItem("passagem-de-pista-user",login); setUser(login);
  }
  function updateCheck(id: string,key: CheckKey,value: CheckValue) {
    const now=new Date(); const at=now.toISOString(); const realTime=now.toLocaleTimeString("pt-BR",{ hour:"2-digit",minute:"2-digit",hour12:false });
    const fields=[key,...(key==="engineStart"?["actualEngineStart"]:[]),...(key==="shutdown"?["actualShutdown"]:[])];
    changeFlight(id,fields,{field:key,value,employeeNumber:user,at},(flight)=>({ ...flight,[key]:value,...(key==="engineStart"?{actualEngineStart:value==="ok"?flight.actualEngineStart??realTime:undefined}:{}),...(key==="shutdown"?{actualShutdown:value==="ok"?flight.actualShutdown??realTime:undefined,completedAt:value==="ok"?at:undefined}:{}),actionBy:{...flight.actionBy,[key]:user} }));
    if(key==="shutdown"&&value==="ok"&&alerts[id]) void setFlightAlert(id,null);
  }
  function updateFuel(id: string, fuelAmount: number, fuelUnit: FuelUnit) {
    const current=localSnapshot.current.flights.find((flight)=>flight.id===id); if(!current||current.fuelAmount===fuelAmount&&current.fuelUnit===fuelUnit)return;
    changeFlight(id,["fuelAmount"],{field:"fuelAmount",value:`${fuelAmount} ${fuelUnit}`,employeeNumber:user,at:new Date().toISOString()},(flight)=>({...flight,fuelAmount,fuelUnit,actionBy:{...flight.actionBy,fuelAmount:user}}));
  }
  function updateFlightField(id: string,field: "departure"|"duration"|"actualEngineStart"|"actualShutdown",value: string) {
    const parsed=field==="duration"?clockToDuration(value):value; changeFlight(id,[field],{field,value,employeeNumber:user,at:new Date().toISOString()},(flight)=>({...flight,[field]:parsed,...(field==="actualShutdown"?{completedAt:value?new Date().toISOString():undefined}:{}),actionBy:{...flight.actionBy,[field]:user}}));
    if(field==="actualShutdown"&&value&&alerts[id]) void setFlightAlert(id,null);
  }
  function cancelFlight(id: string,reason: string) { const at=new Date().toISOString(); changeFlight(id,["cancelled"],{field:"cancelled",value:reason,employeeNumber:user,at},(flight)=>({...flight,cancelled:true,cancellationReason:reason,cancelledAt:at,actionBy:{...flight.actionBy,cancelled:user}})); if(alerts[id])void setFlightAlert(id,null); }
  function moveFlightToTrash(id: string) { if(user!=="0001") return; changeFlight(id,["deletedAt"],null,(flight)=>({...flight,deletedAt:new Date().toISOString(),deletedBy:user})); if(alerts[id])void setFlightAlert(id,null); }
  function restoreFlight(id: string) { if(user!=="0001") return; const current=localSnapshot.current.flights.find((flight)=>flight.id===id); if(!current)return; const next={...current,deletedAt:undefined,deletedBy:undefined}; setFlights((items)=>items.map((flight)=>flight.id===id?next:flight)); void persistItem("flights",id,{deletedAt:null,deletedBy:null}); }
  function permanentlyDeleteFlight(id: string) { if(user!=="0001") return; setFlights((items)=>items.filter((flight)=>flight.id!==id)); void persistItem("flights",id,{},"delete"); }
  function acknowledge(id: string) { const flight=localSnapshot.current.flights.find((item)=>item.id===id); if(!flight)return; const patch={acknowledged:{[user]:flight.revision}}; setFlights((items)=>items.map((item)=>item.id===id?{...item,acknowledged:{...item.acknowledged,[user]:item.revision}}:item)); void persistItem("flights",id,patch,"update",[],null,false); }
  async function ensurePushSubscription() {
    if(!supabase||!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window)) throw new Error("Este aparelho não oferece notificações Web Push.");
    const registration=await navigator.serviceWorker.register("/sw.js");
    const permission=Notification.permission==="granted"?"granted":await Notification.requestPermission();
    if(permission!=="granted") throw new Error("Permissão de notificações não concedida.");
    let subscription=await registration.pushManager.getSubscription();
    if(!subscription) subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(vapidPublicKey)});
    return subscription.toJSON();
  }
  async function setFlightAlert(id:string,minutes:number|null) {
    try {
      if(!supabase) throw new Error("Serviço de notificações indisponível.");
      let error;
      if(minutes!==null) {
        const subscription=await ensurePushSubscription();
        ({error}=await supabase.rpc("save_push_subscription_and_alert",{p_endpoint:subscription.endpoint??"",p_p256dh:subscription.keys?.p256dh??"",p_auth:subscription.keys?.auth??"",p_user_agent:navigator.userAgent,p_flight_id:id,p_minutes_before:minutes}));
      } else ({error}=await supabase.rpc("set_flight_alert",{p_flight_id:id,p_minutes_before:10,p_enabled:false}));
      if(error) throw error;
      setAlerts((current)=>{ const next={...current}; if(minutes===null) delete next[id]; else next[id]=minutes; return next; });
      setSyncError("");
    } catch(error) { setSyncError(error instanceof Error?error.message:"Não foi possível configurar a notificação."); }
  }

  if(!hydrated) return null;
  if(!user) return <LoginScreen login={login} password={password} error={loginError} setLogin={setLogin} setPassword={setPassword} onSubmit={enter} />;
  const isAdmin=user==="0001";
  return (
    <div className="min-h-screen bg-[#f4f7fb]">
      <header className="sticky top-0 z-30 border-b border-[#dbe5f1] bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-[72px] max-w-[1440px] flex-wrap items-center gap-3 px-4 py-2 sm:px-8 md:flex-nowrap md:gap-4 md:py-0">
          <button className="rounded-xl p-2 text-[#66768a] hover:bg-[#edf4fb] md:hidden" aria-label="Abrir menu"><Menu size={22} /></button>
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#1167d8] text-white shadow-[0_8px_20px_#1167d833]"><Plane size={21} /></div><div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#6480a0]">Operações aéreas</p><h1 className="text-lg font-bold tracking-[-.02em]">Flight IA</h1></div></div><select aria-label="Área de trabalho" value={workspace} onChange={(event)=>setWorkspace(event.target.value as "flights"|"passage")} className="order-last h-10 w-full rounded-xl border border-[#dce6f0] bg-white px-3 text-xs font-bold md:order-none md:w-auto"><option value="flights">Trilho das Aeronaves</option><option value="passage">Passagem de Pista</option></select>
          <div className="ml-auto flex items-center gap-2"><button aria-label="Assistente IA" onClick={() => setAiOpen(true)} className="flex items-center gap-2 rounded-xl bg-[#0d315e] px-3 py-2.5 text-xs font-bold text-white"><Bot size={17} /><span className="desktop-only">Assistente IA</span></button>{isAdmin? <button aria-label="Cadastros" onClick={() => setAdminOpen(true)} className="flex items-center gap-2 rounded-xl border border-[#bcd4f2] bg-[#edf5ff] px-3 py-2.5 text-xs font-bold text-[#1268d8] hover:bg-[#dcecff]"><Settings size={17} /><span className="desktop-only">Cadastros</span></button>:null}<button className="relative rounded-xl border border-[#dce6f0] p-2.5 text-[#52677f] hover:bg-[#f2f7fc]" aria-label="Notificações"><Bell size={19} /><span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#f0b429] ring-2 ring-white" /></button><div className="desktop-only ml-2 flex items-center gap-3 border-l border-[#e1e8f0] pl-4"><div className="grid h-9 w-9 place-items-center rounded-full bg-[#dcebff] text-[#1769e0]"><UserRound size={18} /></div><div><p className="text-xs text-[#718197]">{isAdmin? "Administrador":"Matrícula"}</p><p className="text-sm font-bold">{user}</p></div></div><button onClick={() => { localStorage.removeItem("passagem-de-pista-user"); setUser(""); }} className="rounded-xl p-2.5 text-[#718197] hover:bg-[#edf4fb]" aria-label="Sair"><LogOut size={19} /></button></div>
        </div>
      </header>
      <main className="mx-auto max-w-[1440px] px-4 py-7 sm:px-8">
        {syncError?<div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">Sincronização: {syncError}</div>:syncReady?<div className="mb-4 flex items-center gap-2 text-xs font-semibold text-green-700"><i className="h-2 w-2 rounded-full bg-green-500" /> Sincronizado em tempo real</div>:<div className="mb-4 flex items-center gap-2 text-xs font-semibold text-[#1769e0]"><i className="h-2 w-2 animate-pulse rounded-full bg-[#1769e0]" /> Conectando ao Supabase...</div>}
        {workspace==="flights"? <><section className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-1 text-sm font-medium text-[#1769e0]">Visão operacional</p><h2 className="text-2xl font-bold tracking-[-.035em] sm:text-[30px]">Linha do tempo de voos</h2><p className="mt-1 text-sm text-[#6a7d93]">Acompanhe cada aeronave do pré-voo ao corte.</p></div><div className="flex flex-wrap gap-2">{isAdmin?<button onClick={()=>setTrashOpen(true)} className="flex h-11 items-center gap-2 rounded-xl border border-[#d5e0eb] bg-white px-4 text-sm font-bold text-[#52677f]"><Trash2 size={17}/> Lixeira ({flights.filter((flight)=>flight.deletedAt).length})</button>:null}<button onClick={() => setNewOpen(true)} className="flex h-11 items-center gap-2 rounded-xl bg-[#1268d8] px-4 text-sm font-bold text-white shadow-[0_8px_20px_#1268d833] transition hover:-translate-y-0.5 hover:bg-[#095cbf]"><Plus size={18} /> Lançar voo</button></div></section>
        <section className="mb-7 rounded-2xl border border-[#dce6f0] bg-white p-4 shadow-[0_8px_30px_#173b6210]"><button onClick={() => setFiltersOpen((value) => !value)} className="flex w-full items-center justify-between font-bold md:hidden"><span className="flex items-center gap-2"><Search size={17} /> Filtros</span><ChevronDown size={18} className={filtersOpen? "rotate-180":""} /></button><div className={`${filtersOpen? "grid":"hidden"} mt-4 gap-3 md:mt-0 md:grid md:grid-cols-4`}><Filter label="Data" icon={<CalendarDays size={15} />}><input type="date" value={filters.date} onChange={(e) => setFilters({ ...filters,date: e.target.value })} /></Filter><Filter label="Base de operação"><select value={filters.base} onChange={(e) => setFilters({ ...filters,base: e.target.value })}><option value="">Todas as bases</option>{options.bases.map((value) => <option key={value}>{value}</option>)}</select></Filter><Filter label="Modelo"><select value={filters.model} onChange={(e) => setFilters({ ...filters,model: e.target.value })}><option value="">Todos os modelos</option>{options.models.map((value) => <option key={value}>{value}</option>)}</select></Filter><Filter label="Prefixo"><select value={filters.prefix} onChange={(e) => setFilters({ ...filters,prefix: e.target.value })}><option value="">Todos os prefixos</option>{options.prefixes.map((value) => <option key={value}>{value}</option>)}</select></Filter></div></section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Filtrar situação dos voos">{([{key:"all",label:"Todos"},{key:"operational",label:"Operacionais"},{key:"finished",label:"Finalizados"},{key:"cancelled",label:"Cancelados"}] as {key:TimelineView;label:string}[]).map((option)=><button key={option.key} onClick={()=>setTimelineView(option.key)} aria-pressed={timelineView===option.key} className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${timelineView===option.key?"border-[#9fc3ee] bg-[#eaf3ff] text-[#1268d8]":"border-[#dce6f0] bg-white text-[#66798e] hover:bg-[#f5f8fb]"}`}>{option.label} <span className="ml-1 opacity-65">{timelineCounts[option.key]}</span></button>)}</div><p className="text-sm font-semibold text-[#52677f]">{visible.length} {visible.length===1? "voo encontrado":"voos encontrados"}</p></div><StatusLegend /></div>
        <section className="relative grid gap-5 pb-12 lg:grid-cols-2">{visible.map((flight,index) => <FlightCard key={flight.id} flight={flight} user={user} index={index} isAdmin={isAdmin} alertMinutes={alerts[flight.id]} onAlert={(minutes)=>void setFlightAlert(flight.id,minutes)} onCheck={updateCheck} onFuel={updateFuel} onField={updateFlightField} onCancel={cancelFlight} onDelete={(id)=>{if(window.confirm("Mover este voo para a lixeira?"))moveFlightToTrash(id);}} onAcknowledge={acknowledge} />)}{visible.length===0? <div className="col-span-full rounded-2xl border border-dashed border-[#becddd] bg-white px-6 py-16 text-center"><Plane className="mx-auto mb-3 text-[#9bb0c7]" /><h3 className="font-bold">Nenhum voo encontrado</h3><p className="mt-1 text-sm text-[#718197]">Ajuste os filtros ou lance um novo voo.</p></div>:null}</section></>:<RunwayHandover passages={passages} catalogs={catalogs} user={user} isAdmin={isAdmin} onCreate={createPassage} onChange={changePassage} onDelete={(id)=>{if(isAdmin&&window.confirm("Excluir definitivamente esta passagem?")){setPassages((items)=>items.filter((item)=>item.id!==id));void persistItem("passages",id,{},"delete");}}}/>} {/* workspaces */}
      </main>
      {newOpen? <NewFlightModal user={user} catalogs={catalogs} onClose={() => setNewOpen(false)} onCreate={(flight) => { createFlight(flight); setNewOpen(false); setFilters((current) => ({ ...current,date: flight.date })); }} />:null}
      {adminOpen? <AdminModal catalogs={catalogs} user={user} onChange={setCatalogs} onClose={() => setAdminOpen(false)} />:null}
      {aiOpen? <AiAssistant flights={flights} catalogs={catalogs} user={user} onClose={() => setAiOpen(false)} onCreate={(created) => created.forEach(createFlight)} />:null}
      {trashOpen?<FlightTrash flights={flights.filter((flight)=>flight.deletedAt)} onClose={()=>setTrashOpen(false)} onRestore={restoreFlight} onDelete={permanentlyDeleteFlight}/>:null}
    </div>
  );
}

function LoginScreen({ login,password,error,setLogin,setPassword,onSubmit }: { login: string; password: string; error: string; setLogin: (value: string) => void; setPassword: (value: string) => void; onSubmit: (event: React.FormEvent) => void; }) {
  return <main className="grid min-h-screen place-items-center bg-[#edf4fb] p-5"><div className="grid w-full max-w-[980px] overflow-hidden rounded-[28px] bg-white shadow-[0_30px_90px_#0b234224] md:grid-cols-[1.05fr_.95fr]"><section className="hidden min-h-[610px] flex-col justify-between bg-[#0d315e] p-12 text-white md:flex"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-white/12"><Plane /></div><span className="font-bold">Flight IA</span></div><div><p className="mb-4 text-xs font-bold uppercase tracking-[.22em] text-[#7db4f7]">Consciência situacional</p><h1 className="max-w-md text-4xl font-bold leading-tight tracking-[-.04em]">Cada voo, cada ação, todos na mesma página.</h1><p className="mt-5 max-w-md leading-relaxed text-[#bdd3ec]">Acompanhe o trilho operacional das aeronaves em tempo real, do abastecimento ao corte.</p></div><div className="flex gap-6 text-xs text-[#9ebcdd]"><span className="flex items-center gap-2"><ShieldCheck size={16} /> Registro por matrícula</span><span className="flex items-center gap-2"><Gauge size={16} /> Status ao vivo</span></div></section><section className="flex flex-col justify-center p-8 sm:p-12"><div className="mb-8 md:hidden"><div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-[#1268d8] text-white"><Plane /></div></div><p className="text-sm font-bold text-[#1769e0]">Bem-vindo</p><h2 className="mt-1 text-3xl font-bold tracking-[-.04em]">Acesse a operação</h2><p className="mt-2 text-sm text-[#718197]">Entre com sua matrícula funcional.</p><form onSubmit={onSubmit} className="mt-8 space-y-4"><label className="block"><span className="mb-2 block text-sm font-semibold">Matrícula</span><div className="flex items-center rounded-xl border border-[#cedae8] px-3 focus-within:border-[#1769e0] focus-within:ring-4 focus-within:ring-[#1769e014]"><UserRound size={17} className="text-[#8192a5]" /><input autoFocus inputMode="numeric" value={login} onChange={(e) => setLogin(e.target.value)} className="h-12 w-full bg-transparent px-3 outline-none" placeholder="Ex.: 1024" /></div></label><label className="block"><span className="mb-2 block text-sm font-semibold">Senha</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 w-full rounded-xl border border-[#cedae8] px-4 outline-none focus:border-[#1769e0] focus:ring-4 focus:ring-[#1769e014]" /></label>{error? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>:null}<button className="h-12 w-full rounded-xl bg-[#1268d8] font-bold text-white hover:bg-[#095cbf]">Entrar</button></form></section></div></main>;
}

function Filter({ label,icon,children }: { label: string; icon?: React.ReactNode; children: React.ReactNode; }) { return <label><span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-[#64788e]">{icon}{label}</span><div className="[&>input]:h-10 [&>input]:w-full [&>input]:rounded-lg [&>input]:border [&>input]:border-[#d6e1ec] [&>input]:bg-white [&>input]:px-3 [&>input]:text-sm [&>input]:outline-none [&>select]:h-10 [&>select]:w-full [&>select]:rounded-lg [&>select]:border [&>select]:border-[#d6e1ec] [&>select]:bg-white [&>select]:px-3 [&>select]:text-sm [&>select]:outline-none">{children}</div></label>; }
function StatusLegend() { return <div className="desktop-only flex items-center gap-4 text-[11px] font-semibold text-[#718197]">{[["#f2b824","Atenção"],["#2383e2","Ciente"],["#22a06b","Em voo"],["#94a3b8","Encerrado"]].map(([color,label]) => <span key={label} className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{label}</span>)}</div>; }

function FlightCard({ flight,user,index,isAdmin,alertMinutes,onAlert,onCheck,onFuel,onField,onCancel,onDelete,onAcknowledge }: { flight: Flight; user: string; index: number; isAdmin:boolean; alertMinutes?:number; onAlert:(minutes:number|null)=>void; onCheck: (id: string,key: CheckKey,value: CheckValue) => void; onFuel: (id: string,value: number,unit: FuelUnit) => void; onField: (id:string,field:"departure"|"duration"|"actualEngineStart"|"actualShutdown",value:string)=>void; onCancel:(id:string,reason:string)=>void; onDelete:(id:string)=>void; onAcknowledge: (id: string) => void; }) {
  const status=flightStatus(flight,user); const locked=Boolean(flight.cancelled);
  return <article className="animate-rise overflow-hidden rounded-2xl border bg-white shadow-[0_10px_35px_#173b6210]" style={{ borderColor: status.color,borderLeftWidth: 5,animationDelay: `${index*60}ms` }}><div className="flex items-start justify-between gap-3 border-b border-[#e6edf4] p-5"><div className="flex gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-[#edf5ff] text-[#1769e0]"><Plane size={21} /></div><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-mono text-xl font-bold tracking-[-.02em]">{flight.prefix}</h3><span className="rounded-md bg-[#edf2f7] px-2 py-1 text-[10px] font-bold text-[#607388]">{flight.model}</span></div><p className="mt-1 text-xs text-[#718197]">{flight.base}</p></div></div><span className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ color: status.color,backgroundColor: `${status.color}18` }}><i className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: status.color }} />{status.label}</span></div><div className="grid grid-cols-2 gap-3 border-b border-[#e6edf4] bg-[#fafcff] px-5 py-3 text-xs sm:grid-cols-5"><div><span className="block text-[#7d8da0]">Saída prevista</span><strong className="mt-1 flex items-center gap-1.5"><CalendarDays size={13} />{flight.date.split("-").reverse().join("/")} · {flight.departure}</strong></div><div><span className="block text-[#7d8da0]">Tempo previsto</span><strong className="mt-1 flex items-center gap-1.5"><Clock3 size={13} />{durationToClock(flight.duration)}</strong></div><div><span className="block text-[#7d8da0]">Acionamento real</span><strong className="mt-1 flex items-center gap-1.5"><Clock3 size={13} />{flight.actualEngineStart??"—"}</strong></div><div><span className="block text-[#7d8da0]">Pouso previsto</span><strong className="mt-1 flex items-center gap-1.5"><Plane size={13} className="rotate-90" />{arrivalTime(flight)}</strong><small className="mt-0.5 block text-[9px] text-[#8a9aad]">{flight.actualEngineStart? "Baseado no acionamento real":"Baseado na saída prevista"}</small></div><div><span className="block text-[#7d8da0]">Corte real</span><strong className="mt-1 flex items-center gap-1.5"><Clock3 size={13} />{flight.actualShutdown??"—"}</strong></div></div><div className="p-5"><FlightEditableTimes flight={flight} user={user} disabled={locked} onSave={(field,value) => onField(flight.id,field,value)} onCancel={(reason) => onCancel(flight.id,reason)} /><div className={`mb-3 flex items-center justify-between rounded-lg p-2 ${fieldChanged(flight,user,"fuelAmount")?"bg-amber-100 ring-2 ring-amber-400":""}`}><p className="text-xs font-bold uppercase tracking-[.12em] text-[#73869a]">Checklist operacional{fieldChanged(flight,user,"fuelAmount")?<small className="ml-2 text-amber-700">Alterado</small>:null}</p><FuelAmountEditor key={flight.revision} value={flight.fuelAmount} unit={flight.fuelUnit} signature={flight.actionBy?.fuelAmount} disabled={locked} onSave={(value,unit) => onFuel(flight.id,value,unit)} /></div><div className="grid gap-2 sm:grid-cols-2">{(Object.keys(checkLabels) as CheckKey[]).map((key) => <CheckRow key={key} label={checkLabels[key]} value={flight[key]} changed={fieldChanged(flight,user,key)} disabled={locked} onChange={(value) => onCheck(flight.id,key,value)} signature={flight.actionBy?.[key]} full={key==="shutdown"} />)}</div><FlightAlertControl minutes={alertMinutes} disabled={locked||flight.shutdown==="ok"} onChange={onAlert}/></div><footer className="flex items-center justify-between gap-3 border-t border-[#e6edf4] bg-[#fbfcfe] px-5 py-3"><ActionSignatures flight={flight} /><div className="flex shrink-0 flex-col items-end gap-2">{status.key==="attention"? <button onClick={() => onAcknowledge(flight.id)} className="flex items-center gap-1.5 rounded-lg bg-[#fff7dd] px-3 py-2 text-xs font-bold text-[#926b00] hover:bg-[#ffefb8]"><Check size={14} /> Marcar ciência</button>:<span className="flex items-center gap-1 text-xs font-semibold text-[#63778e]"><Check size={14} /> Atualizado</span>}{isAdmin?<button onClick={() => { if(window.confirm(`Excluir definitivamente o voo ${flight.prefix}?`)) onDelete(flight.id); }} className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-[10px] font-bold text-red-700"><Trash2 size={13}/> Excluir voo</button>:null}</div></footer></article>;
}

function ActionSignatures({ flight }: { flight:Flight }) {
  const signatures=[
    ["Abastecimento",flight.actionBy?.fuelAmount??flight.actionBy?.fuel],
    ["Pré-voo",flight.actionBy?.preflight],
    ["HUMS",flight.actionBy?.hums],
    ["Acionamento",flight.actionBy?.actualEngineStart??flight.actionBy?.engineStart],
    ["Corte",flight.actionBy?.actualShutdown??flight.actionBy?.shutdown],
    ["Saída",flight.actionBy?.departure],
    ["Tempo",flight.actionBy?.duration],
  ];
  return <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">{signatures.map(([label,employee])=><span key={label} className={`rounded-md px-2 py-1 text-[9px] ${employee?"bg-[#eaf3ff] font-bold text-[#315b86]":"bg-[#f1f4f7] text-[#8a98a8]"}`}>{label}: {employee?`mat. ${employee}`:"—"}</span>)}</div>;
}

function CheckRow({ label,value,changed,disabled,onChange,signature,full }: { label: string; value: CheckValue; changed:boolean; disabled: boolean; onChange: (value: CheckValue) => void; signature?: string; full?: boolean; }) { return <div className={`flex items-center justify-between rounded-xl border p-2.5 ${full? "sm:col-span-2":""} ${changed?"border-amber-400 bg-amber-50 ring-2 ring-amber-300":"border-[#e1e9f1]"}`}><span className="text-xs font-semibold">{label}{changed?<small className="ml-1 rounded bg-amber-200 px-1 text-[9px] font-bold text-amber-800">Alterado</small>:null}{signature? <small className="mt-0.5 block font-normal text-[#718197]">Matrícula {signature}</small>:null}</span><div className="flex gap-1"><button disabled={disabled} onClick={() => onChange("ok")} className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold transition ${value==="ok"? "bg-[#daf5e8] text-[#13764a] ring-1 ring-[#96d8b9]":"bg-[#f1f4f7] text-[#728397] hover:bg-[#e5ebf1]"}`}>OK</button><button disabled={disabled} onClick={() => onChange("no")} className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold transition ${value==="no"? "bg-[#fee8e8] text-[#b42318] ring-1 ring-[#efb1ad]":"bg-[#f1f4f7] text-[#728397] hover:bg-[#e5ebf1]"}`}>NO</button></div></div>; }

function FlightEditableTimes({ flight,user,disabled,onSave,onCancel }: { flight: Flight; user:string; disabled:boolean; onSave:(field:"departure"|"duration"|"actualEngineStart"|"actualShutdown",value:string)=>void; onCancel:(reason:string)=>void }) {
  const [reason,setReason]=useState("");
  return <div className="mb-4 grid gap-2 rounded-xl bg-[#f5f8fc] p-3 sm:grid-cols-2"><TimeEdit key={`departure-${flight.departure}`} label="Saída prevista" type="time" value={flight.departure} changed={fieldChanged(flight,user,"departure")} signature={flight.actionBy?.departure} disabled={disabled} onSave={(value)=>onSave("departure",value)} /><TimeEdit key={`duration-${flight.duration}`} label="Tempo previsto (HH:MM)" type="time" value={durationToClock(flight.duration)} changed={fieldChanged(flight,user,"duration")} signature={flight.actionBy?.duration} disabled={disabled} onSave={(value)=>onSave("duration",value)} /><TimeEdit key={`start-${flight.actualEngineStart}`} label="Acionamento real" type="time" value={flight.actualEngineStart??""} changed={fieldChanged(flight,user,"engineStart")||fieldChanged(flight,user,"actualEngineStart")} signature={flight.actionBy?.actualEngineStart??flight.actionBy?.engineStart} disabled={disabled} onSave={(value)=>onSave("actualEngineStart",value)} /><TimeEdit key={`shutdown-${flight.actualShutdown}`} label="Corte real" type="time" value={flight.actualShutdown??""} changed={fieldChanged(flight,user,"shutdown")||fieldChanged(flight,user,"actualShutdown")} signature={flight.actionBy?.actualShutdown??flight.actionBy?.shutdown} disabled={disabled} onSave={(value)=>onSave("actualShutdown",value)} />{flight.cancelled? <p className={`text-xs font-bold text-red-700 sm:col-span-2 ${fieldChanged(flight,user,"cancelled")?"rounded-lg bg-amber-100 p-2 ring-2 ring-amber-400":""}`}>Motivo: {flight.cancellationReason} · matrícula {flight.actionBy?.cancelled}</p>:<div className="flex gap-2 sm:col-span-2"><select aria-label="Motivo do cancelamento" value={reason} onChange={(event)=>setReason(event.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-[#d5dfeb] bg-white px-2 text-xs"><option value="">Selecione o motivo</option><option value="Indisponível">Indisponível</option><option value="Mau tempo">Mau tempo</option><option value="Retorno por pane">Retorno por pane</option><option value="Retorno por mau tempo">Retorno por mau tempo</option><option value="Outros">Outros</option></select><button disabled={!reason} onClick={()=>onCancel(reason)} className="rounded-lg bg-red-50 px-3 text-xs font-bold text-red-700">Cancelar voo</button></div>}</div>;
}

function TimeEdit({ label,type,value,changed,signature,disabled,onSave }: { label:string; type:"time"|"number"; value:string; changed:boolean; signature?:string; disabled:boolean; onSave:(value:string)=>void }) { const [draft,setDraft]=useState(value); return <label className={`rounded-lg p-1 text-[10px] font-bold text-[#64788e] ${changed?"bg-amber-100 ring-2 ring-amber-400":""}`}>{label}{changed?<small className="ml-1 rounded bg-amber-200 px-1 text-[9px] text-amber-800">Alterado</small>:null}<input type={type} min={type==="number"?"0.1":undefined} step={type==="number"?"0.1":undefined} disabled={disabled} value={draft} onChange={(event)=>setDraft(event.target.value)} onBlur={()=>{if(draft&&draft!==value) onSave(draft)}} className="mt-1 h-9 w-full rounded-lg border border-[#d5dfeb] bg-white px-2 text-xs" />{signature?<small className="font-normal">Matrícula {signature}</small>:null}</label>; }

function FlightAlertControl({minutes,disabled,onChange}:{minutes?:number;disabled:boolean;onChange:(minutes:number|null)=>void}) { const [draft,setDraft]=useState(minutes??10); return <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-[#dbe6f0] bg-[#f8fbff] p-2.5"><Bell size={16} className={minutes?"text-[#1268d8]":"text-[#718197]"}/><span className="mr-auto text-xs font-bold">Aviso antes do pouso</span>{minutes?<><label className="flex items-center gap-1 text-[11px]">Antecedência <input aria-label="Minutos antes do pouso" type="number" min="1" max="1440" value={draft} onChange={(event)=>setDraft(Number(event.target.value))} onBlur={()=>{if(draft>=1&&draft<=1440&&draft!==minutes)onChange(draft)}} className="h-8 w-16 rounded-lg border border-[#cbd9e7] px-2 text-right font-bold"/> min</label><button onClick={()=>onChange(null)} className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[10px] font-bold text-red-700">Desativar</button></>:<button disabled={disabled} onClick={()=>onChange(10)} className="rounded-lg bg-[#e8f2ff] px-3 py-2 text-[10px] font-bold text-[#0e5fbd] disabled:opacity-50">Ativar · 10 min</button>}</div>; }

function FuelAmountEditor({ value,unit,signature,disabled,onSave }: { value: number; unit: FuelUnit; signature?: string; disabled: boolean; onSave: (value: number,unit: FuelUnit) => void }) {
  const [draft,setDraft]=useState(String(value));
  const [draftUnit,setDraftUnit]=useState<FuelUnit>(unit);
  function save(nextUnit=draftUnit) { const next=Number(draft); if(Number.isFinite(next)&&next>=0) onSave(next,nextUnit); else setDraft(String(value)); }
  return <div className="flex items-center gap-1 text-xs font-semibold text-[#566c84]"><Fuel size={14} /><input aria-label="Quantidade real abastecida" type="number" min="0" step="1" disabled={disabled} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => save()} onKeyDown={(event) => { if(event.key==="Enter") event.currentTarget.blur(); }} className="h-8 w-24 rounded-lg border border-[#cbd9e7] bg-white px-2 text-right font-bold outline-none focus:border-[#1769e0] disabled:bg-[#eef2f6]" /><select aria-label="Unidade do abastecimento" disabled={disabled} value={draftUnit} onChange={(event) => { const nextUnit=event.target.value as FuelUnit; setDraftUnit(nextUnit); save(nextUnit); }} className="h-8 rounded-lg border border-[#cbd9e7] bg-white px-1.5 font-bold outline-none focus:border-[#1769e0] disabled:bg-[#eef2f6]"><option value="L">L</option><option value="lb">lb</option><option value="kg">kg</option></select>{signature?<small className="ml-1 text-[9px] font-normal">Mat. {signature}</small>:null}</div>;
}

function NewFlightModal({ user,catalogs,onClose,onCreate }: { user: string; catalogs: Catalogs; onClose: () => void; onCreate: (flight: Flight) => void; }) {
  const now=new Date(); const localDate=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const availableAircraft=catalogs.aircraft.filter((item) => item.available??true);
  const firstAircraft=availableAircraft[0]??{ prefix: "",model: "",base: "" };
  const [form,setForm]=useState({ prefix: firstAircraft.prefix,model: firstAircraft.model,base: firstAircraft.base,date: localDate,departure: now.toTimeString().slice(0,5),duration: "01:30",fuelAmount: "0",fuelUnit: "L" as FuelUnit });
  function submit(event: React.FormEvent) { event.preventDefault(); onCreate({ id: crypto.randomUUID(),...form,duration: clockToDuration(form.duration),fuelAmount: Number(form.fuelAmount),fuel: "pending",preflight: "pending",hums: "pending",engineStart: "pending",shutdown: "pending",revision: 1,acknowledged: { [user]: 1 },actionBy: { created: user },history: [{ field: "created",value: "Voo lançado",employeeNumber: user,at: new Date().toISOString() }],createdBy: user,updatedBy: user }); }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#071a30]/60 p-2 backdrop-blur-sm sm:p-4" onMouseDown={(e) => { if(e.target===e.currentTarget) onClose(); }}><div role="dialog" aria-modal="true" aria-labelledby="new-flight-title" className="animate-rise flex max-h-[calc(100dvh-1rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[90vh]"><header className="flex shrink-0 items-start justify-between border-b border-[#e0e8f0] p-4 sm:p-5"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#1769e0]">Novo registro</p><h2 id="new-flight-title" className="mt-1 text-xl font-bold">Lançar voo</h2></div><button onClick={onClose} className="rounded-lg p-2 text-[#6f8194] hover:bg-[#edf3f8]" aria-label="Fechar"><X size={20} /></button></header><form onSubmit={submit} className="flex min-h-0 flex-1 flex-col"><div className="grid gap-3 overflow-y-auto p-4 sm:grid-cols-2 sm:gap-4 sm:p-5"><div className="sm:col-span-2"><span className="mb-1.5 block text-xs font-bold text-[#5d7187]">Aeronave / prefixo</span><AircraftPicker aircraft={availableAircraft} value={form.prefix} onChange={(aircraft)=>setForm({...form,prefix:aircraft.prefix,model:aircraft.model,base:aircraft.base})}/></div><ModalField label="Modelo"><input value={form.model} disabled /></ModalField><ModalField label="Base atual da aeronave"><input value={form.base} disabled /></ModalField><ModalField label="Data"><input required type="date" value={form.date} onChange={(e) => setForm({ ...form,date: e.target.value })} /></ModalField><ModalField label="Hora do voo"><input required type="time" value={form.departure} onChange={(e) => setForm({ ...form,departure: e.target.value })} /></ModalField><ModalField label="Tempo previsto (HH:MM)"><input required type="time" min="00:01" step="60" value={form.duration} onChange={(e) => setForm({ ...form,duration: e.target.value })} /></ModalField><ModalField label="Abastecimento"><div className="grid grid-cols-[1fr_auto] gap-2"><input aria-label="Quantidade do abastecimento" required type="number" min="0" value={form.fuelAmount} onChange={(e) => setForm({ ...form,fuelAmount: e.target.value })} className="h-11 min-w-0 rounded-xl border border-[#cedbe7] px-3 outline-none" /><select aria-label="Unidade do abastecimento" value={form.fuelUnit} onChange={(e) => setForm({ ...form,fuelUnit: e.target.value as FuelUnit })} className="h-11 rounded-xl border border-[#cedbe7] bg-white px-2 outline-none"><option value="L">Litros (L)</option><option value="lb">Libras (lb)</option><option value="kg">Quilos (kg)</option></select></div></ModalField></div><footer className="flex shrink-0 justify-end gap-2 border-t border-[#e3eaf1] bg-white p-3 sm:p-4"><button type="button" onClick={onClose} className="rounded-xl border border-[#d5e0eb] px-4 py-2.5 text-sm font-bold text-[#5d7187]">Cancelar</button><button disabled={!form.prefix||!form.base} className="flex items-center gap-2 rounded-xl bg-[#1268d8] px-4 py-2.5 text-sm font-bold text-white"><Plus size={16} /> Lançar voo</button></footer></form></div></div>;
}

function FlightTrash({flights,onClose,onRestore,onDelete}:{flights:Flight[];onClose:()=>void;onRestore:(id:string)=>void;onDelete:(id:string)=>void}) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#071a30]/60 p-2 backdrop-blur-sm sm:p-4" onMouseDown={(event)=>{if(event.target===event.currentTarget)onClose();}}><div role="dialog" aria-modal="true" className="flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[90vh]"><header className="flex shrink-0 items-start justify-between border-b p-4 sm:p-5"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#1769e0]">Administrador</p><h2 className="mt-1 text-xl font-bold">Lixeira de voos</h2><p className="mt-1 text-xs text-[#718197]">Restaure um voo apagado por engano ou remova-o definitivamente.</p></div><button onClick={onClose} aria-label="Fechar"><X size={20}/></button></header><div className="flex-1 space-y-2 overflow-y-auto p-4 sm:p-5">{flights.map((flight)=><article key={flight.id} className="flex flex-col gap-3 rounded-xl border border-[#dce6f0] p-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-bold">{flight.prefix} · {flight.date} {flight.departure}</p><p className="text-xs text-[#718197]">{flight.model} · {flight.base} · enviado à lixeira por {flight.deletedBy??"administrador"}</p></div><div className="flex gap-2"><button onClick={()=>onRestore(flight.id)} className="flex items-center gap-1 rounded-lg bg-[#e8f2ff] px-3 py-2 text-xs font-bold text-[#0e5fbd]"><RotateCcw size={14}/> Restaurar</button><button onClick={()=>{if(window.confirm("Excluir este voo definitivamente? Esta ação não poderá ser desfeita."))onDelete(flight.id);}} className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700"><Trash2 size={14}/> Excluir definitivamente</button></div></article>)}{flights.length===0?<div className="py-14 text-center"><Trash2 className="mx-auto mb-3 text-[#9bb0c7]"/><p className="font-bold">A lixeira está vazia.</p></div>:null}</div></div></div>;
}

function AdminModal({ catalogs,user,onChange,onClose }: { catalogs: Catalogs; user:string; onChange: (catalogs: Catalogs) => void; onClose: () => void; }) {
  const [base,setBase]=useState(""); const [model,setModel]=useState(""); const [prefix,setPrefix]=useState(""); const [aircraftModel,setAircraftModel]=useState(catalogs.models[0]??""); const [aircraftBase,setAircraftBase]=useState(catalogs.bases[0]??""); const [employeeNumber,setEmployeeNumber]=useState(""); const [employeeName,setEmployeeName]=useState("");
  const addUnique=(items: string[],value: string) => [...new Set([...items,value.trim()])].filter(Boolean).sort();
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#071a30]/60 p-4 backdrop-blur-sm" onMouseDown={(e) => { if(e.target===e.currentTarget) onClose(); }}><div role="dialog" aria-modal="true" aria-labelledby="admin-title" className="animate-rise max-h-[90vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white shadow-2xl"><header className="sticky top-0 z-10 flex items-start justify-between border-b border-[#e0e8f0] bg-white p-5"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#1769e0]">Acesso exclusivo</p><h2 id="admin-title" className="mt-1 text-xl font-bold">Cadastros operacionais</h2><p className="mt-1 text-xs text-[#718197]">Cadastre os itens e mova aeronaves entre bases a qualquer momento.</p></div><button onClick={onClose} className="rounded-lg p-2 text-[#6f8194] hover:bg-[#edf3f8]" aria-label="Fechar"><X size={20} /></button></header><div className="grid gap-4 p-5 md:grid-cols-2"><CatalogSection title="Bases de operação" value={base} placeholder="Ex.: Santos" onValue={setBase} onAdd={() => { const bases=addUnique(catalogs.bases,base); onChange({ ...catalogs,bases }); setAircraftBase(base.trim()); setBase(""); }} items={catalogs.bases} onRemove={(item) => onChange({ ...catalogs,bases: catalogs.bases.filter((value) => value!==item),aircraft: catalogs.aircraft.filter((value) => value.base!==item) })} /><CatalogSection title="Modelos" value={model} placeholder="Ex.: Bell 429" onValue={setModel} onAdd={() => { const models=addUnique(catalogs.models,model); onChange({ ...catalogs,models }); setAircraftModel(model.trim()); setModel(""); }} items={catalogs.models} onRemove={(item) => onChange({ ...catalogs,models: catalogs.models.filter((value) => value!==item),aircraft: catalogs.aircraft.filter((value) => value.model!==item) })} /><UserCatalog users={catalogs.users} employeeNumber={employeeNumber} employeeName={employeeName} onNumber={setEmployeeNumber} onName={setEmployeeName} onAdd={() => { const number = employeeNumber.trim(); const name = employeeName.trim(); if (!number || !name) return; onChange({ ...catalogs, users: [...catalogs.users.filter((item) => item.employeeNumber !== number), { employeeNumber: number, name }].sort((a, b) => a.employeeNumber.localeCompare(b.employeeNumber)) }); setEmployeeNumber(""); setEmployeeName(""); }} onRemove={(number) => onChange({ ...catalogs, users: catalogs.users.filter((item) => item.employeeNumber !== number) })} /><section className="rounded-xl border border-[#dce6f0] p-4"><h3 className="font-bold">Aeronaves e base atual</h3><p className="mb-3 text-xs text-[#718197]">O prefixo e o modelo são fixos; altere a base pelo seletor.</p><div className="grid gap-2 sm:grid-cols-2"><input aria-label="Novo prefixo" value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} placeholder="PR-XXX" className="h-10 w-full rounded-lg border border-[#cedbe7] px-3 text-sm outline-none" /><select aria-label="Modelo da aeronave" value={aircraftModel} onChange={(e) => setAircraftModel(e.target.value)} className="h-10 w-full rounded-lg border border-[#cedbe7] bg-white px-3 text-sm"><option value="" disabled>Selecione o modelo</option>{catalogs.models.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Base atual da nova aeronave" value={aircraftBase} onChange={(e) => setAircraftBase(e.target.value)} className="h-10 w-full rounded-lg border border-[#cedbe7] bg-white px-3 text-sm"><option value="" disabled>Selecione a base</option>{catalogs.bases.map((item) => <option key={item}>{item}</option>)}</select><button disabled={!prefix.trim()||!aircraftModel||!aircraftBase} onClick={() => { const clean=prefix.trim(); onChange({ ...catalogs,aircraft: [...catalogs.aircraft.filter((item) => item.prefix!==clean),{ prefix: clean,model: aircraftModel,base: aircraftBase }].sort((a,b) => a.prefix.localeCompare(b.prefix)) }); setPrefix(""); }} className="flex h-10 w-full items-center justify-center gap-1 rounded-lg bg-[#1268d8] text-xs font-bold text-white"><Plus size={15} /> Adicionar aeronave</button></div><div className="mt-4 space-y-2">{catalogs.aircraft.map((item) => <div key={item.prefix} className="grid gap-2 rounded-lg bg-[#f2f6fa] p-2.5 text-xs sm:grid-cols-[1fr_1.1fr_1.4fr_auto] sm:items-center"><span><strong>{item.prefix}</strong><small className="ml-1 text-[#718197]">· {item.model}</small></span><select aria-label={`Base atual de ${item.prefix}`} value={item.base} onChange={(e) => onChange({ ...catalogs,aircraft: catalogs.aircraft.map((value) => value.prefix===item.prefix? { ...value,base: e.target.value }:value) })} className="h-8 min-w-0 rounded-md border border-[#cbd9e7] bg-white px-2 text-xs font-semibold text-[#36516d]">{catalogs.bases.map((baseName) => <option key={baseName}>{baseName}</option>)}</select><AircraftAvailability aircraft={item} onChange={(available,unavailabilityReason) => onChange({ ...catalogs,aircraft: catalogs.aircraft.map((value) => value.prefix===item.prefix? { ...value,available,unavailabilityReason,availabilityUpdatedBy:user }:value) })} /><button onClick={() => onChange({ ...catalogs,aircraft: catalogs.aircraft.filter((value) => value.prefix!==item.prefix) })} className="text-[#8a9aad] hover:text-red-600" aria-label={`Remover ${item.prefix}`}><Trash2 size={14} /></button></div>)}</div></section></div></div></div>;
}

function CatalogSection({ title,value,placeholder,items,onValue,onAdd,onRemove }: { title: string; value: string; placeholder: string; items: string[]; onValue: (value: string) => void; onAdd: () => void; onRemove: (value: string) => void; }) { return <section className="rounded-xl border border-[#dce6f0] p-4"><h3 className="font-bold">{title}</h3><p className="mb-3 text-xs text-[#718197]">Cadastre opções para os filtros.</p><div className="flex gap-2"><input aria-label={`Novo cadastro em ${title}`} value={value} onChange={(e) => onValue(e.target.value)} onKeyDown={(e) => { if(e.key==="Enter"&&value.trim()) onAdd(); }} placeholder={placeholder} className="h-10 min-w-0 flex-1 rounded-lg border border-[#cedbe7] px-3 text-sm outline-none" /><button disabled={!value.trim()} onClick={onAdd} className="grid h-10 w-10 place-items-center rounded-lg bg-[#1268d8] text-white" aria-label={`Adicionar em ${title}`}><Plus size={16} /></button></div><div className="mt-4 space-y-2">{items.map((item) => <div key={item} className="flex items-center justify-between rounded-lg bg-[#f2f6fa] p-2.5 text-xs"><span className="font-semibold">{item}</span><button onClick={() => onRemove(item)} className="text-[#8a9aad] hover:text-red-600" aria-label={`Remover ${item}`}><Trash2 size={14} /></button></div>)}</div></section>; }

function UserCatalog({ users, employeeNumber, employeeName, onNumber, onName, onAdd, onRemove }: { users: Catalogs["users"]; employeeNumber: string; employeeName: string; onNumber: (value: string) => void; onName: (value: string) => void; onAdd: () => void; onRemove: (value: string) => void }) {
  return <section className="rounded-xl border border-[#dce6f0] p-4"><h3 className="font-bold">Usuários operacionais</h3><p className="mb-3 text-xs text-[#718197]">Cadastre quem pode entrar. Senha inicial de teste: <strong>1234</strong>.</p><div className="grid gap-2 sm:grid-cols-2"><input aria-label="Matrícula do usuário" inputMode="numeric" value={employeeNumber} onChange={(e) => onNumber(e.target.value.replace(/\D/g, ""))} placeholder="Matrícula" className="h-10 rounded-lg border border-[#cedbe7] px-3 text-sm outline-none" /><input aria-label="Nome do usuário" value={employeeName} onChange={(e) => onName(e.target.value)} placeholder="Nome completo" className="h-10 rounded-lg border border-[#cedbe7] px-3 text-sm outline-none" /><button disabled={!employeeNumber.trim() || !employeeName.trim()} onClick={onAdd} className="flex h-10 items-center justify-center gap-1 rounded-lg bg-[#1268d8] text-xs font-bold text-white sm:col-span-2"><Plus size={15} /> Adicionar usuário</button></div><div className="mt-4 space-y-2">{users.map((item) => <div key={item.employeeNumber} className="flex items-center justify-between rounded-lg bg-[#f2f6fa] p-2.5 text-xs"><span><strong>{item.name}</strong><small className="ml-1 text-[#718197]">· {item.employeeNumber}</small></span><button onClick={() => onRemove(item.employeeNumber)} className="text-[#8a9aad] hover:text-red-600" aria-label={`Remover usuário ${item.employeeNumber}`}><Trash2 size={14} /></button></div>)}</div></section>;
}
function AircraftAvailability({ aircraft,onChange }: { aircraft: Catalogs["aircraft"][number]; onChange:(available:boolean,reason:string)=>void }) { const [reason,setReason]=useState(aircraft.unavailabilityReason??""); return <div className="flex gap-1"><input aria-label={`Motivo de indisponibilidade de ${aircraft.prefix}`} value={reason} onChange={(event)=>setReason(event.target.value)} placeholder="Motivo" className="h-8 min-w-0 flex-1 rounded-md border border-[#cbd9e7] bg-white px-2" /><button onClick={()=>onChange(!(aircraft.available??true),reason.trim())} className={`rounded-md px-2 font-bold ${(aircraft.available??true)?"bg-green-50 text-green-700":"bg-red-50 text-red-700"}`}>{(aircraft.available??true)?"Disponível":"Indisponível"}</button>{aircraft.availabilityUpdatedBy?<small className="self-center text-[9px] text-[#718197]">Mat. {aircraft.availabilityUpdatedBy}</small>:null}</div>; }

type AiProposal={ prefix:string|null; base:string|null; date:string|null; departure:string|null; duration:number|null; fuelAmount:number|null; fuelUnit:FuelUnit|null };
function AiAssistant({ flights,catalogs,user,onClose,onCreate }: { flights:Flight[]; catalogs:Catalogs; user:string; onClose:()=>void; onCreate:(flights:Flight[])=>void }) {
  const [message,setMessage]=useState(""); const [imageData,setImageData]=useState<string>(); const [reply,setReply]=useState("Olá! Envie uma pergunta, comando, áudio ou fotografia da previsão de voos."); const [proposals,setProposals]=useState<AiProposal[]>([]); const [loading,setLoading]=useState(false); const [listening,setListening]=useState(false); const [recognition,setRecognition]=useState<SpeechRecognitionLike>();
  function toggleVoice() { if(listening) { recognition?.stop(); return; } const browserWindow=window as unknown as { SpeechRecognition?:new()=>SpeechRecognitionLike; webkitSpeechRecognition?:new()=>SpeechRecognitionLike }; const Recognition=browserWindow.SpeechRecognition??browserWindow.webkitSpeechRecognition; if(!Recognition) { setReply("O reconhecimento de voz não está disponível neste navegador. Use Chrome ou Edge atualizado, ou digite o comando."); return; } const instance=new Recognition(); instance.lang="pt-BR"; instance.interimResults=false; instance.continuous=false; instance.onresult=(event)=>{const transcript=event.results[0]?.[0]?.transcript??""; setMessage((current)=>current?`${current} ${transcript}`:transcript);}; instance.onerror=(event)=>setReply(event.error==="not-allowed"?"Permita o uso do microfone no navegador para ditar comandos.":"Não consegui reconhecer a fala. Tente novamente."); instance.onend=()=>setListening(false); setRecognition(instance); setListening(true); instance.start(); }
  async function send() { setLoading(true); setReply(""); try { const response=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message,image:imageData,context:{today:todayLocal(),aircraft:catalogs.aircraft,bases:catalogs.bases,models:catalogs.models,flights}})}); const data=await response.json(); if(!response.ok) throw new Error(data.error); setReply(data.reply); setProposals(data.proposedFlights??[]); } catch(error) { setReply(error instanceof Error?error.message:"Falha ao consultar a IA."); } finally { setLoading(false); } }
  function confirm() { const created=proposals.flatMap((proposal) => { const aircraft=catalogs.aircraft.find((item)=>item.prefix===proposal.prefix&&(item.available??true)); if(!aircraft||!proposal.date||!proposal.departure||!proposal.duration) return []; return [{ id:crypto.randomUUID(),prefix:aircraft.prefix,model:aircraft.model,base:proposal.base&&catalogs.bases.includes(proposal.base)?proposal.base:aircraft.base,date:proposal.date,departure:proposal.departure,duration:proposal.duration,fuelAmount:proposal.fuelAmount??0,fuelUnit:proposal.fuelUnit??"L",fuel:"pending" as CheckValue,preflight:"pending" as CheckValue,hums:"pending" as CheckValue,engineStart:"pending" as CheckValue,shutdown:"pending" as CheckValue,revision:1,acknowledged:{[user]:1},actionBy:{created:user},history:[{field:"created",value:"IA confirmada",employeeNumber:user,at:new Date().toISOString()}],createdBy:user,updatedBy:user}]; }); onCreate(created); setProposals([]); setReply(`${created.length} voo(s) lançado(s) após sua confirmação.`); }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#071a30]/60 p-4 backdrop-blur-sm"><div role="dialog" aria-modal="true" className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b p-5"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#1769e0]">Flight IA</p><h2 className="text-xl font-bold">Assistente operacional</h2></div><button onClick={onClose} aria-label="Fechar"><X /></button></header><div className="min-h-32 flex-1 overflow-auto p-5"><div className="rounded-xl bg-[#eef5ff] p-4 text-sm leading-relaxed">{reply||"Analisando..."}</div>{proposals.length? <div className="mt-4"><h3 className="text-sm font-bold">Propostas para revisão</h3><div className="mt-2 space-y-2">{proposals.map((item,index)=><div key={index} className="rounded-lg border p-3 text-xs"><strong>{item.prefix??"Prefixo não identificado"}</strong> · {item.date??"sem data"} {item.departure??"sem horário"} · {item.base??"base não identificada"}</div>)}</div><button onClick={confirm} className="mt-3 rounded-lg bg-green-600 px-4 py-2 text-xs font-bold text-white">Confirmar lançamentos válidos</button></div>:null}</div><footer className="border-t p-4"><div className="mb-2 flex items-center gap-2"><label className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold"><Upload size={15}/> Anexar foto<input type="file" accept="image/*" className="hidden" onChange={(event)=>{const file=event.target.files?.[0];if(file){const reader=new FileReader();reader.onload=()=>setImageData(String(reader.result));reader.readAsDataURL(file)}}}/></label><button type="button" onClick={toggleVoice} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${listening?"border-red-300 bg-red-50 text-red-700":""}`}>{listening?<MicOff size={15}/>:<Mic size={15}/>} {listening?"Parar":"Falar"}</button>{imageData?<span className="text-xs font-semibold text-green-700">Foto pronta</span>:null}{listening?<span className="animate-pulse text-xs font-semibold text-red-700">Ouvindo...</span>:null}</div><div className="flex gap-2"><textarea value={message} onChange={(event)=>setMessage(event.target.value)} placeholder="Ex.: lance estes voos na base Jacarepaguá" className="min-h-20 flex-1 rounded-xl border p-3 text-sm"/><button disabled={loading||(!message.trim()&&!imageData)} onClick={send} className="rounded-xl bg-[#1268d8] px-4 text-sm font-bold text-white">{loading?"Analisando":"Enviar"}</button></div></footer></div></div>;
}
function ModalField({ label,children,full }: { label: string; children: React.ReactNode; full?: boolean; }) { return <label className={full? "sm:col-span-2":""}><span className="mb-1.5 block text-xs font-bold text-[#5d7187]">{label}</span><div className="[&>input]:h-11 [&>input]:w-full [&>input]:rounded-xl [&>input]:border [&>input]:border-[#cedbe7] [&>input]:px-3 [&>input]:outline-none [&>select]:h-11 [&>select]:w-full [&>select]:rounded-xl [&>select]:border [&>select]:border-[#cedbe7] [&>select]:bg-white [&>select]:px-3 [&>select]:outline-none">{children}</div></label>; }
