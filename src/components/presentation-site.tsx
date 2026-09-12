"use client";

import Image from "next/image";
import { type FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CirclePlay, LockKeyhole, MessageCircle, Phone, Plane, MonitorSmartphone, ClipboardCheck, Wrench, CalendarClock, PackageOpen, ChevronDown, X } from "lucide-react";
import { preparePresentationLogin, preparePresentationDemo, preparePresentationAccountLogin, type PresentationDemoProfile } from "@/lib/presentation-login";
import { presentationVideos, presentationVideoPath, type PresentationVideo } from "@/lib/presentation-videos";
import { PresentationExplorer } from "./presentation-explorer";
import { PresentationSecurity, PresentationConfidence, PresentationReferences } from "./presentation-trust";
import { PresentationDossier } from "./presentation-dossier";
import { PresentationMobileSection } from "./presentation-mobile-section";
import "./presentation-site.css";

const trialProfiles = [
  { id: "maintenance_leader", label: "Manutenção · líderes", description: "Passagem de serviço e acompanhamento técnico.", icon: ClipboardCheck },
  { id: "mechanic", label: "Manutenção · mecânicos", description: "Trilho, atividades e execução.", icon: Wrench },
  { id: "commander", label: "Tripulação · comandante", description: "Cockpit e preparação do voo.", icon: Plane },
  { id: "coordination", label: "Coordenação", description: "Painel e programação dos voos.", icon: CalendarClock },
  { id: "toolroom", label: "Ferramentaria", description: "Caixas, ferramentas e conferências.", icon: PackageOpen },
] as const;

export function PresentationSite({ availableVideos = [] }: { availableVideos?: string[] }) {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [entering, setEntering] = useState(false);
  const [loginExpanded, setLoginExpanded] = useState(false);
  const [trialEntering, setTrialEntering] = useState(false);
  const trialDialog = useRef<HTMLDialogElement>(null);
  const [activeVideo, setActiveVideo] = useState<PresentationVideo | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const mainVideo = presentationVideos[0];
  function enter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!login.trim() || !password || entering) return;
    preparePresentationLogin(login, password);
    setPassword("");
    setEntering(true);
    router.push("/app");
  }
  function play(video: PresentationVideo) {
    if (!availableVideos.includes(video.id)) return;
    setActiveVideo(video);
    dialog.current?.showModal();
  }
  function closeVideo() { dialog.current?.close(); setActiveVideo(null); }
  function showTrial() { setTrialEntering(false); trialDialog.current?.showModal(); }
  function enterDemo(profile: PresentationDemoProfile) {
    if (trialEntering) return;
    setTrialEntering(true);
    preparePresentationDemo(profile);
    router.push("/app");
  }
  function enterAccount() {
    preparePresentationAccountLogin();
    router.push("/app");
  }
  return <main className="presentation-site">
    <a className="presentation-skip" href="#seguranca">Pular para o conteúdo</a>
    <header className="presentation-header">
      <a href="#inicio" className="presentation-brand" aria-label="Flight IA, início"><Plane aria-hidden="true"/><span>Flight<span className="brand-ia"> IA</span><small>INTEGRAÇÃO OPERACIONAL</small></span></a>
      <nav aria-label="Navegação da apresentação"><a href="#seguranca">Segurança</a><a href="#confianca">Confiança</a><a href="#ambientes">Ambientes</a><a href="#videos">Vídeos</a><a href="#bibliografia">Referências</a></nav>
      <button type="button" className="presentation-mobile-login-toggle" aria-expanded={loginExpanded} aria-controls="presentation-login-form" onClick={() => setLoginExpanded(value => !value)}><LockKeyhole size={15} aria-hidden="true"/>Entrar<ChevronDown size={15} aria-hidden="true"/></button>
      <form id="presentation-login-form" onSubmit={enter} className={loginExpanded ? "presentation-login is-expanded" : "presentation-login"} aria-label="Entrar no aplicativo">
        <label><span className="sr-only">Login</span><input name="username" value={login} onChange={event => setLogin(event.target.value)} placeholder="Login" autoComplete="username" autoCapitalize="none" required disabled={entering}/></label>
        <label><span className="sr-only">Senha</span><input name="password" value={password} onChange={event => setPassword(event.target.value)} type="password" placeholder="Senha" autoComplete="current-password" required disabled={entering}/></label>
        <button disabled={entering} type="submit"><LockKeyhole size={14} aria-hidden="true"/>{entering ? "Entrando…" : "Entrar"}</button>
      </form>
    </header>
    <div className="demonstration-warning"><strong>AMBIENTE DEMONSTRATIVO · Use apenas dados simulados.</strong><span> Referências a bases e aeronaves são ilustrativas; este protótipo não constitui um sistema oficial da empresa.</span></div>
    <section id="inicio" className="presentation-hero">
      <Image src="/presentation/hero-aw139.png" alt="Ilustração de helicóptero em operação offshore, sem identificação de empresa" fill priority sizes="100vw"/>
      <div className="hero-overlay"/>
      <div className="hero-content"><p className="eyebrow">UMA PROPOSTA PARA A OPERAÇÃO</p><h1>Segurança para<br/>conectar a operação.</h1><p className="hero-description">Equipes alinhadas. Informações no momento certo.</p><p className="hero-condition">Implantação e integração conforme as políticas e a avaliação da TI da empresa.</p><div className="hero-actions"><button type="button" onClick={showTrial} className="presentation-test-button"><MonitorSmartphone size={20} aria-hidden="true"/>Testar o aplicativo <ArrowRight size={17} aria-hidden="true"/></button><a href="#seguranca">Conheça a proposta</a><a href="#explorador">Explore as ferramentas</a></div><p className="hero-access-note">Escolha uma visão de teste ou entre com sua conta.</p></div>
      <div className="hero-video-wrap"><div className="hero-video-label"><span/> CONHEÇA O APLICATIVO</div>
        {availableVideos.includes(mainVideo.id) ? <button className="hero-video" onClick={() => play(mainVideo)}><CirclePlay size={54}/><strong>Assista à apresentação</strong><span>Visão geral · cerca de 3 minutos</span></button> : <div className="hero-video"><CirclePlay size={54} aria-hidden="true"/><strong>Apresentação do aplicativo</strong><span>Visão geral · cerca de 3 minutos</span><small>Vídeo em preparação</small></div>}
        <p>Segurança, confiança e recursos em uma única apresentação.</p>
      </div>
    </section>
    <div className="presentation-guide" aria-label="Índice da proposta"><a href="#seguranca"><span>01</span> Segurança <ArrowRight/></a><a href="#confianca"><span>02</span> Confiança <ArrowRight/></a><a href="#ambientes"><span>03</span> Ferramentas <ArrowRight/></a></div>
    <PresentationMobileSection name="Segurança para adotar" description="Infraestrutura, integração e proteção de dados." sectionId="seguranca" number="01"><PresentationSecurity/></PresentationMobileSection>
    <PresentationMobileSection name="Confiança para avaliar" description="IA, governança e requisitos ANAC." sectionId="confianca" number="02"><PresentationConfidence/></PresentationMobileSection>
    <PresentationExplorer onTestApp={showTrial}/>
    <section className="presentation-try" aria-labelledby="presentation-try-title">
      <div className="presentation-try-icon"><MonitorSmartphone size={34} aria-hidden="true"/></div>
      <div><p className="eyebrow">EXPERIMENTE NA PRÁTICA</p><h2 id="presentation-try-title">Conheça o aplicativo por dentro.</h2><p>Escolha um perfil para testar ou entre com seu login e senha.</p><small>Use dados simulados. Os registros salvos permanecem e podem ser vistos por outros usuários autorizados.</small></div>
      <button type="button" onClick={showTrial} className="presentation-test-button">Testar o aplicativo <ArrowRight size={20} aria-hidden="true"/></button>
    </section>
    <PresentationMobileSection name="Vídeos de demonstração" description="Conheça os fluxos em vídeos curtos." sectionId="videos" number="04"><section id="videos" className="presentation-videos">
      <div className="presentation-section-heading"><div><p className="eyebrow">VEJA CADA FLUXO ACONTECER</p><h2>Demonstrações guiadas</h2></div><p>Vídeos curtos para acompanhar as ferramentas em uso, no computador e no celular.</p></div>
      <div className="presentation-video-grid">{presentationVideos.map((video, index) => {
        const available = availableVideos.includes(video.id);
        const content = <><div className="presentation-video-poster"><Image src={video.poster} alt="" fill sizes="(max-width: 640px) 90vw, (max-width: 1050px) 45vw, 25vw"/><span className="presentation-play"><CirclePlay size={32}/></span><span className="presentation-video-number">{String(index + 1).padStart(2, "0")}</span></div><div className="presentation-video-copy"><h3>{video.title}</h3><p>{video.description}</p><span className={available ? "video-status available" : "video-status"}>{available ? "Assistir ao vídeo" : "Em preparação"}{available ? <ArrowRight size={14}/> : null}</span></div></>;
        return available ? <button key={video.id} className="presentation-video-card" onClick={() => play(video)}>{content}</button> : <article key={video.id} className="presentation-video-card">{content}</article>;
      })}</div>
    </section></PresentationMobileSection>
    <PresentationDossier/>
    <PresentationMobileSection name="Bibliografia e referências" description="ANAC, FAA, EASA e documentos públicos." sectionId="bibliografia" number="05"><PresentationReferences/></PresentationMobileSection>
    <section id="contato" className="presentation-contact"><div><p className="eyebrow">PRÓXIMO PASSO</p><h2>Vamos avaliar essa possibilidade juntos?</h2><p>Uma conversa com a direção e a TI para definir os requisitos e o caminho para uma validação controlada.</p></div><div className="presentation-contact-card"><h3>Fale conosco</h3><p>(21) 98673-9747</p><div className="presentation-contact-options"><a href="tel:+5521986739747" aria-label="Ligar para (21) 98673-9747"><Phone size={20} aria-hidden="true"/><span>Ligar</span></a><a className="contact-whatsapp" href="https://wa.me/5521986739747" target="_blank" rel="noopener noreferrer" aria-label="Conversar pelo WhatsApp"><MessageCircle size={21} aria-hidden="true"/><span>WhatsApp</span></a></div></div></section>
    <footer className="presentation-footer"><p>Proposta de Robson Kerly de Araújo Costa</p><p>Protótipo independente para avaliação.</p><button type="button" onClick={enterAccount}>Entrar com meu login <ArrowRight size={14} aria-hidden="true"/></button></footer>
    <dialog ref={trialDialog} className="presentation-access-dialog" aria-labelledby="presentation-access-title" onClick={event => { if (event.target === event.currentTarget && !trialEntering) trialDialog.current?.close(); }}>
      <header><div><p className="eyebrow">EXPLORE O APLICATIVO</p><h2 id="presentation-access-title">Como você quer entrar?</h2></div><button type="button" onClick={() => trialDialog.current?.close()} aria-label="Fechar escolha de perfil"><X size={22}/></button></header>
      <p className="presentation-access-intro">Escolha uma visão para experimentar os recursos.</p>
      <div className="presentation-access-profiles">{trialProfiles.map(({id,label,description,icon:Icon}) => <button type="button" key={id} disabled={trialEntering} onClick={() => enterDemo(id)}><span className="presentation-access-icon"><Icon size={23} aria-hidden="true"/></span><span><strong>{label}</strong><small>{description}</small></span><ArrowRight size={18} aria-hidden="true"/></button>)}</div>
      <p className="presentation-access-notice">Use dados simulados. O que você salvar permanece no aplicativo, conforme as permissões do perfil.</p>
      {trialEntering ? <p role="status" className="presentation-access-status">Preparando seu acesso…</p> : <button type="button" className="presentation-account-option" onClick={enterAccount}><LockKeyhole size={17} aria-hidden="true"/>Entrar com meu login e senha <ArrowRight size={17} aria-hidden="true"/></button>}
    </dialog>
    <dialog ref={dialog} className="presentation-video-dialog" aria-labelledby="presentation-video-title" onClose={() => setActiveVideo(null)} onClick={event => { if (event.target === event.currentTarget) closeVideo(); }}>
      {activeVideo ? <div className="presentation-video-player"><header><h2 id="presentation-video-title">{activeVideo.title}</h2><button onClick={closeVideo} aria-label="Fechar vídeo"><X size={22}/></button></header><video key={activeVideo.id} src={presentationVideoPath(activeVideo.id)} poster={activeVideo.poster} controls autoPlay playsInline preload="metadata">Seu navegador não permite a reprodução. <a href={presentationVideoPath(activeVideo.id)}>Abrir vídeo</a></video></div> : null}
    </dialog>
  </main>;
}
