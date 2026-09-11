import {parseAssistantAttachments} from "./contextual-assistant";
export type ImportedService={prefix:string;title:string;description:string;tc:string;notes:string};
const fields=["prefix","title","description","tc","notes"] as const;
export function parseServiceImportRequest(value:unknown){
 if(!value||typeof value!=="object")throw Error("Pedido inválido");
 const b=value as Record<string,unknown>;
 if(typeof b.message!=="string"||b.message.length>16000)throw Error("Texto acima do limite");
 const attachments=parseAssistantAttachments(b.attachments||[]);
 if(!b.message.trim()&&!attachments.length)throw Error("Envie o texto ou mapa de manutenção");
 return {message:b.message,attachments};
}
export function parseServiceImportAnswer(value:unknown):{reply:string;services:ImportedService[]}{
 if(!value||typeof value!=="object")throw Error("Resposta inválida");
 const b=value as Record<string,unknown>;
 if(typeof b.reply!=="string"||b.reply.length>6000||!Array.isArray(b.services)||b.services.length>100)throw Error("Resposta inválida");
 return {reply:b.reply,services:b.services.map(value=>{
 if(!value||typeof value!=="object")throw Error("Tarefa inválida");
 const r=value as Record<string,unknown>;
 const row=Object.fromEntries(fields.map(k=>{if(r[k]!==null&&(typeof r[k]!=="string"||(r[k] as string).length>(k==="description"?12000:k==="notes"?1200:160)))throw Error("Campo inválido");return [k,(r[k] as string||"").trim()];})) as ImportedService;
 return {...row,prefix:row.prefix.toUpperCase()};
 })};
}
export const serviceImportSchema={type:"object",additionalProperties:false,properties:{reply:{type:"string"},services:{type:"array",items:{type:"object",additionalProperties:false,properties:Object.fromEntries(fields.map(k=>[k,{type:["string","null"]}])),required:fields}}},required:["reply","services"]};
