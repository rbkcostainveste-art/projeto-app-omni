import webpush from "npm:web-push@3.6.7";
import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
Deno.serve(async request=>{
 const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
 const {data:rows,error}=await db.from("app_secrets").select("name,value").in("name",["vapid_public","vapid_private","push_cron_secret"]);
 if(error)return new Response("Unavailable",{status:503});
 const secrets=Object.fromEntries((rows||[]).map(r=>[r.name,r.value]));
 if(!secrets.push_cron_secret||request.headers.get("x-cron-secret")!==secrets.push_cron_secret)return new Response("Unauthorized",{status:401});
 webpush.setVapidDetails("mailto:operacoes@passagem-de-pista.app",secrets.vapid_public,secrets.vapid_private);
 const {data:jobs,error:claimError}=await db.rpc("claim_chat_push");
 if(claimError)return new Response("Queue unavailable",{status:503});
 let sent=0;
 for(const job of jobs||[]){
  const {data:msg}=await db.from("internal_messages").select("conversation_id").eq("id",job.message_id).single();
  const {data:person}=await db.from("authorized_users").select("active").eq("employee_number",job.employee_number).single();
  const {data:member,error:membershipError}=await db.rpc("chat_push_allowed",{p_message:job.message_id,p_employee:job.employee_number});
  const {data:receipt}=await db.from("chat_receipts").select("read_at").eq("message_id",job.message_id).eq("employee_number",job.employee_number).maybeSingle();
  const {data:targets,error:targetError}=await db.from("push_subscriptions").select("*").eq("employee_number",job.employee_number);
  let retry=Boolean(targetError||membershipError);let deliveryStatus=targetError||membershipError?"retrying":!person?.active||!member?"inactive":receipt?.read_at?"already_read":!targets?.length?"no_device":"sent";let lastError=targetError||membershipError?"Delivery authorization lookup failed":null;
  if(msg&&person?.active&&member&&!receipt?.read_at)for(const target of targets||[]){
   try{
    await webpush.sendNotification({endpoint:target.endpoint,keys:{p256dh:target.p256dh,auth:target.auth}},JSON.stringify({title:"Flight IA · Nova mensagem",body:"Você recebeu uma mensagem. Toque para abrir a conversa.",conversationId:msg.conversation_id,url:"/?chat="+msg.conversation_id,tag:"chat-"+msg.conversation_id}),{TTL:3600});
    sent++;
   }catch(e){const status=(e as {statusCode?:number}).statusCode;if(status===404||status===410)await db.from("push_subscriptions").delete().eq("id",target.id);else {retry=true;lastError="Push provider temporarily unavailable";}}
  }
  await db.from("chat_push_jobs").update({done:!retry,delivery_status:retry?"retrying":deliveryStatus,last_error:lastError}).eq("message_id",job.message_id).eq("employee_number",job.employee_number);
 }
 return Response.json({ok:true,sent});
});
