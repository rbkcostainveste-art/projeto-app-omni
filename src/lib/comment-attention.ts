export type CommentItem={id:string;employeeNumber:string;at:string;body:string};
export const roleLabels:Record<string,string>={maintenance_director:'Diretor de manutenção',maintenance_manager:'Gerente de manutenção',maintenance_coordinator:'Coordenador de manutenção',maintenance_leader:'Líder de manutenção',maintenance_inspector:'Inspetor',mechanic:'Mecânico',maintenance_assistant:'Auxiliar',coordination:'Coordenação'};
const ranks:Record<string,number>={maintenance_director:0,maintenance_manager:1,maintenance_coordinator:2,maintenance_leader:3,maintenance_inspector:5};
export function commentParticipants(comments:CommentItem[],roles:Record<string,string>,designator?:string){const latest=new Map<string,string>();for(const c of comments){if((latest.get(c.employeeNumber)||'')<c.at)latest.set(c.employeeNumber,c.at);}return [...latest.keys()].sort((a,b)=>{const rank=(id:string)=>id===designator?Math.min(ranks[roles[id]]??10,4):ranks[roles[id]]??10;return rank(a)-rank(b)||(latest.get(b)||'').localeCompare(latest.get(a)||'')||a.localeCompare(b);});}
type UpdatePost={createdAt:string;maintenanceResultAt?:string;history?:{event:string;at:string}[];actions:{editedAt?:string;executions:{at:string}[]}[]};
export function latestWallUpdate(post:UpdatePost){
 const events=[{at:post.createdAt,kind:'Nova atualização'},...(post.maintenanceResultAt?[{at:post.maintenanceResultAt,kind:'Novo resultado'}]:[]),...post.actions.flatMap(a=>[...(a.editedAt?[{at:a.editedAt,kind:'Alteração'}]:[]),...a.executions.map(e=>({at:e.at,kind:'Novo resultado'}))]),...(post.history||[]).filter(h=>h.event==='Editou a publicação'||h.event==='Adicionou mídia ao conteúdo oficial').map(h=>({at:h.at,kind:'Alteração'}))];
 return events.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0];
}
export function wallContentAt(post:UpdatePost){return latestWallUpdate(post).at;}
export function newerThan(at:string|undefined,seen:string|undefined|null){return Boolean(at)&&(!seen||Date.parse(at!)>Date.parse(seen));}
export function taskDesignator(entries:{kind:string;employeeNumber:string;at:string;wallPostId?:string}[]){return [...entries].filter(e=>e.kind==='assignment'&&e.wallPostId).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0]?.employeeNumber;}
