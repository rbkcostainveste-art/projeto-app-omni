"use client";

// Interactive vector silhouettes for the demo drawers; real photographs keep their hotspots.
export function ToolSilhouette({name}:{name:string}) {
 const n=name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 let shape;
 if(n.includes("alicate")) shape=<><path d={n.includes("bico")?"M54 81 L44 14 L57 65 L60 77 L63 65 L76 14 L66 81":"M54 80 L31 38 L36 20 L51 40 L60 67 L69 40 L84 20 L89 38 L66 80"} fill="#c4d3df"/><circle cx="60" cy="83" r="12" fill="#8498aa"/><circle cx="60" cy="83" r="4" fill="#263744"/><path d="M53 92 Q35 125 30 162 M67 92 Q85 125 90 162" fill="none" stroke="#de4642" strokeWidth="15" strokeLinecap="round"/></>;
 else if(n.includes("soquete")) shape=<><rect x="32" y="47" width="56" height="94" rx="13" fill="#a8bbc9"/><path d="M34 82H86M34 124H86" stroke="#5e7488" strokeWidth="5"/><ellipse cx="60" cy="48" rx="28" ry="18" fill="#dae4eb"/><path d="M47 38 L62 32 L76 41 L75 56 L59 64 L45 55Z" fill="#233846"/><path d="M43 91V115M77 91V115" stroke="#e5eef4" strokeWidth="5"/></>;
 else if(n.includes("fenda")||n.includes("phillips")) shape=<><path d="M57 20H63V109H57Z" fill="#cbd8e2"/><path d={n.includes("phillips")?"M60 7V25M53 16H67":"M55 8H65L63 25H57Z"} stroke="#d3dfe7" strokeWidth="4"/><rect x="44" y="102" width="32" height="65" rx="12" fill={n.includes("phillips")?"#e45942":"#e5ad28"}/><path d="M53 115V153M67 115V153" stroke="#253846" strokeWidth="5"/></>;
 else if(n.includes("allen")) shape=<path d="M42 17V153H88" fill="none" stroke="#bfccd6" strokeWidth="13" strokeLinejoin="round"/>;
 else if(n.includes("catraca")) shape=<><rect x="52" y="51" width="16" height="102" rx="7" fill="#b1c2cf"/><rect x="47" y="116" width="26" height="52" rx="10" fill="#394f61"/><ellipse cx="60" cy="37" rx="27" ry="29" fill="#cfdae2"/><circle cx="60" cy="35" r="15" fill="#768fa3"/><rect x="55" y="28" width="10" height="12" fill="#e1eaf0"/></>;
 else if(n.includes("combinada")||n.includes("chave boca")||n.includes("chave estrela")) shape=<><path d="M53 45H67V139H53Z" fill="#b7c8d5"/><path d="M42 9 L42 31 L60 43 L78 31 L78 9 Q99 30 80 49 Q60 67 40 49 Q21 30 42 9Z" fill="#cbd8e1"/><circle cx="60" cy="148" r="24" fill="#cbd8e1"/><path d="M60 132L74 140V156L60 164L46 156V140Z" fill="#213747"/></>;
 else if(n.includes("cabo t")) shape=<><path d="M25 28H95M60 28V153" stroke="#bdccd8" strokeWidth="12" strokeLinecap="round"/><rect x="51" y="149" width="18" height="18" rx="2" fill="#e0e8ed"/></>;
 else if(n.includes("junta")) shape=<><rect x="46" y="20" width="28" height="42" rx="4" fill="#aebfcb"/><path d="M42 57L65 102L82 94L59 50Z" fill="#d9e3eb"/><circle cx="56" cy="67" r="8" fill="#708b9e"/><rect x="55" y="100" width="27" height="46" rx="5" fill="#b8c9d4"/></>;
 else shape=<><rect x="54" y={n.includes("longa")?"18":"43"} width="12" height={n.includes("longa")?"133":"102"} rx="3" fill="#c9d7e1"/><rect x="46" y="137" width="28" height="31" rx="5" fill="#a9bfce"/><rect x="51" y={n.includes("longa")?"10":"35"} width="18" height="18" rx="2" fill="#e0e8ed"/></>;
 return <svg viewBox="0 0 120 180" aria-hidden="true" className="h-full w-full drop-shadow-[2px_4px_2px_#0009]">{shape}</svg>;
}
