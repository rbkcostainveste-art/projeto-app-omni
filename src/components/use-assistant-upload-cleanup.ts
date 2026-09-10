"use client";
import {useEffect,useRef} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {AssistantAttachment} from '@/lib/contextual-assistant';
import {removeAssistantFiles} from '@/lib/assistant-uploads';
/** Temporary inputs belong to this composer, not the conversation archive. */
export function useAssistantUploadCleanup(client:SupabaseClient|null,files:AssistantAttachment[]){
 const latest=useRef(files);
 useEffect(()=>{latest.current=files;},[files]);
 useEffect(()=>()=>{void removeAssistantFiles(client,latest.current);},[client]);
}
