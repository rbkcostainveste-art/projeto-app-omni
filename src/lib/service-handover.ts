import {type TechnicalCase} from "./technical-case";
type HandoverItem={recordType:string;status:string;planningState?:string;revision:number;entries?:{kind:string;result?:string;at:string}[];technicalCase?:TechnicalCase};
export function handoverPending(item:HandoverItem){
 if(item.planningState==="excluded")return false;
 if(item.recordType!=="inspection")return item.status!=="closed"&&item.technicalCase?.investigation!=="closed";
 const latest=item.entries?.filter(e=>e.kind==="action").sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0];
 if(latest?.result==="nonconforming"&&item.status!=="closed")return true;
 return item.status!=="closed"&&item.planningState!=="completed";
}
export function handoverVisible(item:HandoverItem,filter:string,seenRevision?:number){
 if(filter==="all")return true;
 if(item.planningState==="excluded")return false;
 const pending=handoverPending(item);
 return filter==="pending"?pending:pending||(seenRevision??-1)<item.revision;
}
