import type {SupabaseClient} from '@supabase/supabase-js';
import type {AssistantAttachment} from './contextual-assistant';
export const assistantUploadBucket='assistant-inputs';
export const assistantFileLimit=20*1024*1024;
export const assistantFileCount=10;
export const assistantFileAccept='image/png,image/jpeg,image/webp,application/pdf';
export async function prepareAssistantFiles(client:SupabaseClient|null,files:File[],existing:AssistantAttachment[]=[]){
 if(existing.length+files.length>assistantFileCount)throw Error('Adicione até 10 arquivos por mensagem.');
 files.forEach(file=>{if(!file.size||file.size>assistantFileLimit||!assistantFileAccept.split(',').includes(file.type))throw Error('Use PNG, JPG, WebP ou PDF de até 20 MB por arquivo.');});
 const added:AssistantAttachment[]=[];
 try{
  for(const file of files){
   if(file.size<=200000){const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('Não foi possível ler o arquivo.'));reader.readAsDataURL(file);});added.push({name:file.name.slice(0,180),data});continue;}
   if(!client)throw Error('Entre novamente para anexar arquivos.');
   const {data}=await client.auth.getSession();if(!data.session)throw Error('Entre novamente para anexar arquivos.');
   const extension={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','application/pdf':'pdf'}[file.type];
   const path=`${data.session.user.id}/${crypto.randomUUID()}.${extension}`;
   const {error}=await client.storage.from(assistantUploadBucket).upload(path,file,{contentType:file.type,upsert:false});
   if(error)throw Error('Não foi possível anexar o arquivo. Tente novamente.');
   added.push({name:file.name.slice(0,180),data:`storage:${path}`});
  }
  return [...existing,...added];
 }catch(error){await removeAssistantFiles(client,added);throw error;}
}
export async function removeAssistantFiles(client:SupabaseClient|null,files:AssistantAttachment[]){
 const paths=files.filter(f=>f.data.startsWith('storage:')).map(f=>f.data.slice(8));
 if(client&&paths.length)await client.storage.from(assistantUploadBucket).remove(paths);
}
