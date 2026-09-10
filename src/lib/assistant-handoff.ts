import type {AssistantTargetRef} from './assistant-targets';
export type AssistantTransfer={conversationId:string;title:string;contextId:string;targetId:string;message?:string;nonce:string};
export type AssistantNavigation=(ref:AssistantTargetRef,conversation?:{conversationId:string;title:string;message?:string})=>Promise<void>;
/** Explicit destinations with an editor contract. Other cards still open normally. */
export function assistantHandoffContext(ref:AssistantTargetRef){
 if(ref.kind==='wall')return {contextId:`wall-comment:${ref.id}`,targetId:`form:wall-comment:${ref.id}`};
 if(ref.kind==='flight')return {contextId:`coordination:${ref.id}`,targetId:`form:coordination:${ref.id}`};
 if(ref.kind==='maintenance')return {contextId:`record:${ref.id}`,targetId:`record:${ref.id}`};
 if(ref.kind==='passage')return {contextId:`passage:${ref.id}`,targetId:`form:passage:${ref.id}`};
 if(ref.kind==='note')return {contextId:`note:${ref.id}`,targetId:`form:note:${ref.id}`};
 if(ref.kind==='cockpit')return {contextId:`cockpit:${ref.id}`,targetId:`form:cockpit:${ref.id}`};
 return null;
}
