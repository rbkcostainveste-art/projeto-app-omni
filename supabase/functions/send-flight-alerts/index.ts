/* eslint-disable @typescript-eslint/no-explicit-any */
import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, x-client-info, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});

Deno.serve(async(request)=>{
  if(request.method==="OPTIONS") return new Response("ok",{headers:cors});
  const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
  const {data:secretRows,error:secretError}=await db.from("app_secrets").select("name,value").in("name",["vapid_public","vapid_private","push_cron_secret"]);
  if(secretError) return json({error:secretError.message},500);
  const secrets=Object.fromEntries((secretRows??[]).map((row)=>[row.name,row.value]));
  webpush.setVapidDetails("mailto:operacoes@passagem-de-pista.app",secrets.vapid_public,secrets.vapid_private);

  let body:{action?:string;flightId?:string}={};
  try { body=await request.json(); } catch { /* cron has no body */ }
  if(body.action==="test") {
    const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
    if(!token) return json({error:"Sessão ausente."},401);
    const {data:{user},error:userError}=await db.auth.getUser(token);
    if(userError||!user) return json({error:"Sessão inválida."},401);
    const [{data:target},{data:state}]=await Promise.all([
      db.from("push_subscriptions").select("*").eq("auth_user_id",user.id).order("updated_at",{ascending:false}).limit(1).maybeSingle(),
      db.from("shared_app_state").select("flights").eq("id","main").single()
    ]);
    const flight=(state?.flights??[]).find((item:any)=>item.id===body.flightId);
    if(!target) return json({error:"Este aparelho ainda não possui uma inscrição push válida."},409);
    if(!flight) return json({error:"Voo não encontrado."},404);
    if(flight.cancelled||flight.returned||flight.deletedAt||flight.shutdown==="ok"||flight.actualShutdown) return json({error:"Voos encerrados, cancelados, retornados ou excluídos não recebem alertas."},409);
    try {
      await webpush.sendNotification({endpoint:target.endpoint,keys:{p256dh:target.p256dh,auth:target.auth}},JSON.stringify({title:`Teste de alerta · ${flight.prefix}`,body:"A entrega de notificações neste aparelho está funcionando.",url:"/",tag:`flight-alert-test-${flight.id}`}));
      return json({ok:true});
    } catch(error:any) {
      if(error?.statusCode===404||error?.statusCode===410) await db.from("push_subscriptions").delete().eq("id",target.id);
      return json({error:error?.message??"Falha ao entregar a notificação de teste."},502);
    }
  }

  if(request.headers.get("x-cron-secret")!==secrets.push_cron_secret) return json({error:"Unauthorized"},401);
  const [{data:state,error:stateError},{data:alerts,error:alertsError},{data:subscriptions,error:subscriptionsError}]=await Promise.all([
    db.from("shared_app_state").select("flights").eq("id","main").single(),
    db.from("flight_alerts").select("*").eq("enabled",true),
    db.from("push_subscriptions").select("*")
  ]);
  if(stateError||alertsError||subscriptionsError) return json({error:stateError?.message??alertsError?.message??subscriptionsError?.message},500);
  const flights=new Map((state.flights??[]).map((flight:any)=>[flight.id,flight]));
  const now=Date.now(); let sent=0;
  for(const alert of alerts??[]) {
    const flight:any=flights.get(alert.flight_id);
    const closedReason=!flight?"Voo removido":flight.cancelled?"Voo cancelado":flight.returned?"Retorno registrado":flight.deletedAt?"Voo excluído":flight.shutdown==="ok"||flight.actualShutdown?"Voo encerrado":null;
    if(closedReason) { await db.from("flight_alerts").update({enabled:false,status:"closed",closed_reason:closedReason,closed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("auth_user_id",alert.auth_user_id).eq("flight_id",alert.flight_id); continue; }
    const start=flight.actualEngineStart??flight.departure;
    if(!flight.date||!start||!Number.isFinite(Number(flight.duration))) { await db.from("flight_alerts").update({status:"failed",status_detail:"Horário do voo inválido",last_attempt_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("auth_user_id",alert.auth_user_id).eq("flight_id",alert.flight_id); continue; }
    const departureAt=Date.parse(`${flight.date}T${start}:00-03:00`); const arrivalAt=departureAt+Math.round(Number(flight.duration)*60)*60000; const notifyAt=arrivalAt-alert.minutes_before*60000; const arrivalIso=new Date(arrivalAt).toISOString();
    if(now>=arrivalAt) { await db.from("flight_alerts").update({enabled:false,status:"expired",status_detail:"Janela do alerta encerrada",closed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("auth_user_id",alert.auth_user_id).eq("flight_id",alert.flight_id); continue; }
    if(now<notifyAt||alert.last_notified_arrival===arrivalIso) continue;
    const targets=(subscriptions??[]).filter((subscription)=>subscription.auth_user_id===alert.auth_user_id); let delivered=false; let failure="Nenhum aparelho inscrito para push";
    for(const target of targets) try {
      await webpush.sendNotification({endpoint:target.endpoint,keys:{p256dh:target.p256dh,auth:target.auth}},JSON.stringify({title:`Pouso previsto · ${flight.prefix}`,body:`Pouso previsto para ${new Date(arrivalAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",timeZone:"America/Sao_Paulo"})}.`,url:"/",tag:`flight-alert-${flight.id}-${arrivalIso}`})); delivered=true; sent++;
    } catch(error:any) { failure=error?.message??"Falha no serviço push"; if(error?.statusCode===404||error?.statusCode===410) await db.from("push_subscriptions").delete().eq("id",target.id); }
    const timestamp=new Date().toISOString();
    await db.from("flight_alerts").update(delivered?{enabled:false,status:"sent",status_detail:null,last_attempt_at:timestamp,last_delivered_at:timestamp,last_notified_arrival:arrivalIso,updated_at:timestamp}:{status:"failed",status_detail:failure,last_attempt_at:timestamp,updated_at:timestamp}).eq("auth_user_id",alert.auth_user_id).eq("flight_id",alert.flight_id);
  }
  return json({ok:true,sent});
});
