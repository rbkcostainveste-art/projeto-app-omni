const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync('src/lib/weather-decode.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};vm.runInNewContext(code,{exports:mod.exports});
const {decodeWeather}=mod.exports;
const text=r=>r.sections.flatMap(s=>s.fields.map(f=>f.text)).join(' ');

test('METAR brasileiro: unidades, bases das nuvens e chuva preservadas',()=>{
 const r=decodeWeather('METAR SBJR 091700Z 01007KT 7000 -RA FEW020 BKN040 OVC070 22/21 Q1017=','METAR');
 assert.equal(r.partial,false);assert.match(text(r),/010° verdadeiros, 7 nós/);assert.match(text(r),/7.000 m/);assert.match(text(r),/chuva · intensidade fraca/);assert.match(text(r),/4.000 pés acima do aeródromo/);assert.match(text(r),/22 °C \/ 21 °C/);assert.match(text(r),/1017 hPa/);
});
test('TAF mantém TEMPO e BECMG separados e preserva RMK',()=>{
 const r=decodeWeather('TAF SBJR 090801Z 0912/0924 13006KT 8000 SCT020 TX28/0917Z TN22/0924Z TEMPO 0912/0914 3500 BR FEW007 BKN016 BECMG 0918/0920 18005KT TEMPO 0920/0924 4000 BR BKN016 FEW030TCU RMK PGW=','TAF');
 assert.equal(r.sections.length,5);assert.equal(r.sections[1].title,'Variações temporárias');assert.equal(r.sections[2].title,'Mudança gradual');assert.match(r.sections[3].detail,/24:00 UTC/);assert.equal(r.sections[4].unknown[0],'PGW');assert.equal(r.partial,true);
 assert.match(text(r),/28 °C no dia 09 às 17:00/);
});
test('CAVOK não é céu sem nuvens; 9999 é limite inferior',()=>{
 const r=decodeWeather('METAR SBGL 091700Z VRB03KT CAVOK 25/18 Q1015=','METAR');
 assert.match(text(r),/10 km ou mais/);assert.match(text(r),/sem CB\/TCU/);assert.match(text(r),/5.000 pés/);
 assert.match(text(decodeWeather('TAF SBGL 091700Z 0918/1018 9999','TAF')),/10 km ou mais/);
});
test('FM e probabilidade temporária têm significados distintos',()=>{
 const r=decodeWeather('TAF SBGL 301700Z 3018/0118 00000KT 9999 FM010030 18015G25KT PROB30 TEMPO 0101/0104 2000 TSRA','TAF');
 assert.match(r.sections[1].detail,/Dia 01 às 00:30 UTC/);assert.match(r.sections[2].title,/30% · variações temporárias/);assert.match(r.sections[2].detail,/não contínuas/);assert.match(text(r),/rajadas de 25 nós/);
});
test('negativos, RVR, visibilidade vertical desconhecida e tendência',()=>{
 const r=decodeWeather('METAR SBGL 091700Z 18010KT 0000 R10/P1500U VV/// M02/M05 Q1000 TEMPO TL1800 2000=','METAR');
 assert.match(text(r),/Inferior a 50 m/);assert.match(text(r),/mais de 1.500 m; tendência de aumento/);assert.match(text(r),/não determinada/);assert.match(text(r),/−2 °C \/ −5 °C/);assert.match(text(r),/Até 18:00 UTC/);
});
test('códigos desconhecidos não desaparecem nem geram condição inventada',()=>{
 const r=decodeWeather('METAR SBGL 091700Z 9999 XYZ123 Q//// 99/XX RMK ALGUMA OBSERVACAO=','METAR');
 assert.equal(r.sections[0].unknown.join(' '),'XYZ123 Q//// 99/XX');assert.equal(r.sections[1].unknown.join(' '),'ALGUMA OBSERVACAO');assert.equal(r.partial,true);
});
test('visibilidade em milhas, boletim cancelado e falta de dados',()=>{
 assert.match(text(decodeWeather('METAR KJFK 091700Z 1 1/2SM M1/4SM','METAR')),/1,5 milhas terrestres Menos de 0,25/);
 assert.match(text(decodeWeather('TAF SBGL 091700Z CNL','TAF')),/cancelada/);
 assert.match(text(decodeWeather('METAR SBGL 091700Z NIL','METAR')),/não disponível/);
});
