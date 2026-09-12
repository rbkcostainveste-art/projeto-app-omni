"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ChevronDown, Expand, Monitor, MousePointer2, Smartphone, X } from "lucide-react";
import { presentationAreas, presentationResources, type PresentationScreen } from "@/lib/presentation-resources";
import "./presentation-explorer.css";

export function PresentationExplorer({ onTestApp }: { onTestApp?: () => void }) {
  const [areaId, setAreaId] = useState("manutencao");
  const [profileId, setProfileId] = useState("mecanico");
  const [resourceId, setResourceId] = useState("verificacoes");
  const [preview, setPreview] = useState<PresentationScreen | null>(null);
  const [deviceView, setDeviceView] = useState<"mobile" | "desktop">("mobile");
  const explorerRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const area = presentationAreas.find(item => item.id === areaId)!;
  const profile = area.profiles.find(item => item.id === profileId) ?? area.profiles[0];
  const resource = presentationResources[resourceId];
  const resourceIndex = profile.resourceIds.indexOf(resourceId);
  const selectedDevice = deviceView === "mobile" && resource.mobile ? "mobile" : resource.desktop ? "desktop" : "mobile";

  function selectResource(nextResourceId: string) {
    setResourceId(nextResourceId);
    setDeviceView("mobile");
  }

  function selectProfile(nextAreaId: string, nextProfileId?: string, scroll = false) {
    const nextArea = presentationAreas.find(item => item.id === nextAreaId)!;
    const nextProfile = nextArea.profiles.find(item => item.id === nextProfileId) ?? nextArea.profiles[0];
    setAreaId(nextArea.id);
    setProfileId(nextProfile.id);
    selectResource(nextProfile.resourceIds[0]);
    if (scroll) {
      explorerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      explorerRef.current?.focus({ preventScroll: true });
    }
  }

  function moveResource(direction: number) {
    const index = (resourceIndex + direction + profile.resourceIds.length) % profile.resourceIds.length;
    selectResource(profile.resourceIds[index]);
  }

  function enlarge(screen: PresentationScreen) {
    setPreview(screen);
    dialogRef.current?.showModal();
  }

  return <>
    <section id="ambientes" className="px-roles" aria-labelledby="px-roles-title">
      <div className="px-section-heading">
        <p className="px-eyebrow">3. QUALIDADE · CONHEÇA OS AMBIENTES</p>
        <h2 id="px-roles-title">Cada equipe encontra<br/>o que precisa.</h2>
        <p>Escolha um perfil para conhecer suas ferramentas. Os acessos no aplicativo seguem as autorizações atribuídas.</p>
      </div>
      <div className="px-role-grid">
        {presentationAreas.flatMap(item => item.profiles.filter(person => person.id !== "comissario").map(person => {
          const firstResource = presentationResources[person.resourceIds[0]];
          const cover = person.id === "mecanico" || person.id === "ferramenteiro" || person.id === "piloto"
            ? firstResource.mobile ?? firstResource.desktop : firstResource.desktop ?? firstResource.mobile;
          return <article className="px-role-card" key={person.id}>
            <div className={`px-role-image ${cover && cover.height > cover.width ? "px-role-image-portrait" : ""}`}>
              {cover ? <Image src={cover.src} alt={cover.caption} fill sizes="(max-width: 600px) 90vw, (max-width: 1000px) 44vw, 18vw"/> : null}
              <span>{item.label}</span>
            </div>
            <div className="px-role-body"><h3>{person.label}</h3><p>{person.description}</p>
              <button type="button" onClick={() => selectProfile(item.id, person.id, true)}>Explorar ambiente <ArrowRight size={15}/></button>
            </div>
          </article>;
        }))}
      </div>
      <div className="px-role-mobile-summary">
        <p>Manutenção, tripulação, coordenação e ferramentaria.</p>
        <button type="button" onClick={() => selectProfile(area.id, profile.id, true)}>Escolher ambiente e ferramentas <ArrowDown size={18}/></button>
      </div>
      <p className="px-role-footnote">Tripulação reúne piloto e comissário, com visibilidade e comandos conforme o perfil. As capturas são prévias do protótipo.</p>
    </section>

    <section id="explorador" className="px-explorer" ref={explorerRef} tabIndex={-1} aria-labelledby="px-explorer-title">
      <div className="px-explorer-heading">
        <div><p className="px-eyebrow">ESCOLHA. CLIQUE. CONHEÇA.</p><h2 id="px-explorer-title">Ferramentas por ambiente</h2><p>Troque o recurso e veja a tela correspondente, com uma explicação simples ao lado.</p></div>
        <div className="px-interaction-cue"><MousePointer2 size={19}/><span>Comece pelos botões abaixo<br/><strong>Você controla a apresentação</strong></span><ArrowDown size={18}/></div>
      </div>
      <div className="px-desktop-controls">
      <div className="px-selection-step"><span className="px-step">1</span><span>Escolha o ambiente</span></div>
      <div className="px-area-controls" role="group" aria-label="Ambientes">
        {presentationAreas.map(item => <button type="button" key={item.id} aria-pressed={item.id === areaId} onClick={() => selectProfile(item.id)}>{item.label}</button>)}
      </div>
      {area.profiles.length > 1 ? <div className="px-profile-controls" role="group" aria-label="Perfil do ambiente"><span>Visão de:</span>
        {area.profiles.map(item => <button type="button" key={item.id} aria-pressed={item.id === profile.id} onClick={() => selectProfile(area.id, item.id)}>{item.label}</button>)}
      </div> : null}
      <div className="px-selection-step"><span className="px-step">2</span><span>Clique em uma ferramenta</span><small>{profile.resourceIds.length} recursos para explorar</small></div>
      <div className="px-resource-controls" role="group" aria-label={`Ferramentas de ${profile.label}`}>
        {profile.resourceIds.map(id => <button type="button" key={id} aria-pressed={id === resourceId} onClick={() => selectResource(id)}>{presentationResources[id].title}</button>)}
      </div>
      </div>

      <div className="px-mobile-controls">
        <div className={`px-mobile-profile-fields ${area.profiles.length === 1 ? "px-mobile-single-profile" : ""}`}>
          <label htmlFor="px-mobile-area">Ambiente<select id="px-mobile-area" value={area.id} onChange={event => selectProfile(event.target.value)}>
            {presentationAreas.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select></label>
          {area.profiles.length > 1 ? <label htmlFor="px-mobile-profile">Perfil<select id="px-mobile-profile" value={profile.id} onChange={event => selectProfile(area.id, event.target.value)}>
            {area.profiles.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select></label> : null}
        </div>
        <label className="px-mobile-resource-label" htmlFor="px-mobile-resource">Ferramenta <span>{resourceIndex + 1} de {profile.resourceIds.length}</span></label>
        <div className="px-mobile-resource-row">
          <button type="button" onClick={() => moveResource(-1)} aria-label="Ferramenta anterior"><ArrowLeft size={19}/></button>
          <select id="px-mobile-resource" value={resourceId} onChange={event => selectResource(event.target.value)}>
            {profile.resourceIds.map(id => <option key={id} value={id}>{presentationResources[id].title}</option>)}
          </select>
          <button type="button" onClick={() => moveResource(1)} aria-label="Próxima ferramenta"><ArrowRight size={19}/></button>
        </div>
        <p>Use as setas ou a lista para trocar de ferramenta.</p>
      </div>

      <div className="px-preview-toolbar">
        <span aria-live="polite" aria-atomic="true"><strong>{profile.label}</strong> / {resource.title}</span>
        <div className="px-pagination"><button type="button" onClick={() => moveResource(-1)} aria-label="Ferramenta anterior"><ArrowLeft size={17}/></button><span>{resourceIndex + 1} / {profile.resourceIds.length}</span><button type="button" onClick={() => moveResource(1)} aria-label="Próxima ferramenta"><ArrowRight size={17}/></button></div>
      </div>

      <div className={`px-showcase px-device-${selectedDevice} ${resource.desktop && resource.mobile ? "px-two-devices" : "px-one-device"}`}>
        <div className="px-mobile-preview-intro" aria-live="polite" aria-atomic="true"><h3>{resource.title}</h3><p>{resource.summary}</p></div>
        {resource.desktop && resource.mobile ? <div className="px-device-switch" role="group" aria-label="Formato da prévia">
          <button type="button" onClick={() => setDeviceView("mobile")} aria-pressed={selectedDevice === "mobile"}><Smartphone size={16}/>Celular</button>
          <button type="button" onClick={() => setDeviceView("desktop")} aria-pressed={selectedDevice === "desktop"}><Monitor size={16}/>Computador</button>
        </div> : null}
        <div className="px-devices">
          {resource.desktop ? <figure className="px-laptop">
            <div className="px-laptop-frame"><div className="px-device-top"><i/><span>Computador</span></div>
              <button type="button" className="px-screen-button" onClick={() => enlarge(resource.desktop!)} aria-label={`Ampliar ${resource.title} no computador`}>
                <Image src={resource.desktop.src} alt={resource.desktop.caption} width={resource.desktop.width} height={resource.desktop.height} sizes="(max-width: 700px) 90vw, 55vw"/>
                <span className="px-zoom-label"><Expand size={14}/> Ampliar tela</span>
              </button>
            </div><div className="px-laptop-base"/><figcaption><Monitor size={13}/>{resource.desktop.caption}</figcaption>
          </figure> : null}
          {resource.mobile ? <figure className="px-phone">
            <div className="px-phone-frame"><div className="px-phone-top"><i/></div>
              <button type="button" className="px-screen-button" onClick={() => enlarge(resource.mobile!)} aria-label={`Ampliar ${resource.title} no celular`}>
                <Image src={resource.mobile.src} alt={resource.mobile.caption} width={resource.mobile.width} height={resource.mobile.height} sizes="(max-width: 700px) 230px, 210px"/>
                <span className="px-phone-zoom"><Expand size={15}/></span>
              </button><div className="px-phone-bottom"><i/></div>
            </div><figcaption><Smartphone size={13}/>{resource.mobile.caption}</figcaption>
          </figure> : null}
        </div>
        <aside className="px-feature-description" aria-label="Explicação da ferramenta">
          <span className="px-preview-tag">CAPTURA REAL · PRÉVIA ESTÁTICA</span>
          <h3>{resource.title}</h3><p className="px-feature-summary">{resource.summary}</p>
          <details className="px-feature-details" key={resource.id}><summary>Entenda este recurso <ChevronDown size={16}/></summary><p>{resource.detail}</p></details>
          {resource.topic ? <a className="px-technical-detail" href={`#avaliacao-${resource.topic}`}>Ver explicação completa <ArrowRight size={13}/></a> : null}
          {!resource.desktop || !resource.mobile ? <p className="px-device-note">Nesta prévia, mostramos a captura disponível em {resource.desktop ? "computador" : "celular"}. Explore as demais visualizações no aplicativo.</p> : null}
          {onTestApp ? <button type="button" className="px-open-app" onClick={onTestApp}>Testar o aplicativo <ArrowRight size={20} aria-hidden="true"/></button> : <Link className="px-open-app" href="/app">Testar o aplicativo <ArrowRight size={20} aria-hidden="true"/></Link>}
          <small>Escolha uma experiência de demonstração ou entre com seu login.</small>
        </aside>
      </div>
      <div className="px-preview-explanation"><span className="px-status-dot"/><p><strong>No aplicativo, os ambientes compartilham atualizações em tempo real.</strong> Aqui, você navega por capturas reais de demonstração. Dados, comandos e sincronização podem ser avaliados no ambiente de teste.</p></div>
    </section>

    <dialog className="px-image-dialog" ref={dialogRef} aria-labelledby="px-dialog-title" onClose={() => setPreview(null)} onClick={event => { if (event.target === event.currentTarget) dialogRef.current?.close(); }}>
      <div className="px-dialog-header"><h2 id="px-dialog-title">{preview?.caption ?? "Prévia da ferramenta"}</h2><button type="button" onClick={() => dialogRef.current?.close()} aria-label="Fechar imagem ampliada"><X size={23}/></button></div>
      {preview ? <div className="px-dialog-image"><Image src={preview.src} width={preview.width} height={preview.height} alt={preview.caption} sizes="90vw" unoptimized/></div> : null}
      <p>Captura estática do protótipo. Pressione Esc ou Fechar para voltar.</p>
    </dialog>
  </>;
}
