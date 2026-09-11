import {latestWallUpdate} from './comment-attention';
import type {WallPost} from '@/components/operational-wall';

export function calendarDay(value: string | Date = new Date(), timeZone?: string) {
 const date = new Date(value);
 if (!Number.isFinite(date.getTime())) return '';
 const parts = new Intl.DateTimeFormat('en-CA', {year:'numeric',month:'2-digit',day:'2-digit', ...(timeZone?{timeZone}:{})}).formatToParts(date);
 return ['year','month','day'].map(type=>parts.find(p=>p.type===type)?.value).join('-');
}
export function isWallNotice(post:WallPost) {
 return ['Comunicado','Momento F.O.D','DDS','Avisos','Comunicados','Determinação'].includes(post.category) && !post.actions.length;
}
export function assignedToEmployee(assignedTo:string, employee:string, fleets:string[]) {
 const assigned=assignedTo.trim().toLowerCase();
 const assignees=assigned.split(',').map(value=>value.trim());
 return assignees.includes(employee.toLowerCase()) || assignees.includes(`mat. ${employee.toLowerCase()}`)
  || /\b(toda|todas|todos|equipe)\b/.test(assigned) || fleets.some(fleet=>assigned.includes(fleet.toLowerCase()));
}
/** Same event inclusion and date rules for the Mural and the assistant. */
export function wallTimeline(scoped:WallPost[], from:string, until=from, timeZone?:string) {
 return scoped.flatMap(post=>{
  if(post.technicalCase && (post.technicalCase.priority||post.priority)!=='urgent' && !post.technicalCase.critical)return [];
  const context=`${post.category} ${post.title} ${post.body}`.toLowerCase();
  if(post.category==='Procedimentos'||isWallNotice(post))return [];
  if(!(post.actions.length>0||['relato técnico','discrep','giro','manutenção','vibra'].some(word=>context.includes(word))))return [];
  const executions=post.actions.flatMap(action=>action.executions.map(entry=>({at:entry.at,actor:entry.employeeNumber,prefix:action.prefix,title:`${action.prefix} · ${entry.result==='satisfactory'?'Atividade concluída':'Atividade não conforme'}`,summary:entry.description})));
  if(post.maintenanceRecordId&&post.actions.length>0&&!executions.length)return [];
  const history=post.history.filter(entry=>['criou','resolveu','reabriu','relato técnico','discrep','giro','manutenção','registrou ação'].some(word=>entry.event.toLowerCase().includes(word))).map(entry=>({at:entry.at,actor:entry.employeeNumber,prefix:post.actions[0]?.prefix||'',title:entry.event,summary:entry.event.toLowerCase().includes('registrou ação')?`${entry.event}: ${post.maintenanceResultDescription??post.body}`:post.body}));
  const latest=[...(post.actions.length?[]:history),...executions].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0];
  const update=latestWallUpdate(post);
  const contentAt=update.kind==='Nova atualização'?undefined:update.at;
  const commentAt=post.comments.map(c=>c.at).sort().at(-1);
  return latest?[{id:post.id,post,...latest,activityAt:[latest.at,contentAt,commentAt].filter((at):at is string=>!!at).sort((a,b)=>Date.parse(b)-Date.parse(a))[0]}]:[];
 }).filter(item=>{const day=calendarDay(item.activityAt,timeZone);return (!from||day>=from)&&(!until||day<=until);}).sort((a,b)=>Date.parse(b.activityAt)-Date.parse(a.activityAt));
}
