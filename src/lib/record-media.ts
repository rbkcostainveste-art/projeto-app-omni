import type { SupabaseClient } from "@supabase/supabase-js";
export type RecordMedia = {id:string;name:string;type:"image"|"audio"|"video";url:string;bucket?:string;author?:string;at?:string};
const formats:Record<string,string>={jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp",gif:"image/gif",heic:"image/heic",heif:"image/heif",mp4:"video/mp4",mov:"video/quicktime",webm:"video/webm",m4a:"audio/mp4",mp3:"audio/mpeg",aac:"audio/aac",ogg:"audio/ogg",opus:"audio/ogg",wav:"audio/wav"};
export function mediaFormat(file:Pick<File,"name"|"type"|"size">){
 const ext=file.name.split(".").pop()?.toLowerCase()||"";
 const mime=formats[ext];
 if(!mime)throw new Error(`${file.name}: formato não suportado. Use imagem, áudio ou vídeo.`);
 const contentType=file.type.startsWith("audio/")&&["webm","ogg","opus"].includes(ext)?file.type:mime;
 const type=contentType.split("/")[0] as RecordMedia["type"];
 const max=type==="video"?50:10;
 if(file.size===0)throw new Error(`${file.name}: arquivo vazio.`);
 if(file.size>max*1024*1024)throw new Error(`${file.name}: limite de ${max} MB por arquivo.`);
 return {type,contentType};
}
export async function uploadRecordMedia(client:SupabaseClient|null,files:File[],target:string,author:string):Promise<RecordMedia[]>{
 if(!files.length)return [];
 const formats=files.map(mediaFormat);
 if(!client)throw new Error("Sem conexão para enviar anexos. Tente novamente.");
 const {data,error}=await client.auth.getUser();
 if(error||!data.user)throw new Error("Entre novamente para enviar os anexos.");
 const uploaded:RecordMedia[]=[];
 try{
  for(let i=0;i<files.length;i++){
   const file=files[i],id=crypto.randomUUID();
   const name=file.name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9._-]/g,"-");
   const path=`${target}/${data.user.id}/${id}-${name}`;
   const {error}=await client.storage.from("record-media").upload(path,file,{contentType:formats[i].contentType,upsert:false});
   if(error)throw new Error(`Não foi possível enviar ${file.name}: ${error.message}`);
   uploaded.push({id,name:file.name,type:formats[i].type,url:path,bucket:"record-media",author,at:new Date().toISOString()});
  }
  return uploaded;
 }catch(error){if(uploaded.length)await client.storage.from("record-media").remove(uploaded.map(item=>item.url));throw error;}
}
