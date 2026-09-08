import {createClient} from '@supabase/supabase-js';
export async function assistantAccess(request:Request){
 const token=request.headers.get('authorization'),employee=request.headers.get('x-employee');
 if(!token?.startsWith('Bearer ')||!employee)throw Error('Entre novamente para usar o assistente.');
 const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL||'https://ecdhhfyobalpswojaklv.supabase.co',process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_dEz7yx8Uoe9AEAa3PHQFZQ_n5PYGGzs',{global:{headers:{Authorization:token}},auth:{persistSession:false}});
 const {data,error}=await client.rpc('personal_assistant',{p_action:'list',p_payload:{employee}});
 if(error)throw Error('Sua sessão não permite usar o assistente. Entre novamente.');
 return {history:(data as {message:string;reply:string}[]).slice(-6)};
}
