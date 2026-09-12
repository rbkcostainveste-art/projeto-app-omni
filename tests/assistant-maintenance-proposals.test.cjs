const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(file){const exports={};new Function('exports','require',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,require);return exports;}
const proposals=load('src/lib/assistant-maintenance-proposals.ts');
const assignments=load('src/lib/assignment-filter.ts');

test('technical record proposal preserves missing TC and enforces direct-fault permission',()=>{
 const report=proposals.parseTechnicalRecordProposal({kind:'report',prefix:'pr-cht',title:'Luz',description:'Intermitente',tc:null,officialId:null,urgency:null},false);
 assert.equal(report.prefix,'PR-CHT');assert.equal(report.tc,null);
 assert.throws(()=>proposals.parseTechnicalRecordProposal({...report,kind:'fault'},false));
 assert.equal(proposals.parseTechnicalRecordProposal({...report,kind:'fault',tc:'TC-123'},true).tc,'TC-123');
});

test('maintenance action requires a real internal record id',()=>{
 assert.throws(()=>proposals.parseMaintenanceActionProposal({recordId:'PR-CHT',prefix:'PR-CHT',title:'Inspecionar',tc:null,category:null}));
 assert.equal(proposals.parseMaintenanceActionProposal({recordId:'11111111-1111-4111-8111-111111111111',prefix:'pr-cht',title:'Inspecionar',tc:null,category:'Giro em baixa'}).prefix,'PR-CHT');
});

test('assignment combines fleet, mission, shift and normalized name or employee number',()=>{
 const people=[{employeeNumber:'04059',displayName:'João Mecânico',profile:'mechanic',assignedBase:'Jacarepaguá',fleets:['S92'],mission:'mission_2',workShift:'night'},{employeeNumber:'99',displayName:'Outra Pessoa',profile:'mechanic',assignedBase:'Jacarepaguá',fleets:['AW139'],mission:'mission_1',workShift:'day'}];
 assert.deepEqual(assignments.filterAssignmentPeople(people,{fleet:'S92',mission:'mission_2',shift:'night',search:'joao mecanico'}).map(person=>person.employeeNumber),['04059']);
 assert.deepEqual(assignments.filterAssignmentPeople(people,{search:'04.059'}).map(person=>person.employeeNumber),['04059']);
});
