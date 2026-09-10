const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const mod={};new Function('exports',ts.transpileModule(fs.readFileSync('src/lib/preparation-display.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(mod);
test('preparation reasons describe blockers without inventing a record title',()=>{
 assert.equal(mod.preparationBlockerText({reasons:['evaluation']}),'Aguardando avaliação técnica');
 assert.equal(mod.preparationBlockerText({title:'Altímetro',reasons:['evaluation','evaluation']}),'Altímetro · Aguardando avaliação técnica');
 assert.match(mod.preparationBlockerText({reasons:['deferral_expired','test_failed']}),/Prazo do diferimento vencido; Teste com resultado não satisfatório/);
 assert.equal(mod.preparationBlockerText({reasons:['unexpected']}),'Pendência técnica requer avaliação');
});
test('pending checks use the applicable first-flight or between-flight name',()=>{
 assert.equal(mod.pendingPreparationChecks({pending:['inspection','fuel'],checklist:{first:true}}),'pré-voo, abastecimento');
 assert.equal(mod.pendingPreparationChecks({pending:['inspection'],checklist:{first:false}}),'inspeção entre voos');
});
