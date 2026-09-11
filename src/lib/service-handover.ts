import {type TechnicalCase} from "./technical-case";
type HandoverItem={recordType:string;status:string;createdAt?:string;planningState?:string;revision:number;entries?:{kind:string;result?:string;at:string}[];technicalCase?:TechnicalCase};
export function handoverPending(item:HandoverItem){
 if(item.planningState==="excluded")return false;
 if(item.recordType!=="inspection")return item.status!=="closed"&&item.technicalCase?.investigation!=="closed";
 const latest=item.entries?.filter(e=>e.kind==="action").sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0];
 if(latest?.result==="nonconforming"&&item.status!=="closed")return true;
 return item.status!=="closed"&&item.planningState!=="completed";
}
export function handoverExpired(item:HandoverItem,now:number){
 const enteredAt=item.technicalCase?.serviceEnteredAt;
 const publishedAt=Date.parse(typeof enteredAt==="string"&&enteredAt?enteredAt:item.createdAt||"");
 if(!Number.isFinite(publishedAt)||now-publishedAt<24*60*60*1000)return false;
 const latest=item.entries?.filter(e=>e.kind==="action"&&e.result).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0];
 if(latest?.result==="nonconforming")return false;
 if(item.recordType==="inspection")return item.status==="closed"&&(item.planningState==="completed"||latest?.result==="satisfactory");
 return item.technicalCase?.investigation==="closed"&&item.technicalCase?.aircraft==="released"&&!item.technicalCase?.critical;
}
export function handoverVisible(item:HandoverItem,filter:string,seenRevision?:number,now=Date.now()){
 if(filter==="all")return true;
 if(item.planningState==="excluded")return false;
 if(handoverExpired(item,now))return false;
 const pending=handoverPending(item);
 return filter==="pending"?pending:pending||(seenRevision??-1)<item.revision;
}
