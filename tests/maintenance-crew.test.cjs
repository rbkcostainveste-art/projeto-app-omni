const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const lib={};new Function('exports',ts.transpileModule(fs.readFileSync('src/lib/maintenance-crew.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(lib);
const roster=[
 {employee_number:'P1',display_name:'Piloto',access_profile:'commander',fleets:['AW139','S92'],active:true,assigned_base:null},
 {employee_number:'P2',display_name:'Copiloto',access_profile:'copilot',fleets:['S92'],active:true,assigned_base:null},
 {employee_number:'P3',display_name:'Outra frota',access_profile:'commander',fleets:['AW139'],active:true},
 {employee_number:'M1',display_name:'Mecânico',access_profile:'mechanic',fleets:['S92'],active:true},
 {employee_number:'P4',display_name:'Inativo',access_profile:'copilot',fleets:['S92'],active:false},
];
test('S92 roster includes both crew roles even without a fixed base and excludes other fleets, roles and inactive users',()=>{
 const options=lib.maintenanceCrewOptions(roster,'S92');assert.deepEqual(options.map(p=>p.employeeNumber).sort(),['P1','P2']);
 assert.equal(options.find(p=>p.employeeNumber==='P1').profile,'commander');
 assert.deepEqual(lib.maintenanceCrewOptions(roster,'S-92'),options);
});
test('other models use their own roster; missing fleet is not treated as authorization for all aircraft',()=>{
 assert.deepEqual(lib.maintenanceCrewOptions(roster,'AW139').map(p=>p.employeeNumber).sort(),['P1','P3']);
 assert.deepEqual(lib.maintenanceCrewOptions(roster,''),[]);
 assert.deepEqual(lib.maintenanceCrewOptions([{...roster[0],fleets:null}],'S92'),[]);
});
