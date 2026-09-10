const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
test('assistant access scopes history by explicit conversation and uses no history when no conversation is selected',async()=>{
 const exports={};let calls=[];
 const a='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',b='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
 const client={rpc:async(name,args)=>{calls.push(args);return args.p_payload.conversationId===b?{error:{message:'private'}}:{data:args.p_action==='access'?[]:[{message:'Only A',reply:'A'}]};}};
 new Function('exports','require',ts.transpileModule(fs.readFileSync('src/lib/assistant-access.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,name=>{assert.equal(name,'@supabase/supabase-js');return {createClient:()=>client};});
 const req=id=>new Request('http://local',{headers:{Authorization:'Bearer synthetic','x-employee':'42',...(id?{'x-conversation-id':id}:{})}});
 assert.deepEqual((await exports.assistantAccess(req())).history,[]);assert.equal(calls[0].p_action,'access');
 assert.equal((await exports.assistantAccess(req(a))).history[0].message,'Only A');assert.equal(calls[1].p_payload.conversationId,a);
 await assert.rejects(()=>exports.assistantAccess(req(b)));await assert.rejects(()=>exports.assistantAccess(req('not-a-uuid')));assert.equal(calls.length,3);
});
