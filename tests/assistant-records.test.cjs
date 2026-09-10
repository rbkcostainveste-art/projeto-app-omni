const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const lib={};new Function('exports',ts.transpileModule(fs.readFileSync('src/lib/assistant-records.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(lib);
test('operational context distinguishes unavailable, unauthorized, empty and partial; uses server base',async()=>{
 let role='mechanic',base='Macaé',rows=[{prefix:'PR-CHT',title:'Relato aberto'}],error=null,filters=[];
 const query={};for(const method of ['select','eq','in','order','limit'])query[method]=(...args)=>{filters.push([method,...args]);return query;};query.abortSignal=async()=>({data:rows,error});
 const client={rpc:async()=>({data:{employeeNumber:'42',accessProfile:role,assignedBase:base}}),from:()=>query};
 const read=()=>lib.assistantRecords(client,'42',new AbortController().signal);
 let result=await read();assert.equal(result.status,'available');assert.equal(result.records[0].prefix,'PR-CHT');assert.ok(filters.some(f=>f[0]==='eq'&&f[1]==='base'&&f[2]==='Macaé'));
 base='';assert.equal((await read()).status,'unavailable');base='Macaé';role='toolroom';assert.equal((await read()).status,'not_authorized');
 role='mechanic';rows=[];result=await read();assert.equal(result.status,'available');assert.equal(result.complete,true);
 rows=Array.from({length:101},()=>({prefix:'PR-CHT'}));result=await read();assert.equal(result.complete,false);assert.equal(result.records.length,100);
 error={message:'private failure'};result=await read();assert.equal(result.status,'unavailable');assert.ok(!JSON.stringify(result).includes('private failure'));
});
