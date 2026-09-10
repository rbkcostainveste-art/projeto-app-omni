import type {AssistantTargetRef} from './assistant-targets';
export type AssistantTransfer={conversationId:string;title:string;contextId:string;targetId:string;message?:string;nonce:string};
/** Explicit destinations with an editor contract. Other cards still open normally. */
export function assistantHandoffContext(ref:AssistantTargetRef){
 if(ref.kind==='maintenance')return {contextId:`record:${ref.id}`,targetId:`record:${ref.id}`};
 if(ref.kind==='passage')return {contextId:`passage:${ref.id}`,targetId:`form:passage:${ref.id}`};
 if(ref.kind==='cockpit')return {contextId:`cockpit:${ref.id}`,targetId:`form:cockpit:${ref.id}`};
 return null;
}
