export type PreparationBlocker={title?:string;ticketCode?:string;reasons:string[]};
export type PreparationState={status:'ready'|'reconfirm'|'pending'|'inactive';automatic?:boolean;canConfirm:boolean;pending:string[];blocked:boolean;actor?:string;at?:string;reason?:string;fingerprint?:string;checklist?:{total:number;approved:number;first:boolean};blockers?:PreparationBlocker[];blockerCount?:number};
const reasons:Record<string,string>={evaluation:'Aguardando avaliação técnica',unavailable:'Aeronave registrada como indisponível',maintenance:'Aeronave registrada em manutenção',critical:'Alerta crítico requer avaliação',test_failed:'Teste com resultado não satisfatório',disposition_pending:'Discrepância sem disposição técnica válida',deferral_expired:'Prazo do diferimento vencido'};
export function preparationBlockerText(blocker:PreparationBlocker){
 const detail=[...new Set(blocker.reasons.map(reason=>reasons[reason]||'Pendência técnica requer avaliação'))].join('; ');
 return [blocker.title,detail||'Pendência técnica requer avaliação'].filter(Boolean).join(' · ');
}
export function pendingPreparationChecks(value:PreparationState){
 const labels:Record<string,string>={drain:'dreno de combustível',fuel:'abastecimento',inspection:value.checklist?.first===false?'inspeção entre voos':'pré-voo',hums:'HUMS'};
 return value.pending.map(key=>labels[key]||'verificação de manutenção').join(', ');
}
