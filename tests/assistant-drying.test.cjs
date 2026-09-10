const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript');
test('queue validates session, server identity, scope, filters, truncation and unavailable targets',async()=>{
 let allowed=false,role='mechanic',base='Macaé',identityEmployee='42',rows=[],dbError=null,filters=[],reads=0;
 const query={};for(const method of ['select','order','limit','eq','in'])query[method]=(...args)=>{filters.push([method,...args]);return query;};query.abortSignal=async()=>({data:rows,error:dbError});
 const client={rpc:async()=>({data:{employeeNumber:identityEmployee,accessProfile:role,assignedBase:base}}),from:()=>{reads++;return query;}};
 const exports={};new Function('exports','require',ts.transpileModule(fs.readFileSync('src/app/api/ai/drying/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,name=>{assert.equal(name,'@/lib/assistant-access');return {assistantAccess:async()=>{if(!allowed)throw Error('denied');return {client,employee:'42'};}};});
 const get=async(params='')=>{filters=[];return exports.GET(new Request('http://local/api/ai/drying'+params));};
 assert.equal((await get()).status,401);assert.equal(reads,0);allowed=true;
 assert.equal((await get('?model=bad')).status,400);assert.equal(reads,0);
 identityEmployee='forged';assert.equal((await get()).status,401);identityEmployee='42';
 base='';assert.equal((await get()).status,403);base='Macaé';
 let response=await get('?model=s92&base=Outra&role=admin');assert.equal(response.status,200);assert.ok(filters.some(f=>f[0]==='eq'&&f[1]==='base'&&f[2]==='Macaé'));assert.ok(filters.some(f=>f[0]==='in'&&f[1]==='model'));assert.equal(response.headers.get('cache-control'),'no-store');
 role='commander';await get();assert.ok(!filters.some(f=>f[1]==='base')); // Crew's dynamic base is enforced by existing RLS, not assignedBase.
 role='toolroom';assert.equal((await get()).status,403);
 role='coordination';rows=Array.from({length:101},(_,i)=>({id:String(i)}));response=await get();let body=await response.json();assert.equal(body.items.length,100);assert.equal(body.truncated,true);assert.match(body.notice,/não determina/);
 rows=[];assert.equal((await get('?id=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')).status,404);
 rows=[{id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',status:'completed'}];assert.equal((await get('?id=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')).status,200);assert.ok(!filters.some(f=>f[1]==='status'));
 dbError={message:'private detail'};response=await get();assert.equal(response.status,503);assert.ok(!(await response.text()).includes('private detail'));
});
