import {applyTechnicalAssistantValues,technicalAssistantValues} from './assistant-technical-fields';
import {initialTechnicalCase,type TechnicalCase} from './technical-case';
import type {DraftFields} from './contextual-assistant';

/** Only descriptive fields are applied; never copy unsigned authority decisions from the review form. */
export function technicalCorrectionPayload(record:{revision:number;title:string;description:string;value?:TechnicalCase},fields:DraftFields,spoken='') {
  const base=record.value||initialTechnicalCase();
  const next=applyTechnicalAssistantValues(base,fields.technical||{});
  next.originalObservation=base.originalObservation||{title:record.title,description:record.description,spoken,at:new Date().toISOString()};
  next.reason=fields.technical?.reason?.trim()||'Correção de redação e informações descritivas autorizada pelo usuário no assistente.';
  return {revision:record.revision,case:next,title:fields.title,description:fields.description,...(fields.tc!==undefined?{tc:fields.tc}:{})};
}

/** Compare actual content, ignoring an audit reason alone and missing/empty metadata. */
export function technicalCorrectionChanges(before:DraftFields,after:DraftFields){
 const different=(a:string|undefined,b:string|undefined)=>(a||'').trim()!==(b||'').trim();
 return {
  text:different(before.title,after.title)||different(before.description,after.description),
  details:different(before.tc,after.tc)||Object.entries(after.technical||{}).some(([key,value])=>key!=='reason'&&different(before.technical?.[key],value)),
 };
}

/** A newer revision alone does not prove the proposed text was saved. */
export function verifyTechnicalCorrectionSaved(expected:DraftFields,saved:{title:string;data?:{description?:string};tc?:string;technical_case:TechnicalCase}){
 const actual:DraftFields={title:saved.title,description:saved.data?.description||'',tc:saved.tc||'',technical:technicalAssistantValues(saved.technical_case)};
 const changes=technicalCorrectionChanges(actual,expected);
 if(changes.text||changes.details)throw Error('O servidor não confirmou o conteúdo proposto. Reabra o relato para conferir antes de tentar novamente.');
}
