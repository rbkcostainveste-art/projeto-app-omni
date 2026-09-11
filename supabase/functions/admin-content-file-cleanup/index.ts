import {createClient} from "npm:@supabase/supabase-js@2.57.4";
Deno.serve(async request=>{
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 const {data:secret,error:secretError}=await db.from('app_secrets').select('value').eq('name','push_cron_secret').single();
 if(secretError||!secret?.value||request.headers.get('x-cron-secret')!==secret.value)return new Response('Unauthorized',{status:401});
 const {data,error}=await db.rpc('admin_content_file_queue');
 if(error)return new Response('Queue unavailable',{status:503});
 const files=(data||[]) as {bucket:string;name:string}[];let removed=0;
 for(const bucket of new Set(files.map(file=>file.bucket))){
  const batch=files.filter(file=>file.bucket===bucket);
  const {error:removeError}=await db.storage.from(bucket).remove(batch.map(file=>file.name));
  if(removeError)return new Response('Storage cleanup pending',{status:503});
  const {error:doneError}=await db.rpc('admin_content_file_queue',{p_done:batch});
  if(doneError)return new Response('Queue acknowledgement pending',{status:503});
  removed+=batch.length;
 }
 return Response.json({ok:true,removed});
});
