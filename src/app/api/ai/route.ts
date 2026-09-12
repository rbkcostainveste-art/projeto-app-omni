import {resolveAssistantMedia} from "@/lib/assistant-upload-content";
import {parseAssistantForm} from '@/lib/assistant-form';
import {assistantActor,assistantQuery} from '@/lib/assistant-queries';
import {runAssistantAgent} from '@/lib/assistant-agent';
import {calendarDay} from '@/lib/wall-selectors';
import {parseAssistantAttachments} from "@/lib/contextual-assistant";
import {searchTechnicalLibrary} from "@/lib/technical-library";
import { NextResponse } from "next/server";
import {assistantAccess} from "@/lib/assistant-access";

export const runtime = "nodejs";
export const maxDuration=120;

type RequestBody = { message?: string; image?: string; attachments?: unknown; context?: unknown };

export async function POST(request: Request) {
  let access:Awaited<ReturnType<typeof assistantAccess>>;
  try {
    access=await assistantAccess(request);
  } catch {
    return NextResponse.json({error: "Sua sessão não permite usar o assistente. Entre novamente."}, {status: 401, headers: {"Cache-Control": "no-store"}});
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "A IA ainda precisa da chave OPENAI_API_KEY na Vercel." }, { status: 503 });

  let body:RequestBody,media:Record<string,unknown>[];
  try {const raw=await request.text();if(raw.length>2900000)return NextResponse.json({error:'Pedido acima do limite.'},{status:413});body=JSON.parse(raw);if(body.message!==undefined&&(typeof body.message!=="string"||body.message.length>8000))throw Error("Invalid message");media=await resolveAssistantMedia(access.client,parseAssistantAttachments(body.attachments??(body.image?[{name:body.image.startsWith('data:application/pdf')?'documento.pdf':'imagem',data:body.image}]:[])));}catch{return NextResponse.json({error:'Envie texto, imagem ou PDF válido. Confira os anexos e tente novamente.'},{status:400});}
  if (!body.message?.trim() && !media.length) return NextResponse.json({ error: "Envie uma pergunta, comando ou fotografia." }, { status: 400 });

  try {
    const actor=await assistantActor(access.client,access.employee);
    const raw=body.context&&typeof body.context==='object'?body.context as Record<string,unknown>:{};
    const timeZone=typeof raw.timeZone==='string'&&raw.timeZone.length<80?raw.timeZone:'America/Sao_Paulo';
    try { new Intl.DateTimeFormat('pt-BR',{timeZone}); } catch { return NextResponse.json({error:'Fuso horário inválido.'},{status:400}); }
    const context={area:typeof raw.area==='string'?raw.area.slice(0,120):'',screen:raw.screen&&JSON.stringify(raw.screen).length<12000?raw.screen:null,timeZone,today:calendarDay(new Date(),timeZone)};
    const form=parseAssistantForm(raw.form);
    const allowFlightCreation=Boolean((raw.capabilities as {createFlights?:boolean}|undefined)?.createFlights)&&['admin','app_manager','coordination','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector','mechanic'].includes(actor.accessProfile);
    const allowServiceCreation=['admin','app_manager','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector'].includes(actor.accessProfile);
    const signal=AbortSignal.any([request.signal,AbortSignal.timeout(110000)]);
    const result=await runAssistantAgent({allowFlightCreation,allowServiceCreation,form,apiKey,model:process.env.OPENAI_MODEL||'gpt-5.4-mini',message:body.message||'',media,history:access.history,actor,context,navigationEnabled:request.headers.get('x-assistant-cards')==='1',signal,deps:{query:q=>assistantQuery(access.client,actor,q,signal,timeZone),search:query=>searchTechnicalLibrary(query,5)}});
    console.info('assistant_tools',JSON.stringify(result.trace));
    return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
  }catch{return NextResponse.json({error:'A consulta não foi concluída. Seu texto foi preservado para tentar novamente.'},{status:502,headers:{'Cache-Control':'no-store'}});}
}
