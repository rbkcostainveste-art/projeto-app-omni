import type {SupabaseClient} from '@supabase/supabase-js';
import type {AssistantAttachment} from './contextual-assistant';
import {assistantMediaContent} from './assistant-media';
import {assistantUploadBucket,assistantFileLimit} from './assistant-uploads';
/** Download exclusively under the caller JWT. No arbitrary URL or shared bucket is accepted. */
export async function resolveAssistantMedia(client:SupabaseClient,attachments:AssistantAttachment[]){
 let total=0;
 const result:Record<string,unknown>[]=[];
 for(const file of attachments){
  let data=file.data;
  if(data.startsWith('storage:')){
   const path=data.slice(8);
   if(!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|png|jpg|webp)$/.test(path))throw Error('Anexo inválido.');
   const {data:blob,error}=await client.storage.from(assistantUploadBucket).download(path);
   if(error||!blob)throw Error('Anexo indisponível para sua sessão.');
   if(blob.size>assistantFileLimit)throw Error('Arquivo acima de 20 MB.');
   const mime=path.endsWith('.pdf')?'application/pdf':path.endsWith('.jpg')?'image/jpeg':path.endsWith('.webp')?'image/webp':'image/png';
   data=`data:${mime};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`;
  }
  total+=Buffer.byteLength(data.slice(data.indexOf(',')+1),'base64');
  if(total>40*1024*1024)throw Error('Envie até 40 MB por mensagem.');
  result.push(...assistantMediaContent([{name:file.name,data}],assistantFileLimit));
 }
 return result;
}
