"use client";
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
export const DesktopWorkspaceContext=createContext(false);
export function DesktopControls({children}:{children:ReactNode}){const enabled=useContext(DesktopWorkspaceContext);const [target,setTarget]=useState<HTMLElement|null>(null);useEffect(()=>{const query=window.matchMedia('(min-width: 1100px)');const update=()=>setTarget(enabled&&query.matches?document.getElementById('desktop-workspace-controls'):null);const timer=setTimeout(update,0);query.addEventListener('change',update);return()=>{clearTimeout(timer);query.removeEventListener('change',update);};},[enabled]);return target?createPortal(<div className="desktop-control-block">{children}</div>,target):<>{children}</>;}
export function DesktopControlHost(){useEffect(()=>{const root=document.querySelector<HTMLElement>('.split-workspace');const header=root?.querySelector('header');if(!root||!header)return;const observer=new ResizeObserver(()=>root.style.setProperty('--workspace-header-height',`${header.getBoundingClientRect().height}px`));observer.observe(header);return()=>observer.disconnect();},[]);return <aside id="desktop-workspace-controls" aria-label="Controles da área de trabalho"/>;}

export const WorkspaceToolsContext=createContext<ReactNode>(null);
export function DesktopActions({children}:{children?:ReactNode}){const tools=useContext(WorkspaceToolsContext);return <DesktopControls><div className="workspace-actions mb-4 flex items-center gap-2 min-[1100px]:mb-0">{children}{tools}</div></DesktopControls>;}
