import type {Passage,PassageCheckKey} from '@/components/runway-handover';
import {parseFormPatch,type AssistantFormContext} from './assistant-form';

const choices={pending:'Pendente',yes:'Sim',no:'Não'} as const;
export function passageAssistantForm(item:Passage,labels:Partial<Record<PassageCheckKey,string>>):AssistantFormContext{
 const fields:AssistantFormContext['fields']={notes:{label:'Observações',value:item.notes,maxLength:4000},discrepancyDetails:{label:'Descrição do caso técnico reportado',value:item.discrepancyDetails,maxLength:2000}};
 for(const [key,label] of Object.entries(labels))fields[key]={label:`${label}: alterar somente se informado explicitamente; Sim confirma o item realizado`,value:choices[item.checks[key as PassageCheckKey]||'pending'],options:Object.values(choices)};
 for(const engine of ['engine1','engine2'] as const){const entry=item.oilAdditions?.[engine];fields[`${engine}Amount`]={label:`Óleo adicionado ao motor ${engine==='engine1'?'1':'2'}: quantidade informada, sem calcular`,value:entry?.amount?.toString()||'',maxLength:30};fields[`${engine}Unit`]={label:`Unidade de óleo do motor ${engine==='engine1'?'1':'2'}`,value:entry?.unit||'ml',options:['ml','L']};}
 return {id:`passage:${item.id}`,label:`Passagem de Pista · ${item.prefix}`,mode:'record',revision:item.revision??Date.parse(item.updatedAt),fields};
}
export function passageAssistantPatch(item:Passage,labels:Partial<Record<PassageCheckKey,string>>,input:Record<string,string>,actor:string,at:string){
 const values=parseFormPatch(passageAssistantForm(item,labels),input);
 const next:Passage={...item,checks:{...item.checks},actions:{...item.actions},oilAdditions:{engine1:{...item.oilAdditions?.engine1||{amount:null,unit:'ml'}},engine2:{...item.oilAdditions?.engine2||{amount:null,unit:'ml'}}}};
 const washes:PassageCheckKey[]=[];
 for(const key of Object.keys(labels) as PassageCheckKey[]){if(values[key]===undefined)continue;const value=values[key]==='Sim'?'yes':values[key]==='Não'?'no':'pending';next.checks[key]=value;next.actions[key]={employeeNumber:actor,at};if(['compressorWash','ctDiskWash','productWash'].includes(key)&&value==='yes'&&item.checks[key]!=='yes')washes.push(key);}
 for(const key of ['notes','discrepancyDetails'] as const)if(values[key]!==undefined){next[key]=values[key];next.actions[key]={employeeNumber:actor,at};}
 if(next.checks.discrepancy!=='yes'&&values.discrepancyDetails)throw Error('Para descrever um caso técnico, informe também que ele foi reportado.');
 if(values.discrepancy!==undefined&&next.checks.discrepancy!=='yes')next.discrepancyDetails='';
 for(const engine of ['engine1','engine2'] as const){const amount=values[`${engine}Amount`],unit=values[`${engine}Unit`];if(amount===undefined&&unit===undefined)continue;const entry=next.oilAdditions![engine];if(amount!==undefined){const parsed=amount.trim()===''?null:Number(amount.replace(',','.'));if(parsed!==null&&(!Number.isFinite(parsed)||parsed<0))throw Error('Informe uma quantidade de óleo válida, maior ou igual a zero.');entry.amount=parsed;}if(unit!==undefined)entry.unit=unit as 'ml'|'L';next.actions[engine==='engine1'?'engine1Oil':'engine2Oil']={employeeNumber:actor,at};}
 next.updatedAt=at;return {next,washes};
}
