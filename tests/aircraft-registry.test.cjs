const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync('src/lib/aircraft-registry.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};vm.runInNewContext(code,{exports:mod.exports});
const {importAircraftRegistry,registryModelMatches}=mod.exports;

test('importação preserva base, modelo divergente, disponibilidade e campos existentes',()=>{
 const original=[{prefix:'PR-OOR',model:'AW139',base:'Jacarepaguá',available:false,unavailabilityReason:'Inspeção',custom:{value:1}}];
 const next=importAircraftRegistry(original,'0001','2026-09-09T20:00:00Z');
 assert.equal(next.length,1);
 assert.equal(next[0].model,'AW139');assert.equal(next[0].base,'Jacarepaguá');
 assert.equal(next[0].available,false);assert.equal(next[0].unavailabilityReason,'Inspeção');
 assert.equal(next[0].custom,original[0].custom);assert.equal(original[0].registryData,undefined);
 assert.equal(next[0].registryData.registeredModel,'AW189');assert.equal(next[0].registryData.serialNumber,'89022');
 assert.equal(next[0].registryData.reviewStatus,'pending');assert.equal(next[0].registryData.importedBy,'0001');
});

test('não duplica aeronaves, não importa ausentes e não sobrescreve registro técnico',()=>{
 const original=[{prefix:'pr-ohk',registryData:{serialNumber:'registro existente'}},{prefix:'PP-XXX'},{prefix:'PROHD'}];
 const next=importAircraftRegistry(original,'0001','agora');
 assert.equal(next.length,3);assert.equal(next[0],original[0]);assert.equal(next[1],original[1]);
 assert.equal(next[2].registryData.serialNumber,'41306');
 const again=importAircraftRegistry(next,'0002','depois');
 next.forEach((entry,i)=>assert.equal(again[i],entry));
});

test('reconhece S92 como família S-92A sem esconder divergência AW139/AW189',()=>{
 assert.equal(registryModelMatches('S92','S-92A'),true);
 assert.equal(registryModelMatches('AW139','AW189'),false);
 assert.equal(registryModelMatches('AW139','AW139'),true);
});
