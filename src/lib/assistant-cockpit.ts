import {cockpitFields,cockpitLabels,valueOf,type CockpitEntry,type CockpitData} from './cockpit';
import {parseFormPatch,type AssistantFormContext} from './assistant-form';

export function cockpitAssistantForm(entry:CockpitEntry,data:CockpitData,aircraft:{prefix:string}[],monthly=false):AssistantFormContext {
 const fields=cockpitFields[entry.kind].filter(f=>!monthly||f.key==='externalEmployeeId');
 return {id:`cockpit:${entry.id}`,label:cockpitLabels[entry.kind],mode:'draft',revision:entry.revision,fields:{
  ...Object.fromEntries(fields.map(f=>[f.key,{label:f.label+(f.type==='datetime-local'?' · data e hora ISO com fuso explícito':f.type==='date'?' · AAAA-MM-DD':f.type==='number'?' · número não negativo, ponto decimal':''),value:valueOf(data,f.key),maxLength:f.type==='textarea'?8000:1000,...(f.options?{options:['',...f.options]}:{})}])),
  ...(entry.kind==='occurrence'&&!entry.flight_id?{prefix:{label:'Prefixo da aeronave',value:valueOf(data,'prefix'),options:['',...aircraft.map(a=>a.prefix)]}}:{})
 }};
}

/** Only edits the same local draft as the fields; signatures and server save remain unchanged. */
export function cockpitAssistantPatch(form:AssistantFormContext,entry:CockpitEntry,values:unknown):Record<string,string> {
 const patch=parseFormPatch(form,values);
 for(const [key,value] of Object.entries(patch)){
  if(!value)continue;
  const field=cockpitFields[entry.kind].find(f=>f.key===key);
  if(field?.type==='number'&&!/^\d+(\.\d+)?$/.test(value))throw Error(`Confira o número de ${field.label}.`);
  if(field?.type==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value))throw Error(`Confira a data de ${field.label}.`);
  if(field?.type==='datetime-local'&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value))))throw Error(`Informe data, hora e fuso de ${field.label}.`);
  if(field?.type==='url'&&!/^https?:\/\//i.test(value))throw Error(`Confira o endereço de ${field.label}.`);
 }
 return patch;
}
