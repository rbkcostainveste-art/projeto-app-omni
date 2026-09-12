const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function load(file,overrides={}){const mod={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(code,{exports:mod.exports,require,URL,URLSearchParams,Response,Request,AbortSignal,TextDecoder,Uint8Array,process,fetch,...overrides});return mod.exports;}
const ais=load('src/lib/aisweb.ts');
const rotaer='<aisweb><AeroCode>SBJR</AeroCode><name><![CDATA[Aeródromo de teste]]></name><dt>2026-09-10</dt><lat>-22.9875</lat><runways count="1"><runway><ident>03/21</ident><length>900</length><width>30</width><surface>ASPH</surface></runway></runways><services><service type="COM"><type>Torre</type><freqs><freq>118.050</freq><freq>121.900</freq></freqs></service></services><rmk><rmkText>OBS &amp; teste</rmkText></rmk></aisweb>';
const item=(type='NOTAMN',number='E0123/26',reference='')=>`<item><id>00123</id><n>${number}</n><tp>${type}</tp><state>ACTIVE</state><loc>SBJR</loc><ref>${reference}</ref><b>2601010000</b><c>PERM</c><d>DAILY 0800-2200</d><e><![CDATA[RWY CLSD\nTEST ONLY]]></e><f>SFC</f><g>500FT AMSL</g></item>`;
const notams=(items=item(),count=1)=>`<aisweb><notam total="${count}" updatedat="2026-09-12 19:30:00">${items}</notam></aisweb>`;
const sun='<aisweb><day><date>2026-09-12</date><aero>SBJR</aero><sunrise>08:52</sunrise><sunset>20:46</sunset></day><day><date>2026-09-13</date><aero>SBJR</aero><sunrise>08:51</sunrise><sunset>20:47</sunset></day></aisweb>';
const credentials={key:'secret-test-key',pass:'secret-test-pass'};
const mock=async url=>new Response(({rotaer,notam:notams(),sol:sun})[url.searchParams.get('area')]);

test('NOTAM preserves identifier, UTC groups, permanent validity and original multiline text',()=>{
 const result=ais.parseNotams(notams(),'SBJR');assert.equal(result.data[0].id,'00123');assert.equal(result.data[0].until,'PERM');assert.equal(result.data[0].from,'2601010000');assert.equal(result.data[0].text,'RWY CLSD\nTEST ONLY');assert.equal(result.data[0].schedule,'DAILY 0800-2200');
});
test('replacement and cancellation retain type and reference rather than appearing as new notices',()=>{
 const result=ais.parseNotams(notams(item('NOTAMR','E0124/26','E0123/26')+item('NOTAMC','E0125/26','E0124/26'),2),'SBJR');assert.equal(result.data[0].reference,'E0123/26');assert.equal(result.data[1].type,'NOTAMC');
});
test('empty NOTAM list is valid only with explicit zero total; incomplete or wrong-station responses fail',()=>{
 assert.equal(ais.parseNotams(notams('',0),'SBJR').data.length,0);
 for(const xml of ['<aisweb/>','<aisweb><notam/></aisweb>',notams(item(),2),notams().replace('<loc>SBJR','<loc>SBSP')])assert.throws(()=>ais.parseNotams(xml,'SBJR'));
});
test('ROTAER parses singleton runways, precise frequencies and escaped original observations',()=>{
 const result=ais.parseAerodrome(rotaer,'SBJR');assert.equal(result.data.name,'Aeródromo de teste');assert.equal(result.data.runways[0].identifier,'03/21');assert.equal(result.data.communications[0].frequencies[0],'118.050');assert.equal(result.data.remarks[0],'OBS & teste');assert.throws(()=>ais.parseAerodrome(rotaer,'SBSP'));
});
test('solar dates and UTC clocks stay associated with the requested locality and date',()=>{
 const result=ais.parseSun(sun,'SBJR','2026-09-12');assert.equal(result.data[0].sunrise,'08:52');assert.equal(result.data[1].date,'2026-09-13');assert.equal(ais.nextAisDate('2026-12-31'),'2027-01-01');assert.equal(ais.validAisDate('2026-02-30'),false);assert.throws(()=>ais.parseSun(sun,'SBSP','2026-09-12'));assert.throws(()=>ais.parseSun(sun,'SBJR','2026-09-13'));
});
test('HTML error pages, malformed XML and external entity declarations are rejected',()=>{
 for(const xml of ['<html>Unavailable</html>','<aisweb><bad></aisweb>','<!DOCTYPE aisweb [<!ENTITY a SYSTEM "file:///secret">]><aisweb>&a;</aisweb>','<aisweb><error>not authorized</error></aisweb>'])assert.throws(()=>ais.parseAisXml(xml));
});
test('current NOTAM lookup includes older active notices, avoids caching and follows no redirects',async()=>{
 const calls=[];const result=await ais.fetchAisweb('SBJR','2026-09-12',credentials,async(url,options)=>{calls.push({url,options});return mock(url);});
 assert.ok(result.notams.ok&&result.sun.ok&&result.aerodrome.ok);const call=calls.find(c=>c.url.searchParams.get('area')==='notam');assert.equal(call.url.origin,'https://api.decea.mil.br');assert.equal(call.url.searchParams.get('all'),'1');assert.ok(Number(call.url.searchParams.get('minutes'))>60*24*365);assert.equal(call.options.cache,'no-store');assert.equal(call.options.redirect,'error');assert.ok(!JSON.stringify(result).includes(credentials.key));
});
test('a failed NOTAM query cannot become zero notices or hide the other product results',async()=>{
 const result=await ais.fetchAisweb('SBJR','2026-09-12',credentials,async url=>url.searchParams.get('area')==='notam'?new Response('provider failure',{status:503}):mock(url));assert.equal(result.notams.ok,false);assert.ok(!('data' in result.notams));assert.equal(result.sun.ok,true);assert.equal(result.aerodrome.ok,true);
});
test('rate limits, authentication failures and reflected credentials never leak secret values',async()=>{
 const failed=await ais.fetchAisweb('SBJR','2026-09-12',credentials,async()=>new Response(credentials.key,{status:429}));assert.match(failed.notams.error,/Limite/);assert.ok(!JSON.stringify(failed).includes(credentials.key));
 const reflected=await ais.fetchAisweb('SBJR','2026-09-12',credentials,async url=>url.searchParams.get('area')==='notam'?new Response(notams().replace('TEST ONLY',credentials.pass)):mock(url));assert.ok(!JSON.stringify(reflected).includes(credentials.pass));
});
test('invalid inputs are rejected before any provider request',async()=>{
 let calls=0;await assert.rejects(()=>ais.fetchAisweb('SBJR&area=all','2026-09-12',credentials,async()=>{calls++;return mock(new URL('https://example.com'));}));assert.equal(calls,0);
});
test('AIS route validates the active session on server before accessing credentials or provider',async()=>{
 let authorized=false,calls=0;
 const env={NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'public-test',AISWEB_API_KEY:credentials.key,AISWEB_API_PASS:credentials.pass};
 const route=load('src/app/api/cockpit-ais/route.ts',{process:{env},require:name=>name==='@supabase/supabase-js'?{createClient:()=>({rpc:async()=>({error:authorized?null:{message:'denied'}})})}:{...ais,fetchAisweb:async()=>{calls++;return {aerodrome:{ok:true},notams:{ok:true},sun:{ok:true}};}}});
 assert.equal((await route.GET(new Request('https://app.test/api/cockpit-ais?station=SBJR'))).status,401);
 const request=()=>new Request('https://app.test/api/cockpit-ais?station=SBJR&date=2026-09-12',{headers:{Authorization:'Bearer fake-session'}});
 assert.equal((await route.GET(request())).status,401);assert.equal(calls,0);authorized=true;const response=await route.GET(request());assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(calls,1);
});
