const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const lib={};new Function('exports',ts.transpileModule(fs.readFileSync('src/lib/maintenance-crew.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(lib);
const roster=[
 {employee_number:'P1',display_name:'Piloto',access_profile:'commander',fleets:['AW139','S92'],active:true,assigned_base:'QA'},
 {employee_number:'P2',display_name:'Copiloto',access_profile:'copilot',fleets:['S92'],active:true,assigned_base:'QA'},
 {employee_number:'P3',display_name:'Outra frota',access_profile:'commander',fleets:['AW139'],active:true,assigned_base:'QA'},
 {employee_number:'M1',display_name:'Mecânico',access_profile:'mechanic',fleets:['S92'],active:true,assigned_base:'QA'},
 {employee_number:'P4',display_name:'Inativo',access_profile:'copilot',fleets:['S92'],active:false,assigned_base:'QA'},
];
test('S92 roster includes both crew roles at the aircraft base and excludes other fleets, roles and inactive users',()=>{
 const options=lib.maintenanceCrewOptions(roster,'S92','QA');assert.deepEqual(options.map(p=>p.employeeNumber).sort(),['P1','P2']);
 assert.equal(options.find(p=>p.employeeNumber==='P1').profile,'commander');
 assert.deepEqual(lib.maintenanceCrewOptions(roster,'S-92','QA'),options);
});
test('other models use their own roster; missing fleet is not treated as authorization for all aircraft',()=>{
 assert.deepEqual(lib.maintenanceCrewOptions(roster,'AW139','QA').map(p=>p.employeeNumber).sort(),['P1','P3']);
 assert.deepEqual(lib.maintenanceCrewOptions(roster,'','QA'),[]);
 assert.deepEqual(lib.maintenanceCrewOptions([{...roster[0],fleets:null}],'S92','QA'),[]);
});

test('crew must move bases before appearing in another base roster',()=>{assert.deepEqual(lib.maintenanceCrewOptions(roster,'S92','Other'),[]);const moved=roster.map(p=>p.employee_number==='P1'?{...p,assigned_base:'Other'}:p);assert.deepEqual(lib.maintenanceCrewOptions(moved,'S92','Other').map(p=>p.employeeNumber),['P1']);});
test('normal flight crew uses the same base and fleet restrictions',()=>{const people=roster.map(p=>({assignedBase:p.assigned_base,fleets:p.fleets,active:p.active,id:p.employee_number}));assert.deepEqual(lib.crewAtBaseAndFleet(people,'QA','S92').map(p=>p.id).sort(),['M1','P1','P2']);assert.deepEqual(lib.crewAtBaseAndFleet(people,'Other','S92'),[]);});
