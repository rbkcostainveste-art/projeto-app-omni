const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');const lib={};new Function('exports','require',ts.transpileModule(fs.readFileSync('src/lib/service-import.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(lib,()=>({parseAssistantAttachments:a=>a}));
test('service import preserves WO task and unknown TC instead of inventing NA',()=>{const a=lib.parseServiceImportAnswer({reply:'Confira',services:[{prefix:'pr-ohi',title:'Auditoria',description:'21D inspection',tc:'260394-1197',notes:''},{prefix:null,title:'Inspeção',description:'Teste',tc:null,notes:'TC ausente'}]});assert.equal(a.services[0].tc,'260394-1197');assert.equal(a.services[0].prefix,'PR-OHI');assert.equal(a.services[1].tc,'');assert.equal(a.services[1].prefix,'');});
test('rejects invalid data and oversized imports',()=>{assert.throws(()=>lib.parseServiceImportAnswer({reply:'',services:Array(101).fill({})}));assert.throws(()=>lib.parseServiceImportRequest({message:''}));assert.throws(()=>lib.parseServiceImportAnswer({reply:'',services:[{prefix:123}]}));});
test('Maintenance Forecast keeps Task Check separate from the labelled WO Task',()=>{
 const result=lib.parseServiceImportExtraction({reply:'Confira',services:[
  {prefix:'PR-OHI',taskReference:'2511-001',title:'12M - Inspection Life vest',description:'12M inspection',woTask:null,notes:null},
  {prefix:'PR-OHI',taskReference:'Audit-S92A',title:'Airframe',description:'21D audit',woTask:'260394-1197',notes:''}
 ]});
 assert.equal(result.services[0].tc,'');
 assert.match(result.services[0].notes,/Task\/Check: 2511-001/);
 assert.equal(result.services[1].tc,'260394-1197');
 assert.match(result.services[1].notes,/Audit-S92A/);
});
test('service proposal parser accepts only the extraction contract',()=>{
 assert.throws(()=>lib.parseServiceProposalArgs({services:[{prefix:'PR-OHI',title:'Wrong',description:'Wrong',tc:'2511-001'}]}));
 assert.equal(lib.serviceProposalTool.name,'preparar_servicos');
 assert.match(lib.serviceImportInstructions,/identificador nunca é TC/i);
});
