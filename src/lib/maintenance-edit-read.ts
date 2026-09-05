import {newerThan,latestWallUpdate} from './comment-attention';
export type EditReceipt={edit_at?:string|null;content_at?:string|null};
export function unreadMaintenanceEdit(editedAt:string|undefined,receipt?:EditReceipt) {
 const seen=[receipt?.edit_at,receipt?.content_at].filter((v):v is string=>Boolean(v)).sort((a,b)=>Date.parse(b)-Date.parse(a))[0];
 return newerThan(editedAt,seen);
}
export function positionValue(value:string){return value.toLocaleUpperCase('pt-BR');}
export function latestUnreadMaintenanceUpdate(post:Parameters<typeof latestWallUpdate>[0],contentAt:string|undefined,isEditUnread:(at:string)=>boolean){
 const content=latestWallUpdate({...post,actions:post.actions.map(a=>({...a,editedAt:undefined}))});
 const updates=[...(newerThan(content.at,contentAt)?[content]:[]),...post.actions.flatMap(a=>a.editedAt&&isEditUnread(a.editedAt)?[{at:a.editedAt,kind:'Alteração'}]:[])];
 return updates.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0];
}
