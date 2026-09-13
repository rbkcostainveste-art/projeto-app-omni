"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, ChevronDown } from "lucide-react";
import rawContent from "./presentation-dossier-content.json";
import "./presentation-dossier.css";

type Pair = [string, string];
type DossierPage = {
  key: string; title: string; sub: string; kind: string; role?: string; nav?: string;
  image?: string; marks?: [number, number][]; steps?: Pair[]; side?: Pair[];
  items?: Pair[]; tiles?: string[][]; shots?: [string, string, string, string][];
  cols?: string[]; rows?: string[][]; note?: string; jumps?: Pair[]; refs?: string[];
  ids?: string[]; groups?: [string, Pair[]][]; before?: string; after?: string;
  checks?: Pair[]; reference?: string; reference_url?: string;
};
type DossierData = {
  pages: DossierPage[];
  references: Record<string, Pair>;
  images: Record<string, { src: string; width: number; height: number }>;
  provenance: { author: string; edition: string; date: string; note: string };
};
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === "string");
}
function isPair(value: unknown): value is Pair {
  return isStringList(value) && value.length === 2;
}
function isPairs(value: unknown): value is Pair[] {
  return Array.isArray(value) && value.every(isPair);
}
function isPage(value: unknown): value is DossierPage {
  if (!isRecord(value) || !["key", "title", "sub", "kind"].every(key => typeof value[key] === "string")) return false;
  if (!["role", "nav", "image", "note", "before", "after", "reference", "reference_url"].every(key => value[key] === undefined || typeof value[key] === "string")) return false;
  if (!["steps", "side", "items", "jumps", "checks"].every(key => value[key] === undefined || isPairs(value[key]))) return false;
  if (!["cols", "refs", "ids"].every(key => value[key] === undefined || isStringList(value[key]))) return false;
  if (!["tiles", "rows"].every(key => value[key] === undefined || (Array.isArray(value[key]) && value[key].every(isStringList)))) return false;
  if (value.shots !== undefined && !(Array.isArray(value.shots) && value.shots.every(item => isStringList(item) && item.length === 4))) return false;
  if (value.marks !== undefined && !(Array.isArray(value.marks) && value.marks.every(item => Array.isArray(item) && item.length === 2 && item.every(part => typeof part === "number")))) return false;
  if (value.groups !== undefined && !(Array.isArray(value.groups) && value.groups.every(item => Array.isArray(item) && item.length === 2 && typeof item[0] === "string" && isPairs(item[1])))) return false;
  return true;
}
function readContent(value: unknown): DossierData {
  if (!isRecord(value) || !Array.isArray(value.pages) || !value.pages.every(isPage)) throw new Error("Conteúdo editorial inválido.");
  if (!isRecord(value.references) || !Object.values(value.references).every(isPair)) throw new Error("Referências editoriais inválidas.");
  if (!isRecord(value.images) || !Object.values(value.images).every(image => isRecord(image) && typeof image.src === "string" && typeof image.width === "number" && typeof image.height === "number")) throw new Error("Capturas editoriais inválidas.");
  if (!isRecord(value.provenance) || !["author", "edition", "date", "note"].every(key => typeof value.provenance === "object" && value.provenance !== null && typeof (value.provenance as Record<string, unknown>)[key] === "string")) throw new Error("Créditos editoriais inválidos.");
  return value as DossierData;
}
const content = readContent(rawContent);
const groups = [
  { name: "Visão geral", keys: ["capa", "inicio", "confianca", "dispositivos", "perfis", "mapa"] },
  { name: "Tripulação", keys: ["perfil-piloto", "mural-piloto", "trilhos-piloto", "guia-cockpit", "preparacao", "preparacao-concluida", "edb", "ocorrencias", "jornada", "ais"] },
  { name: "Manutenção e IA", keys: ["perfil-mecanico", "perfil-inspetor", "pista", "servico", "relatos", "botoes-relato", "campos-fatos", "campos-controle", "exemplo-ia", "exemplo-fontes", "troubleshooting", "controle-mel", "comentarios"] },
  { name: "Coordenação e ferramentaria", keys: ["perfil-coordenacao", "coordenacao", "programacao", "perfil-ferramentaria", "guia-ferramentaria"] },
  { name: "Recursos compartilhados", keys: ["trilhos", "chat", "chamadas", "notas", "mural", "ajuda", "pendencias", "cadastros", "catalogo", "videos"] },
  { name: "Condições de adoção", keys: ["piloto", "infra", "privacidade", "governanca", "ia-controle", "anac", "registro-oficial", "documentos"] },
  { name: "Fontes e edição", keys: ["refs-normas", "refs-normas-2", "refs-s92", "refs-s92-2", "refs-gerais", "edicao"] },
];

function Snapshot({ name, label, marks }: { name: string; label: string; marks?: [number, number][] }) {
  const image = content.images[name];
  if (!image) return null;
  const mobile = image.height > image.width * 1.25;
  return <figure className={`p-dossier-snapshot ${mobile ? "is-mobile" : "is-desktop"}`}>
    <div className="p-dossier-image"><Image src={image.src} alt={label} width={image.width} height={image.height} sizes={mobile ? "(max-width: 700px) 80vw, 320px" : "(max-width: 700px) 90vw, 680px"} />{marks?.map(([x, y], index) => <span className="p-dossier-marker" key={index} style={{ left: `${x * 100}%`, top: `${y * 100}%` }} aria-hidden="true">{index + 1}</span>)}</div>
    <figcaption>Captura real do protótipo · {mobile ? "celular" : "computador"}<a href={image.src} target="_blank" rel="noopener noreferrer">Ampliar <ArrowUpRight size={12} aria-hidden="true" /></a></figcaption>
  </figure>;
}

function Points({ items }: { items: Pair[] }) {
  return <div className="p-dossier-points">{items.map(([title, description]) => <div key={title}><h4>{title}</h4><p>{description}</p></div>)}</div>;
}

function Sources({ ids }: { ids: string[] }) {
  return <ul className="p-dossier-sources">{ids.map(id => { const item = content.references[id]; return item ? <li key={id}><span>{id}</span><a href={item[1]} target="_blank" rel="noopener noreferrer">{item[0]} <ArrowUpRight size={12} aria-hidden="true" /></a></li> : null; })}</ul>;
}

export function PresentationDossier() {
  const [selected, setSelected] = useState("perfis");
  const shellRef = useRef<HTMLDetailsElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const selectedIndex = content.pages.findIndex(page => page.key === selected);
  const page = content.pages[selectedIndex];
  const selectedGroup = groups.find(group => group.keys.includes(selected));

  useEffect(() => {
    let frame = 0;
    function openLinkedTopic() {
      const hash = window.location.hash;
      if (!hash.startsWith("#avaliacao-")) return;
      const requested = hash.slice("#avaliacao-".length);
      const key = requested === "ia-exemplo" ? "exemplo-ia" : requested;
      if (!content.pages.some(item => item.key === key)) return;
      setSelected(key);
      if (shellRef.current) shellRef.current.open = true;
      frame = requestAnimationFrame(() => {
        articleRef.current?.scrollIntoView({ block: "start" });
        articleRef.current?.focus({ preventScroll: true });
      });
    }
    frame = requestAnimationFrame(openLinkedTopic);
    window.addEventListener("hashchange", openLinkedTopic);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("hashchange", openLinkedTopic); };
  }, []);

  function go(key: string, focus = false) {
    if (!content.pages.some(item => item.key === key)) return;
    setSelected(key);
    window.history.replaceState(window.history.state, "", `#avaliacao-${key}`);
    if (focus) requestAnimationFrame(() => document.getElementById(`avaliacao-${key}`)?.focus({ preventScroll: true }));
  }

  function jumpButtons(items: Pair[]) {
    return <div className="p-dossier-jumps">{items.map(([label, key]) => <button type="button" key={`${key}-${label}`} onClick={() => go(key, true)}>{label}<ArrowRight size={14} aria-hidden="true" /></button>)}</div>;
  }

  return <section id="dossie" className="p-dossier-section">
    <div className="p-dossier-intro"><p>CONSULTE NO SEU RITMO</p><h2>A proposta completa, por assunto.</h2><span>Campos, exemplos, referências e condições de adoção. Todo o conteúdo editorial do PDF está disponível para explorar aqui.</span></div>
    <details className="p-dossier-shell" ref={shellRef}>
      <summary><BookOpen size={23} aria-hidden="true" /><span><strong>Abrir a apresentação detalhada</strong><small>{content.pages.length} assuntos · telas reais · referências clicáveis</small></span><ChevronDown size={22} className="p-dossier-open-icon" aria-hidden="true" /></summary>
      <div className="p-dossier-controls">
        <div className="p-dossier-groups" aria-label="Categorias da proposta">{groups.map(group => <button type="button" key={group.name} aria-pressed={selectedGroup?.name === group.name} onClick={() => go(group.keys[0])}>{group.name}</button>)}</div>
        <label htmlFor="p-dossier-topic">Escolha um assunto<select id="p-dossier-topic" value={selected} onChange={event => go(event.target.value)}>{groups.map(group => <optgroup key={group.name} label={group.name}>{group.keys.map(key => { const item = content.pages.find(entry => entry.key === key); return item ? <option key={key} value={key}>{item.title.replaceAll("\n", " ")}</option> : null; })}</optgroup>)}</select></label>
        <div className="p-dossier-pager"><button type="button" aria-label="Assunto anterior" disabled={selectedIndex === 0} onClick={() => go(content.pages[selectedIndex - 1].key)}><ArrowLeft size={16} aria-hidden="true" /></button><span>{selectedIndex + 1} / {content.pages.length}</span><button type="button" aria-label="Próximo assunto" disabled={selectedIndex === content.pages.length - 1} onClick={() => go(content.pages[selectedIndex + 1].key)}><ArrowRight size={16} aria-hidden="true" /></button></div>
      </div>
      <article id={`avaliacao-${page.key}`} ref={articleRef} tabIndex={-1} className="p-dossier-article" aria-live="polite" aria-labelledby="p-dossier-title">
        <div className="p-dossier-article-heading">{page.role && <p className="p-dossier-role">{page.role}</p>}<h3 id="p-dossier-title">{page.title}</h3>{page.sub && <p>{page.sub}</p>}{page.nav && <span className="p-dossier-route">{page.nav}</span>}</div>
        {page.kind === "cover" && <div className="p-dossier-cover"><p>Informações em tempo real para apoiar a coordenação entre equipes.</p><Points items={[["Segurança", "Condições para adoção"], ["Operação", "Ambientes conectados"], ["Governança", "Responsabilidades e controle"]]} /><p>Robson Kerly de Araújo Costa · MMA · ANAC 139090</p><small>Protótipo para avaliação · Setembro de 2026 · Edição 1.4</small></div>}
        {page.groups?.map(([title, items]) => <div className="p-dossier-index-group" key={title}><h4>{title}</h4>{jumpButtons(items)}</div>)}
        {page.kind === "devices" && <><div className="p-dossier-device-pair"><Snapshot name="mobile-cockpit-desktop" label="Visão do aplicativo no computador" /><Snapshot name="mobile-cockpit" label="Cockpit no celular" /></div><p className="p-dossier-note">Fluxos conectados compartilham atualizações em tempo real. Alguns painéis usam atualização periódica; conexão e sincronização ativa são necessárias. Recursos externos seguem o estado de integração informado.</p></>}
        {page.tiles && <div className="p-dossier-tiles">{page.tiles.map(tile => <button type="button" key={tile[0]} onClick={() => go(tile[tile.length - 1], true)}><strong>{tile[0]}</strong>{tile.length === 3 && <span>{tile[1]}</span>}<em>Explorar <ArrowRight size={14} aria-hidden="true" /></em></button>)}</div>}
        {page.shots && <div className="p-dossier-overview">{page.shots.map(([title, image, target, description]) => <div key={title}><h4>{title}</h4><Snapshot name={image} label={`${page.role}: ${title}`} /><p>{description}</p><button type="button" onClick={() => go(target, true)}>Entender a ferramenta <ArrowRight size={14} aria-hidden="true" /></button></div>)}</div>}
        {(page.image || page.side || page.steps) && <div className="p-dossier-visual">{page.image && <Snapshot name={page.image} label={page.title} marks={page.marks} />}{(page.side || page.steps) && <Points items={(page.side ?? page.steps)!} />}</div>}
        {page.marks && <p className="p-dossier-caption">Os números são anotações explicativas sobre a captura. Não são botões adicionais do aplicativo.</p>}
        {page.items && <Points items={page.items} />}
        {page.cols && page.rows && <div className="p-dossier-table-wrap"><table><thead><tr>{page.cols.map(column => <th key={column} scope="col">{column}</th>)}</tr></thead><tbody>{page.rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => cellIndex === 0 ? <th scope="row" key={cellIndex}>{cell}</th> : <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>}
        {page.kind === "example" && <><div className="p-dossier-example"><div><span>O profissional informa</span><p>{page.before}</p></div><div><span>Sugestão de redação da IA</span><p>{page.after}</p></div></div><p className="p-dossier-note">{page.reference}{page.reference_url && <a href={page.reference_url} target="_blank" rel="noopener noreferrer"> Conferir a fonte <ArrowUpRight size={13} aria-hidden="true" /></a>}</p>{page.checks && <Points items={page.checks} />}</>}
        {page.ids && <Sources ids={page.ids} />}
        {page.note && <p className="p-dossier-note">{page.note}</p>}
        {page.key === "videos" && <div className="p-dossier-update"><strong>Vídeos serão inseridos após a gravação</strong><p>A programação foi atualizada para os sete vídeos definidos pelo autor. Os espaços estão reservados na apresentação.</p><a href="#videos">Ver a área de vídeos <ArrowUpRight size={14} aria-hidden="true" /></a></div>}
        {page.key === "edicao" && <p className="p-dossier-note">Nesta versão do site, a navegação e os vídeos foram atualizados. Os tópicos acima preservam o conteúdo da edição original para consulta; requisitos de implantação continuam sujeitos às validações descritas.</p>}
        {page.refs && <Sources ids={page.refs} />}
        {page.jumps && jumpButtons(page.jumps)}
      </article>
      <div className="p-dossier-credit"><span>Conteúdo: {content.provenance.author} · Base: PDF comercial, edição {content.provenance.edition}</span><a href="#bibliografia">Consultar bibliografia <ArrowUpRight size={13} aria-hidden="true" /></a></div>
    </details>
  </section>;
}
