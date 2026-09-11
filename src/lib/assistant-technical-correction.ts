import {applyTechnicalAssistantValues} from './assistant-technical-fields';
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
