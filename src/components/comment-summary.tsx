"use client";

import {MessageCircle, Pin} from 'lucide-react';
import {UserAvatar,type UserDirectory} from './user-avatar';
import {commentParticipants,type CommentItem} from '@/lib/comment-attention';

export function CommentSummary({comments,directory,designator,pinnedId,newCount=0,onOpen}:{comments:CommentItem[];directory:UserDirectory;designator?:string;pinnedId?:string;newCount?:number;onOpen?:()=>void}) {
  if(!comments.length)return null;
  const ids=commentParticipants(comments,Object.fromEntries(Object.entries(directory).map(([id,p])=>[id,p.role||''])),designator);
  const pinned=comments.some(c=>c.id===pinnedId);
  return <button type="button" onClick={e=>{e.stopPropagation();onOpen?.();}}
    aria-label={`Abrir ${comments.length} comentário(s)${newCount?`, ${newCount} novo(s)`:''}`}
    title={`Comentários de ${ids.map(id=>directory[id]?.name||`Mat. ${id}`).join(', ')}`}
    className={`inline-flex min-h-10 max-w-full flex-wrap items-center gap-2 rounded-full px-2.5 py-1 text-xs font-bold ${newCount?'bg-amber-100 text-amber-900':'bg-slate-100 text-[#52677f]'}`}>
    <MessageCircle size={16} aria-hidden="true"/>
    <span>{comments.length}</span>
    <span className="flex -space-x-1">{ids.slice(0,5).map(id=><UserAvatar key={id} employeeNumber={id} directory={directory} size="sm"/>)}</span>
    {ids.length>5?<span>+{ids.length-5}</span>:null}
    {pinned?<Pin size={12} aria-label="Orientação fixada"/>:null}
    {newCount?<span className="rounded-full bg-amber-200 px-1.5 py-0.5">{newCount} novo(s)</span>:null}
  </button>;
}
