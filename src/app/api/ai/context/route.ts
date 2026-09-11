import {resolveAssistantMedia} from "@/lib/assistant-upload-content";
import {technicalAssistantFields} from '@/lib/assistant-technical-fields';
import {assistantAccess} from "@/lib/assistant-access";
import {parseContextRequest, parseDraftAnswer,resolveDraftAircraft} from "@/lib/contextual-assistant";
import {runAssistantAgent} from "@/lib/assistant-agent";
import {assistantActor,assistantQuery} from "@/lib/assistant-queries";
import type {AssistantFormContext} from "@/lib/assistant-form";
import {searchTechnicalLibrary} from "@/lib/technical-library";
import {assistantRecordContext} from "@/lib/assistant-record-context";


export const runtime = "nodejs";
export const maxDuration = 120;
const json = (value: unknown, status = 200) => Response.json(value, {status, headers: {"Cache-Control": "no-store"}});

export async function POST(request: Request) {
  let access:Awaited<ReturnType<typeof assistantAccess>>;
  try { access=await assistantAccess(request); }
  catch { return json({error: "Sua sessão não permite usar o assistente. Entre novamente."}, 401); }
  let body;
  try {
    // Read incrementally, including requests without Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return json({error: "Pedido vazio."}, 400);
    const decoder = new TextDecoder(); let raw = "", bytes = 0;
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 2900000) {await reader.cancel(); return json({error: "Pedido acima do limite."}, 413);}
      raw += decoder.decode(chunk.value, {stream: true});
    }
    raw += decoder.decode(); body = parseContextRequest(JSON.parse(raw));
  } catch { return json({error: "Pedido inválido. Confira o texto e o rascunho."}, 400); }
  let media;
  try{media=await resolveAssistantMedia(access.client,body.attachments);}catch{return json({error:"Anexo indisponível ou inválido. Use imagens ou PDF, até 20 MB por arquivo e 40 MB por mensagem."},400);}
  let savedRecord;
  try { savedRecord = await assistantRecordContext(access.client, access.employee, body.context, request.signal); }
  catch (error) { return json({error: error instanceof Error ? error.message : "Registro indisponível."}, 409); }
  if (savedRecord) body.context = {...body.context, prefix: savedRecord.prefix, model: savedRecord.model};
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return json({error: "A IA precisa da chave OpenAI configurada no servidor."}, 503);
  try {
    const actor=await assistantActor(access.client,access.employee);
    const signal=AbortSignal.any([request.signal,AbortSignal.timeout(110000)]);
    const form:AssistantFormContext={id:body.context.id,label:`Relato técnico · ${body.context.prefix||'nova ocorrência'}`,mode:'draft',revision:body.context.record?.revision,fields:{...(body.context.fields.tc!==undefined?{tc:{label:'Número da TC informado',value:body.context.fields.tc,maxLength:100}}:{}),title:{label:'Título principal exibido no card; devolva a redação final corrigida no idioma solicitado',value:body.context.fields.title,maxLength:500},description:{label:'Texto principal exibido no relato: redação final corrigida no idioma solicitado; inclua ATA/referência aqui quando pedido. Somente fatos informados, sem presumir fase, causa ou teste',value:body.context.fields.description,maxLength:12000},...(!body.context.record&&body.context.aircraft?{prefix:{label:'Prefixo completo do catálogo',value:body.context.fields.prefix||body.context.prefix,options:['',...body.context.aircraft.map(a=>a.prefix)]}}:{})}};
    for(const [key,label] of technicalAssistantFields)if(body.context.fields.technical?.[key]!==undefined)form.fields[`technical_${key}`]={label,value:body.context.fields.technical[key],maxLength:12000};
    const result=await runAssistantAgent({apiKey,model:process.env.OPENAI_MODEL||'gpt-5.4-mini',message:body.message||'Preencha o relato com as informações legíveis dos anexos.',media,history:access.history||[],actor,context:{area:'Relato técnico',screen:{record:body.context.record,prefix:body.context.prefix,model:body.context.model}},verifiedRecord:savedRecord,form,navigationEnabled:request.headers.get('x-assistant-cards')==='1',signal,deps:{query:q=>assistantQuery(access.client,actor,q,signal),search:q=>searchTechnicalLibrary(q,5)}});
    console.info('assistant_context_tools',JSON.stringify(result.trace));
    const values=result.draftPatch?.values;
    const technical=Object.fromEntries(technicalAssistantFields.filter(([key])=>values?.[`technical_${key}`]!==undefined).map(([key])=>[key,values![`technical_${key}`]]));
    const answer=parseDraftAnswer({reply:result.reply,proposal:{...(Object.keys(technical).length?{technical}:{}),title:values?.title??null,description:values?.description??null,prefix:values?.prefix??null,...(body.context.fields.tc!==undefined?{tc:values?.tc??null}:{})}});
    if(body.context.record){answer.proposal.prefix=null;}
    else if(body.context.aircraft){
      const spoken=resolveDraftAircraft(body.message,body.context.aircraft);
      const matches=spoken.length?spoken:resolveDraftAircraft(answer.proposal.prefix||"",body.context.aircraft);
      const drafting=answer.proposal.title!==null||answer.proposal.description!==null||answer.proposal.prefix!==null;
      answer.proposal.prefix=drafting&&matches.length===1?matches[0].prefix:null;
      if(drafting&&matches.length>1)answer.reply='Encontrei mais de uma aeronave para esse prefixo. Qual delas você quer usar?';
    }else answer.proposal.prefix=null;
    return json({...answer, sources:result.sources,navigation:result.navigation,continuation:result.continuation, contextId: body.context.id});
  } catch(error) { const status=(error as {status?:number})?.status;return json({error:status===429?"Limite da IA atingido. Confira o saldo ou tente mais tarde.":"A consulta foi interrompida ou retornou dados inválidos. Seu rascunho foi preservado."},status===429?429:502); }
}
