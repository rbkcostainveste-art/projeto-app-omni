import type {SupabaseClient} from '@supabase/supabase-js';

type ContentKey=Record<string,string|number>;
type PendingFile={bucket:string;name:string};

async function rpc<T>(client:SupabaseClient,action:string,extra:Record<string,unknown>={}):Promise<T>{
 const {data,error}=await client.rpc('admin_content',{p_action:action,...extra});
 if(error)throw Error(error.message);
 return data as T;
}

export async function finishAdminFileDeletion(client:SupabaseClient){
 const files=await rpc<PendingFile[]>(client,'pending_files');
 for(const bucket of new Set(files.map(file=>file.bucket))){
  const group=files.filter(file=>file.bucket===bucket);
  for(let index=0;index<group.length;index+=100){
   const batch=group.slice(index,index+100);
   const {error}=await client.storage.from(bucket).remove(batch.map(file=>file.name));
   if(error)throw Error(`Conteúdo excluído; anexos pendentes: ${error.message}`);
   await rpc(client,'file_done',{p_keys:batch});
  }
 }
}

export async function deleteAdminContent(client:SupabaseClient,kind:string,keys:ContentKey[]){
 const result=await rpc<{removed:number}>(client,'delete',{p_kind:kind,p_keys:keys,p_confirmation:'EXCLUIR'});
 await finishAdminFileDeletion(client);
 window.dispatchEvent(new Event('flight-ia-chat-refresh'));
 window.dispatchEvent(new Event('flight-ia-content-refresh'));
 return result.removed;
}
