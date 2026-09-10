const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const exports_={};new Function('exports',ts.transpileModule(fs.readFileSync('src/lib/operational-assignment.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(exports_);
test('coordination keeps its base while discarding obsolete fleet, mission and shift',()=>{
 const original={profile:'coordination',assignedBase:'Macaé',fleets:['S92'],mission:'mission_1',workShift:'night'};
 assert.deepEqual(exports_.normalizeOperationalAssignment(original),{...original,fleets:[],mission:'',workShift:''});assert.deepEqual(original.fleets,['S92']);
});
test('other roles retain their applicable operational assignments',()=>{
 for(const profile of ['mechanic','maintenance_inspector','commander','toolroom','dispatch']){const item={profile,assignedBase:'QA',fleets:['S92'],mission:'mission_1',workShift:'day'};assert.deepEqual(exports_.normalizeOperationalAssignment(item),item);}
});
