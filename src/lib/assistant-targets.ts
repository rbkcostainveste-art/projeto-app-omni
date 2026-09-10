export type AssistantTargetRef={kind:'maintenance'|'drying'|'wall'|'activity'|'flight'|'passage'|'tool'|'cockpit';id:string};
export type AssistantRecordCard=AssistantTargetRef&{title:string;detail:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseTarget(value:unknown):AssistantTargetRef|null{
 if(!value||typeof value!=='object')return null;
 const item=value as Record<string,unknown>;
 const textId=item.kind==='wall'||item.kind==='activity'||item.kind==='flight'||item.kind==='passage'||item.kind==='cockpit';
 return (item.kind==='maintenance'||item.kind==='drying'||textId||item.kind==='tool')&&typeof item.id==='string'&&(textId?(item.kind==='cockpit'?/^[a-zA-Z0-9_:-]{1,160}$/:/^[a-zA-Z0-9_-]{1,160}$/).test(item.id):uuid.test(item.id))?{kind:item.kind as AssistantTargetRef['kind'],id:textId?item.id:item.id.toLowerCase()}:null;
}
/** The model only chooses identifiers. Labels and destinations come from authorized server results. */
export function appendTargetLinks(reply:string,chosen:unknown,available:AssistantRecordCard[]){
 const seen=new Set<string>();const cards:AssistantRecordCard[]=[];
 for(const item of Array.isArray(chosen)?chosen.slice(0,12):[]){const ref=parseTarget(item);if(!ref)continue;const key=`${ref.kind}:${ref.id}`;const card=available.find(c=>c.kind===ref.kind&&c.id===ref.id);if(card&&!seen.has(key)){cards.push(card);seen.add(key);}}
 // Never accept model-generated navigation markup, including identifiers not in the current result.
 const clean=reply.replace(/^\[[^\n]*\]\(flight-ia:\/\/[^\n]*\)\s*$/gim,'').trim();
 return [clean,...cards.map(c=>`[${`${c.title} · ${c.detail}`.replace(/[\[\]\r\n]/g,' ').slice(0,210)}](flight-ia://${c.kind}/${c.id})`)].join('\n\n');
}
/** Regular text stays literal; only the app's exact internal-link format becomes a card. */
export function splitTargetLinks(reply:string){
 const cards:(AssistantTargetRef&{label:string})[]=[];
 const text=reply.replace(/^\[([^\]\n]{1,220})\]\(flight-ia:\/\/(maintenance|drying|wall|activity|flight|passage|tool|cockpit)\/([a-zA-Z0-9_:-]{1,160})\)\s*$/gim,(whole,label,kind,id)=>{const ref=parseTarget({kind:kind.toLowerCase(),id});if(!ref)return whole;if(cards.length<12)cards.push({...ref,label});return '';}).trim();
 return {text,cards};
}
