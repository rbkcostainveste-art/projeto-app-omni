import type {TechnicalCase} from './technical-case';

/** Descriptive evidence only. Authority, release and confirmation flags are never writable here. */
export const technicalAssistantFields = [
 ['component','Componente informado','action','component'],
 ['position','Posição informada, como LH/RH','action','position'],
 ['performed','Ação efetivamente realizada e informada','action','performed'],
 ['test','Teste efetivamente executado e informado','action','test'],
 ['measurement','Medição informada, com unidade; não calcular nem estimar','action','measurement'],
 ['limit','Limite explicitamente informado; não inferir do conhecimento geral','action','limit'],
 ['result','Resultado observado e informado, sem concluir liberação','action','result'],
 ['manufacturer','Fabricante informado do documento consultado','document','manufacturer'],
 ['documentModel','Modelo informado do documento consultado','document','model'],
 ['registration','Matrícula informada para a referência consultada','document','registration'],
 ['serial','Número de série informado','document','serial'],
 ['ata','ATA informado','document','ata'],
 ['document','Nome do documento informado como consultado','document','document'],
 ['task','Capítulo ou tarefa explicitamente informado','document','task'],
 ['documentRevision','Revisão explicitamente informada do documento','document','revision'],
 ['effectivity','Efetividade informada; não confirmar aplicabilidade por suposição','document','effectivity'],
 ['consultedAt','Data de consulta efetivamente informada','document','consultedAt'],
 ['reason','Justificativa da alteração informada pelo usuário','root','reason'],
] as const;

export function parseTechnicalAssistantValues(value:unknown):Record<string,string>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Campos técnicos inválidos.');
 const result:Record<string,string>={};
 for(const [key,text] of Object.entries(value)){
  if(!technicalAssistantFields.some(f=>f[0]===key)||typeof text!=='string'||text.length>12000)throw Error('Campo técnico não permitido ou inválido.');
  result[key]=text;
 }
 return result;
}

export function technicalAssistantValues(value:TechnicalCase):Record<string,string>{
 return Object.fromEntries(technicalAssistantFields.map(([key,,group,field])=>[key,String(group==='root'?value.reason||'':value[group]?.[field]||'')]));
}

export function applyTechnicalAssistantValues(value:TechnicalCase,input:Record<string,string>):TechnicalCase{
 const values=parseTechnicalAssistantValues(input),next={...value,action:{...value.action},document:{...value.document}};
 for(const [key,,group,field] of technicalAssistantFields){
  if(values[key]===undefined)continue;
  if(group==='root')next.reason=values[key];else next[group][field]=values[key];
 }
 return next;
}
