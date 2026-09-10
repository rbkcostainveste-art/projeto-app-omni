"use client";
import {createContext,useCallback,useContext,useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {Bot,X} from 'lucide-react';
import type {AssistantTransfer,AssistantNavigation} from '@/lib/assistant-handoff';

type Target={id:string;label:string;priority:number;element:HTMLElement;content:ReactNode;fallback?:(label:string)=>ReactNode};
type Workspace={register:(target:Target)=>()=>void;open:(targetId?:string)=>void;close:()=>void;screen:Record<string,unknown>|null;setScreen:(value:Record<string,unknown>|null)=>void;transfer:AssistantTransfer|null;beginTransfer:(value:AssistantTransfer)=>void;claimTransfer:(contextId:string,conversationId:string)=>string|null;setNavigator:(handler:AssistantNavigation|null)=>void;navigate:AssistantNavigation;navigationAvailable:()=>boolean};
const Context=createContext<Workspace|null>(null);
export function useAssistantWorkspace(){return useContext(Context);}
export function useAssistantNavigator(handler:AssistantNavigation){
 const setNavigator=useAssistantWorkspace()?.setNavigator;
 useLayoutEffect(()=>{setNavigator?.(handler);},[setNavigator,handler]);
 useEffect(()=>()=>setNavigator?.(null),[setNavigator]);
}
export function useAssistantContinuation(contextId:string|undefined,conversationId:string,ready:boolean,onMessage:(text:string)=>void){
 const workspace=useAssistantWorkspace(),claim=workspace?.claimTransfer,nonce=workspace?.transfer?.nonce;const callback=useRef(onMessage);
 useLayoutEffect(()=>{callback.current=onMessage;},[onMessage]);
 useEffect(()=>{if(!contextId||!ready||!claim)return;const timer=setTimeout(()=>{const message=claim(contextId,conversationId);if(message)callback.current(`Continue neste registro já aberto: ${message}`);},0);return()=>clearTimeout(timer);},[contextId,conversationId,ready,claim,nonce]);
}

export function useAssistantScreen(value:Record<string,unknown>){
 const workspace=useAssistantWorkspace(),setScreen=workspace?.setScreen;
 const serialized=JSON.stringify(value);
 useEffect(()=>{setScreen?.(JSON.parse(serialized));return()=>setScreen?.(null);},[setScreen,serialized]);
}

/** A field/card explicitly supplies its context. No input values are scraped from the page. */
export function AssistantTarget({id,label,revision,content,priority=10,fallback}:{id:string;label:string;revision:string;content:ReactNode;priority?:number;fallback?:(label:string)=>ReactNode}){
 const workspace=useAssistantWorkspace(),anchor=useRef<HTMLSpanElement>(null);
 const register=workspace?.register;
 useEffect(()=>{
  if(!register||!anchor.current)return;
  return register({id,label,priority,element:anchor.current,content,fallback});
  // The explicit revision covers the context and draft; ReactNode identity changes on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[register,id,label,priority,revision]);
 return <span ref={anchor} hidden data-assistant-target={id}/>;
}

export function AssistantWorkspaceProvider({children}:{children:ReactNode}){
 const [screen,setScreen]=useState<Record<string,unknown>|null>(null);
 const navigation=useRef<AssistantNavigation|null>(null);
 const setNavigator=useCallback((handler:AssistantNavigation|null)=>{navigation.current=handler;},[]);
 const navigate=useCallback<AssistantNavigation>(async(ref,conversation)=>{if(!navigation.current)throw Error('Navegação indisponível nesta tela.');await navigation.current(ref,conversation);},[]);
 const navigationAvailable=useCallback(()=>Boolean(navigation.current),[]);
 const [transfer,setTransfer]=useState<AssistantTransfer|null>(null);const transferRef=useRef<AssistantTransfer|null>(null);const claimed=useRef<string|null>(null);
 const [requestedId,setRequestedId]=useState<string|null>(null);
 const [suspended,setSuspended]=useState(false);
 const [targets,setTargets]=useState<Target[]>([]),[opened,setOpened]=useState(false),[host,setHost]=useState<HTMLElement|null>(null),[modalLabel,setModalLabel]=useState('');
 const register=useCallback((target:Target)=>{setTargets(old=>[...old.filter(t=>t.id!==target.id),target]);return()=>setTargets(old=>old.filter(t=>t!==target));},[]);
 const open=useCallback((targetId?:string)=>{setRequestedId(targetId||null);setOpened(true);},[]),close=useCallback(()=>{setOpened(false);setRequestedId(null);setTransfer(null);transferRef.current=null;},[]);
 const beginTransfer=useCallback((value:AssistantTransfer)=>{transferRef.current=value;claimed.current=null;setTransfer(value);setRequestedId(value.targetId);setOpened(false);},[]);
 const claimTransfer=useCallback((contextId:string,conversationId:string)=>{const value=transferRef.current;if(!value?.message||value.contextId!==contextId||value.conversationId!==conversationId||claimed.current===value.nonce)return null;claimed.current=value.nonce;return value.message;},[]);
 useEffect(()=>{
  const sync=()=>{const dialogs=Array.from(document.querySelectorAll<HTMLDialogElement>('dialog.app-modal-layer[open],dialog[data-assistant-layer][open]'));const top=dialogs.at(-1);const paused=Boolean(top?.querySelector('[data-assistant-suspend]'));setSuspended(paused);if(paused)return;setHost(top||document.body);setModalLabel(top?.querySelector('h2,h3')?.textContent?.slice(0,80)||'Janela aberta');};
  sync();const observer=new MutationObserver(sync);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});return()=>observer.disconnect();
 },[]);
 useEffect(()=>{if(!host||!opened)return;host.setAttribute('data-assistant-open','true');return()=>host.removeAttribute('data-assistant-open');},[host,opened]);
 const scoped=host?targets.filter(t=>t.element.isConnected&&host.contains(t.element)&&(host!==document.body||!t.element.closest('dialog.app-modal-layer,dialog[data-assistant-layer]'))):[];
 const active=scoped.find(t=>t.id===requestedId)||scoped.toSorted((a,b)=>a.priority-b.priority).at(-1);
 const transferReady=Boolean(transfer&&scoped.some(t=>t.id===transfer.targetId));
 useEffect(()=>{if(!transferReady)return;const timer=setTimeout(()=>setOpened(true),0);return()=>clearTimeout(timer);},[transferReady,transfer?.nonce]);
 const root=targets.find(t=>t.priority===0);
 const label=active?.label||(host?.tagName==='DIALOG'?modalLabel:root?.label);
 const content=active?.content||(root?.fallback&&label?root.fallback(label):null);
 const targetId=active?.id||`modal:${label}`;
 return <Context.Provider value={{register,open,close,screen,setScreen,transfer,beginTransfer,claimTransfer,setNavigator,navigate,navigationAvailable}}>{children}{host&&root?createPortal(<>
  {!opened&&!suspended?<button type="button" aria-label={`Abrir assistente IA · ${label}`} onClick={()=>open()} className="fixed bottom-24 right-4 z-[250] flex min-h-12 items-center gap-2 rounded-full bg-blue-700 px-4 text-sm font-bold text-white shadow-xl"><Bot size={22}/>IA</button>:null}
  {opened?<aside style={suspended?{display:"none"}:undefined} aria-label="Assistente da tela atual" className="fixed bottom-0 right-0 top-0 z-[250] flex w-full min-w-0 flex-col border-l bg-white shadow-2xl sm:bottom-4 sm:right-4 sm:top-4 sm:w-[440px] sm:rounded-2xl"><header className="flex shrink-0 items-center justify-between gap-2 border-b p-3"><div><b className="text-sm">Assistente IA</b><p className="text-xs text-slate-600">{label}</p></div><button aria-label="Fechar assistente" type="button" onClick={close} className="min-h-11 min-w-11"><X/></button></header><div key={targetId} className="flex min-h-0 flex-1 flex-col overflow-auto">{content}</div></aside>:null}
 </>,host):null}</Context.Provider>;
}
