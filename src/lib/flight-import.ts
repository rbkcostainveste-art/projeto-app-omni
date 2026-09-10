import {parseAssistantAttachments} from './contextual-assistant';
import {isScheduleValue} from './flight-destination';
export const importFields = ["prefix", "date", "departure", "destination", "duration", "fuelAmount", "fuelUnit"] as const;
export type ImportField = typeof importFields[number];
export type ImportedFlight = Record<ImportField, string | null> & {notes: string;rowId?:string|null};
export type ImportAttachment = {name: string; data: string};
export type FlightIdentity = {id?:string;prefix: string; date: string; departure: string; cancelled?: boolean; deletedAt?: string};
export const importLabels: Record<ImportField,string> = {prefix:"Prefixo", date:"Data", departure:"Saída", destination:"Cliente / plataforma", duration:"Duração (HH:MM)", fuelAmount:"Abastecimento", fuelUnit:"Unidade"};
function obj(value: unknown): Record<string,unknown> {if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Dados inválidos."); return value as Record<string,unknown>;}
function str(value: unknown, max: number): string {if (typeof value !== "string" || value.length > max) throw Error("Texto inválido ou acima do limite.");return value;}
export function parseFlightImportRequest(value: unknown) {
  const body = obj(value), message = str(body.message,16000).trim();
  const attachments=parseAssistantAttachments(body.attachments??(body.attachment?[body.attachment]:[]));
  const previous=body.previous===undefined?[]:parseFlightImportAnswer({reply:'',flights:body.previous}).flights;
  if(!message&&!attachments.length)throw Error('Envie texto ou documento da programação.');
  const history=Array.isArray(body.history)?body.history.slice(-4).map(value=>{const turn=obj(value);return {message:str(turn.message,16000),reply:str(turn.reply,6000)};}):[];
  return {message,attachments,attachment:attachments[0],previous,history};
}
export function parseFlightImportAnswer(value: unknown): {reply: string; flights: ImportedFlight[]} {
  const body=obj(value), reply=str(body.reply,6000);
  if (!Array.isArray(body.flights) || body.flights.length>100) throw Error("Envie no máximo 100 voos por consulta.");
  const flights=body.flights.map(item=>{
    const row=obj(item);
    if(Object.keys(row).some(key=>![...importFields,"notes","rowId"].includes(key))) throw Error("Campo não permitido na importação.");
    const fields=Object.fromEntries(importFields.map(key=>[key,row[key]===null?null:str(row[key],key==="destination"?300:80)])) as Record<ImportField,string|null>;
    if(row.rowId!==undefined&&row.rowId!==null&&(typeof row.rowId!=='string'||!/^[-a-zA-Z0-9_:]{1,100}$/.test(row.rowId)))throw Error('Identificador inválido.');
    const originalNotes=str(row.notes,1200),invalidDestination=isScheduleValue(fields.destination);
    return {...fields,destination:invalidDestination?null:fields.destination,...(row.rowId?{rowId:row.rowId as string}:{}),prefix:fields.prefix?.trim().toUpperCase()||null,notes:invalidDestination?`O valor "${fields.destination}" parece um horário/data, não um destino. Cliente/plataforma ficou em branco para revisão.\n${originalNotes}`.slice(0,1200):originalNotes};
  });
  return {reply,flights};
}
export function validDate(value:string) {return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(`${value}T12:00:00Z`))&&new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)===value;}
export function validClock(value:string) {return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);}
export function duplicateFlight(row: {prefix:string|null;date:string|null;departure:string|null}, others: FlightIdentity[]) {
  return Boolean(row.prefix&&row.date&&row.departure&&others.some(other=>!other.cancelled&&!other.deletedAt&&other.prefix.toUpperCase()===row.prefix?.toUpperCase()&&other.date===row.date&&other.departure===row.departure));
}
export function importIssues(row:ImportedFlight,aircraft:{prefix:string;available?:boolean}[]) {
  const issues:string[]=[];
  if(!row.prefix)issues.push("Prefixo ausente");else if(!aircraft.some(a=>a.prefix===row.prefix&&a.available!==false))issues.push("Prefixo não cadastrado ou indisponível");
  if(!row.date||!validDate(row.date))issues.push("Data ausente ou inválida");
  if(!row.departure||!validClock(row.departure))issues.push("Saída ausente ou inválida");
  if(!row.destination?.trim())issues.push("Cliente/plataforma não informado");
  else if(isScheduleValue(row.destination))issues.push("O destino contém um horário ou data; confira o cliente/plataforma");
  if(!row.duration||!validClock(row.duration)||row.duration==="00:00")issues.push("Duração ausente ou inválida");
  if(row.fuelAmount!==null&&row.fuelAmount!==""&&(!/^\d+(?:\.\d+)?$/.test(row.fuelAmount)||!Number.isFinite(Number(row.fuelAmount))))issues.push("Abastecimento inválido");
  if(row.fuelAmount&&(!row.fuelUnit||!["L","lb","kg"].includes(row.fuelUnit)))issues.push("Confira a unidade de abastecimento");
  return issues;
}
export function importedDraftFields(row:ImportedFlight,aircraft:{prefix:string;available?:boolean}[]) {
  const unit = row.fuelUnit && ["L","lb","kg"].includes(row.fuelUnit) ? row.fuelUnit as "L"|"lb"|"kg" : null;
  return {
    prefix:aircraft.some(a=>a.prefix===row.prefix&&a.available!==false)?row.prefix!:"",
    date:row.date&&validDate(row.date)?row.date:"", departure:row.departure&&validClock(row.departure)?row.departure:"",
    destination:isScheduleValue(row.destination)?"":row.destination||"", duration:row.duration&&validClock(row.duration)&&row.duration!=="00:00"?row.duration:"",
    fuelAmount:unit&&row.fuelAmount&&/^\d+(?:\.\d+)?$/.test(row.fuelAmount)&&Number.isFinite(Number(row.fuelAmount))?row.fuelAmount:"",
    fuelUnit:unit||"L", commander:"",copilot:"",flightAttendant:"",repeat:false,weekdays:[] as number[],weekdayTimes:{} as Record<number,string>,
  };
}
export const flightImportSchema={type:"object",additionalProperties:false,properties:{reply:{type:"string"},flights:{type:"array",items:{type:"object",additionalProperties:false,properties:{...Object.fromEntries(importFields.map(key=>[key,{type:["string","null"]}])),notes:{type:"string"},rowId:{type:["string","null"]}},required:[...importFields,"notes","rowId"]}}},required:["reply","flights"]};
