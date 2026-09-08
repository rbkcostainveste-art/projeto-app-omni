import webpush from 'npm:web-push@3.6.7';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
Deno.serve(async request=>{
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 const {data:rows,error}=await db.from('app_secrets').select('name,value').in('name',['vapid_public','vapid_private','push_cron_secret']);
 if(error)return new Response('Unavailable',{status:503});
 const secrets=Object.fromEntries((rows||[]).map(r=>[r.name,r.value]));
 if(!secrets.push_cron_secret||request.headers.get('x-cron-secret')!==secrets.push_cron_secret)return new Response('Unauthorized',{status:401});
 webpush.setVapidDetails('mailto:operacoes@passagem-de-pista.app',secrets.vapid_public,secrets.vapid_private);
 const {data:jobs,error:claimError}=await db.rpc('claim_note_reminders');if(claimError)return new Response('Queue unavailable',{status:503});
 let sent=0;
 for(const job of jobs||[]){
  const {data:current}=await db.from('personal_notes').select('id').eq('id',job.id).eq('reminder_version',job.reminder_version).eq('reminder_done',false).maybeSingle();if(!current)continue;
  const {data:person}=await db.from('authorized_users').select('active').eq('employee_number',job.employee_number).maybeSingle();
  const {data:targets,error:targetError}=await db.from('push_subscriptions').select('*').eq('employee_number',job.employee_number);
  let retry=Boolean(targetError),status=!person?.active?'inactive':!targets?.length?'no_device':'sent';
  if(person?.active)for(const target of targets||[]){try{
   await webpush.sendNotification({endpoint:target.endpoint,keys:{p256dh:target.p256dh,auth:target.auth}},JSON.stringify({title:'Flight IA · Lembrete pessoal',body:'Você tem uma nota agendada. Toque para abrir.',noteId:job.id,url:'/?note='+job.id,tag:'note-'+job.id+'-'+job.reminder_version}),{TTL:3600});sent++;
  }catch(e){const code=(e as {statusCode?:number}).statusCode;if(code===404||code===410){await db.from('push_subscriptions').delete().eq('id',target.id);status='no_device';}else retry=true;}}
  await db.from('personal_notes').update({reminder_done:!retry,reminder_status:retry?(job.reminder_attempts>=5?'failed':'retrying'):status}).eq('id',job.id).eq('reminder_version',job.reminder_version);
 }
 return Response.json({ok:true,sent});
});
