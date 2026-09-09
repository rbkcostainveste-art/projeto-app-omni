// References: DECEA ICA 105-16; NWS TAF_Card; HKO decode_metar.
// Interpret only recognized groups. Never infer operational suitability or hide unknown text.
export type WeatherField = {code:string; label:string; text:string};
export type WeatherSection = {title:string; detail:string; fields:WeatherField[]; unknown:string[]};
export type DecodedWeather = {sections:WeatherSection[]; partial:boolean};
const num=(value:number)=>value.toLocaleString('pt-BR');
const temperature=(value:string)=>value.startsWith('M')?`−${Number(value.slice(1))}`:String(Number(value));
const dayHour=(value:string)=>Number(value.slice(0,2))>=1&&Number(value.slice(0,2))<=31&&Number(value.slice(2,4))<=24;
const period=(value:string)=>{
 const parts=value.split('/');
 return parts.length===2&&parts.every(p=>/^\d{4}$/.test(p)&&dayHour(p))?`Do dia ${parts[0].slice(0,2)} às ${parts[0].slice(2)}:00 até o dia ${parts[1].slice(0,2)} às ${parts[1].slice(2)}:00 UTC`:null;
};
const phenomena:Record<string,string>={DZ:'garoa',RA:'chuva',SN:'neve',SG:'grãos de neve',IC:'cristais de gelo',PL:'pelotas de gelo',GR:'granizo',GS:'granizo pequeno / grãos de neve',UP:'precipitação não identificada',BR:'névoa úmida',FG:'nevoeiro',FU:'fumaça',VA:'cinzas vulcânicas',DU:'poeira em suspensão',SA:'areia',HZ:'névoa seca',PY:'borrifo',PO:'redemoinhos de poeira ou areia',SQ:'rajadas súbitas',FC:'nuvem funil / tromba',SS:'tempestade de areia',DS:'tempestade de poeira'};
const descriptors:Record<string,string>={MI:'rasteiro',PR:'parcial',BC:'em bancos',DR:'levantado a pouca altura',BL:'levantado pelo vento',SH:'em pancadas',TS:'com trovoada',FZ:'congelante'};
function weather(code:string):string|null{
 let rest=code;const qualifiers:string[]=[];
 if(rest.startsWith('RE')){qualifiers.push('recente');rest=rest.slice(2);}
 if(rest[0]==='-'||rest[0]==='+'){qualifiers.push(rest[0]==='-'?'intensidade fraca':'intensidade forte');rest=rest.slice(1);}
 if(rest.startsWith('VC')){qualifiers.push('nas proximidades do aeródromo');rest=rest.slice(2);}
 const descriptor=descriptors[rest.slice(0,2)];
 if(descriptor)rest=rest.slice(2);
 if(!rest&&descriptor&&['TS','SH'].includes(code.replace(/^RE|^[+-]|^VC/g,'')))return [descriptor==='com trovoada'?'trovoada':'pancadas',...qualifiers].join(' · ');
 if(!rest||rest.length%2)return null;
 const names=rest.match(/../g)!.map(p=>phenomena[p]);
 if(names.some(n=>!n))return null;
 return [...names,descriptor,...qualifiers].filter(Boolean).join(' · ');
}
function decodeField(code:string):Omit<WeatherField,'code'>|null{
 let m:RegExpMatchArray|null;
 if((m=code.match(/^(\d{2})(\d{2})(\d{2})Z$/))&&Number(m[1])>=1&&Number(m[1])<=31&&Number(m[2])<24&&Number(m[3])<60)return {label:'Data e hora do boletim',text:`Dia ${m[1]}, ${m[2]}:${m[3]} UTC`};
 if((m=code.match(/^(\d{3}|VRB)(P?\d{2,3})(?:G(P?\d{2,3}))?(KT|MPS|KMH)$/))&&(m[1]==='VRB'||Number(m[1])<=360)){
  const unit=m[4]==='KT'?'nós':m[4]==='MPS'?'m/s':'km/h';const speed=(s:string)=>s.startsWith('P')?`mais de ${Number(s.slice(1))}`:String(Number(s));
  return {label:'Vento',text:code==='00000KT'?'Calmo':`${m[1]==='VRB'?'Direção variável':`De ${m[1]}° verdadeiros`}, ${speed(m[2])} ${unit}${m[3]?`; rajadas de ${speed(m[3])} ${unit}`:''}`};
 }
 if((m=code.match(/^(\d{3})V(\d{3})$/))&&Number(m[1])<=360&&Number(m[2])<=360)return {label:'Variação do vento',text:`Entre ${m[1]}° e ${m[2]}° verdadeiros`};
 if(/^\d{4}$/.test(code))return {label:'Visibilidade',text:code==='9999'?'10 km ou mais':code==='0000'?'Inferior a 50 m':`${num(Number(code))} m`};
 if((m=code.match(/^(\d{4})(N|NE|E|SE|S|SW|W|NW)$/)))return {label:'Visibilidade direcional',text:`${num(Number(m[1]))} m na direção ${m[2]}`};
 if((m=code.match(/^([PM]?)(\d+(?:\/\d+)?|\d+ \d+\/\d+)SM$/))){
  const fraction=m[2].split(' ');let value=0;
  for(const part of fraction){const [n,d]=part.split('/').map(Number);if(d===0)return null;value+=d?n/d:n;}
  return {label:'Visibilidade',text:`${m[1]==='P'?'Mais de ':m[1]==='M'?'Menos de ':''}${num(value)} milhas terrestres`};
 }
 if(code==='CAVOK')return {label:'Visibilidade e nuvens',text:'Visibilidade de 10 km ou mais; sem tempo significativo e sem CB/TCU; sem nuvens abaixo de 5.000 pés ou da maior altitude mínima de setor, prevalecendo o maior valor.'};
 if((m=code.match(/^(FEW|SCT|BKN|OVC)(\d{3}|\/\/\/)(CB|TCU)?$/))){
  const amounts:Record<string,string>={FEW:'Poucas nuvens (1–2 oitavos)',SCT:'Nuvens esparsas (3–4 oitavos)',BKN:'Céu fragmentado (5–7 oitavos)',OVC:'Encoberto (8 oitavos)'};
  return {label:'Nuvens',text:`${amounts[m[1]]}; ${m[2]==='///'?'base não informada':`base a ${num(Number(m[2])*100)} pés acima do aeródromo`}${m[3]?`; ${m[3]==='CB'?'cumulonimbus':'cumulus de grande desenvolvimento vertical'}`:''}`};
 }
 if((m=code.match(/^VV(\d{3}|\/\/\/)$/)))return {label:'Visibilidade vertical',text:m[1]==='///'?'Céu obscurecido; visibilidade vertical não determinada':`${num(Number(m[1])*100)} pés`};
 if(['NSC','NCD','SKC','CLR'].includes(code))return {label:'Nuvens',text:({NSC:'Sem nuvens significativas para a operação, conforme os critérios do código.',NCD:'Nenhuma nuvem detectada pelo sistema automático.',SKC:'Céu claro.',CLR:'Nenhuma nuvem detectada abaixo de 12.000 pés (código automático).'} as Record<string,string>)[code]};
 if((m=code.match(/^(M?\d{2}|\/\/)\/(M?\d{2}|\/\/)$/)))return {label:'Temperatura / ponto de orvalho',text:`${m[1]==='//'?'Não informada':`${temperature(m[1])} °C`} / ${m[2]==='//'?'não informado':`${temperature(m[2])} °C`}`};
 if((m=code.match(/^Q(\d{4})$/)))return {label:'QNH',text:`${Number(m[1])} hPa`};
 if((m=code.match(/^A(\d{4})$/)))return {label:'Ajuste altimétrico',text:`${num(Number(m[1])/100)} inHg`};
 if((m=code.match(/^T([XN])(M?\d{2})\/(\d{2})(\d{2})Z$/))&&dayHour(m[3]+m[4]))return {label:m[1]==='X'?'Temperatura máxima prevista':'Temperatura mínima prevista',text:`${temperature(m[2])} °C no dia ${m[3]} às ${m[4]}:00 UTC`};
 if((m=code.match(/^R(\d{2}[LCR]?)\/([MP]?\d{4})(?:V([MP]?\d{4}))?(FT)?([UDN])?$/))){
  const distance=(v:string)=>(v[0]==='M'?'menos de ':v[0]==='P'?'mais de ':'')+num(Number(v.replace(/^[MP]/,'')));
  return {label:`Alcance visual da pista ${m[1]} (RVR)`,text:`${distance(m[2])}${m[3]?` a ${distance(m[3])}`:''} ${m[4]?'pés':'m'}${m[5]?`; tendência ${({U:'de aumento',D:'de diminuição',N:'sem mudança significativa'} as Record<string,string>)[m[5]]}`:''}`};
 }
 if((m=code.match(/^(FM|TL|AT)(\d{2})(\d{2})$/))&&Number(m[2])<24&&Number(m[3])<60)return {label:'Horário da tendência',text:`${({FM:'A partir de',TL:'Até',AT:'Às'} as Record<string,string>)[m[1]]} ${m[2]}:${m[3]} UTC`};
 const flags:Record<string,string>={AUTO:'Observação automática.',COR:'Boletim corrigido.',AMD:'Previsão emendada.',CNL:'Previsão cancelada. Consulte o boletim vigente.',NIL:'Boletim não disponível.',NOSIG:'Sem mudanças significativas previstas nas próximas duas horas.',NSW:'Sem tempo significativo previsto.'};
 if(flags[code])return {label:'Informação',text:flags[code]};
 const wx=weather(code);return wx?{label:'Tempo',text:wx}:null;
}
export function decodeWeather(message:string,product:string):DecodedWeather{
 const tokens=message.trim().replace(/=\s*$/,'').split(/\s+/).filter(Boolean);
 const taf=product.toUpperCase()==='TAF'||tokens[0]==='TAF';
 const sections:WeatherSection[]=[{title:taf?'Condições iniciais previstas':'Observação do aeródromo',detail:'Horários em UTC. Alturas de nuvens em relação ao aeródromo.',fields:[],unknown:[]}];
 let section=sections[0];let stationSeen=false;
 for(let i=0;i<tokens.length;i++){
  let code=tokens[i];
  if(['METAR','SPECI','TAF'].includes(code))continue;
  if(!stationSeen&&/^[A-Z]{4}$/.test(code)&&!['AUTO','NOSIG','CAVOK','TEMPO','BECMG'].includes(code)){stationSeen=true;section.fields.push({code,label:'Aeródromo',text:code});continue;}
  if(code==='RMK'){section={title:'Observações do boletim',detail:'Observações complementares preservadas no código original, sem interpretação automática.',fields:[],unknown:tokens.slice(i+1)};sections.push(section);break;}
  if(['BECMG','TEMPO'].includes(code)||/^PROB(30|40)$/.test(code)||/^FM\d{6}$/.test(code)){
   const marker=code;let detail='';let title='';
   if(marker.startsWith('FM')){
    const value=marker.slice(2);if(!dayHour(value.slice(0,4))||Number(value.slice(2,4))>=24||Number(value.slice(4))>=60){section.unknown.push(code);continue;}
    title='Novas condições a partir de';detail=`Dia ${value.slice(0,2)} às ${value.slice(2,4)}:${value.slice(4)} UTC. Início de um novo período de previsão.`;
   }else{
    title=marker==='BECMG'?'Mudança gradual':marker==='TEMPO'?'Variações temporárias':`Probabilidade de ${marker.slice(4)}%`;
    if(marker.startsWith('PROB')&&tokens[i+1]==='TEMPO'){title+=' · variações temporárias';code+=' '+tokens[++i];}
    const range=period(tokens[i+1]||'');if(range){code+=' '+tokens[++i];detail=range+'. ';}
    detail+=marker==='BECMG'?'Mudanças esperadas durante esse intervalo; os elementos alterados prevalecem após a transição.':marker==='TEMPO'||code.includes('TEMPO')?'Condições temporárias, não contínuas durante todo o intervalo.':'Possibilidade das condições indicadas; não é uma certeza.';
   }
   section={title,detail,fields:[{code,label:'Grupo de previsão',text:code}],unknown:[]};sections.push(section);continue;
  }
  const range=period(code);
  if(range){section.fields.push({code,label:'Período de validade',text:range});continue;}
  if(/^\d+$/.test(code)&&/^\d+\/\d+SM$/.test(tokens[i+1]||''))code+=' '+tokens[++i];
  if(code==='WS'&&(/^(RWY\d{2}[LCR]?|ALL)$/.test(tokens[i+1]||''))){
   code+=' '+tokens[++i];if(tokens[i]==='ALL'&&tokens[i+1]==='RWY')code+=' '+tokens[++i];
   section.fields.push({code,label:'Cisalhamento do vento',text:code.includes('ALL RWY')?'Reportado em todas as pistas.':`Reportado na pista ${code.replace('WS RWY','')}.`});continue;
  }
  const field=decodeField(code);if(field)section.fields.push({code,...field});else section.unknown.push(code);
 }
 return {sections,partial:sections.some(s=>s.unknown.length>0)};
}
