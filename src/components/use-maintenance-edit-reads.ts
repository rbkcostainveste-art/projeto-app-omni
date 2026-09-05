"use client";
import {useCallback,useEffect,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {unreadMaintenanceEdit,type EditReceipt} from '@/lib/maintenance-edit-read';

export function useMaintenanceEditReads(supabase:SupabaseClient|null,identity:string,onError:(message:string)=>void,enabled=true) {
 const [receipts,setReceipts]=useState<{identity:string;rows:Record<string,EditReceipt>}>({identity,rows:{}});
 useEffect(()=>{
  if(!supabase||!enabled)return;
  let active=true;
  const load=async()=>{const{data,error}=await supabase.from('wall_read_receipts').select('post_id,content_at,edit_at');if(error){onError(error.message);return;}if(active)setReceipts({identity,rows:Object.fromEntries((data||[]).map(r=>[r.post_id,r]))});};
  const refresh=()=>void load();
  void load();const timer=window.setInterval(refresh,15000);
  window.addEventListener('maintenance-edit-read',refresh);window.addEventListener('focus',refresh);
  return()=>{active=false;window.clearInterval(timer);window.removeEventListener('maintenance-edit-read',refresh);window.removeEventListener('focus',refresh);};
 },[supabase,identity,onError,enabled]);
 const markEditRead=useCallback(async(postId?:string,editedAt?:string)=>{
  if(!supabase||!enabled||!postId||!editedAt)return;
  const{data,error}=await supabase.rpc('mark_maintenance_edit_read',{p_post_id:postId,p_edited_at:editedAt});
  if(error){onError(error.message);return;}
  if(data)setReceipts(current=>({identity,rows:{...(current.identity===identity?current.rows:{}),[postId]:{...(current.identity===identity?current.rows[postId]:{}),edit_at:data as string}}}));
  window.dispatchEvent(new Event('maintenance-edit-read'));
 },[supabase,identity,enabled,onError]);
 return {unreadEdit:(postId:string|undefined,editedAt:string|undefined)=>unreadMaintenanceEdit(editedAt,postId&&receipts.identity===identity?receipts.rows[postId]:undefined),markEditRead};
}
