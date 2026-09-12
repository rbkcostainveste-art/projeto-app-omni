"use client";

import Image from "next/image";
import Link from "next/link";
import { type FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CirclePlay, LockKeyhole, MessageCircle, Phone, Plane, MonitorSmartphone, X } from "lucide-react";
import { preparePresentationLogin } from "@/lib/presentation-login";
import { presentationVideos, presentationVideoPath, type PresentationVideo } from "@/lib/presentation-videos";
import { PresentationExplorer } from "./presentation-explorer";
import { PresentationSecurity, PresentationConfidence, PresentationReferences } from "./presentation-trust";
import { PresentationDossier } from "./presentation-dossier";
import "./presentation-site.css";

export function PresentationSite({ availableVideos = [] }: { availableVideos?: string[] }) {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [entering, setEntering] = useState(false);
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
  return <main className="presentation-site">
    <a className="presentation-skip" href="#seguranca">Pular para o conteúdo</a>
    <header className="presentation-header">
      <a href="#inicio" className="presentation-brand" aria-label="Flight IA, início"><Plane aria-hidden="true"/><span>Flight<span className="brand-ia"> IA</span><small>INTEGRAÇÃO OPERACIONAL</small></span></a>
      <nav aria-label="Navegação da apresentação"><a href="#seguranca">Segurança</a><a href="#confianca">Confiança</a><a href="#ambientes">Ambientes</a><a href="#videos">Vídeos</a><a href="#bibliografia">Referências</a></nav>
      <form onSubmit={enter} className="presentation-login" aria-label="Entrar no aplicativo">
        <label><span className="sr-only">Login</span><input name="username" value={login} onChange={event => setLogin(event.target.value)} placeholder="Login" autoComplete="username" autoCapitalize="none" required disabled={entering}/></label>
        <label><span className="sr-only">Senha</span><input name="password" value={password} onChange={event => setPassword(event.target.value)} type="password" placeholder="Senha" autoComplete="current-password" required disabled={entering}/></label>
        <button disabled={entering} type="submit"><LockKeyhole size={14} aria-hidden="true"/>{entering ? "Entrando…" : "Entrar"}</button>
      </form>
    </header>
    <div className="demonstration-warning"><strong>AMBIENTE DEMONSTRATIVO — utilize apenas dados simulados para avaliação.</strong><span> Referências a bases e aeronaves são ilustrativas; este protótipo não constitui um sistema oficial da empresa.</span></div>
    <section id="inicio" className="presentation-hero">
      <Image src="/presentation/hero-aw139.png" alt="Ilustração de helicóptero em operação offshore, sem identificação de empresa" fill priority sizes="100vw"/>
      <div className="hero-overlay"/>
      <div className="hero-content"><p className="eyebrow">UMA PROPOSTA PARA A OPERAÇÃO</p><h1>Segurança para<br/>conectar a operação.</h1><p className="hero-description">Equipes alinhadas. Informações no momento certo. Uma visão compartilhada do trabalho.</p><p className="hero-condition">Implantação e integração a sistemas internos conforme as políticas, a avaliação da TI e as necessidades da empresa.</p><div className="hero-actions"><Link href="/app" className="presentation-test-button"><MonitorSmartphone size={20} aria-hidden="true"/>Testar o aplicativo <ArrowRight size={17} aria-hidden="true"/></Link><a href="#seguranca">Conheça a proposta</a><a href="#explorador">Explore as ferramentas</a></div><p className="hero-access-note">Acesso com o login e a senha fornecidos.</p></div>
      <div className="hero-video-wrap"><div className="hero-video-label"><span/> CONHEÇA O APLICATIVO</div>
        {availableVideos.includes(mainVideo.id) ? <button className="hero-video" onClick={() => play(mainVideo)}><CirclePlay size={54}/><strong>Assista à apresentação</strong><span>Visão geral · cerca de 3 minutos</span></button> : <div className="hero-video"><CirclePlay size={54} aria-hidden="true"/><strong>Apresentação do aplicativo</strong><span>Visão geral · cerca de 3 minutos</span><small>Vídeo em preparação</small></div>}
        <p>Segurança, confiança e recursos em uma única apresentação.</p>
      </div>
    </section>
    <div className="presentation-guide" aria-label="Índice da proposta"><a href="#seguranca"><span>01</span> Segurança para adotar <ArrowRight/></a><a href="#confianca"><span>02</span> Confiança para avaliar <ArrowRight/></a><a href="#ambientes"><span>03</span> Qualidade para explorar <ArrowRight/></a></div>
    <PresentationSecurity/>
    <PresentationConfidence/>
    <PresentationExplorer/>
    <section className="presentation-try" aria-labelledby="presentation-try-title">
      <div className="presentation-try-icon"><MonitorSmartphone size={34} aria-hidden="true"/></div>
      <div><p className="eyebrow">EXPERIMENTE NA PRÁTICA</p><h2 id="presentation-try-title">Agora, conheça o aplicativo por dentro.</h2><p>Entre com seu login e senha e teste os recursos disponíveis para o seu perfil.</p><small>Use dados simulados. Registros salvos podem ficar visíveis para outros usuários autorizados.</small></div>
      <Link href="/app" className="presentation-test-button">Testar o aplicativo <ArrowRight size={20} aria-hidden="true"/></Link>
    </section>
    <section id="videos" className="presentation-videos">
      <div className="presentation-section-heading"><div><p className="eyebrow">VEJA CADA FLUXO ACONTECER</p><h2>Demonstrações guiadas</h2></div><p>Vídeos curtos para acompanhar as ferramentas em uso, no computador e no celular.</p></div>
      <div className="presentation-video-grid">{presentationVideos.map((video, index) => {
        const available = availableVideos.includes(video.id);
        const content = <><div className="presentation-video-poster"><Image src={video.poster} alt="" fill sizes="(max-width: 640px) 90vw, (max-width: 1050px) 45vw, 25vw"/><span className="presentation-play"><CirclePlay size={32}/></span><span className="presentation-video-number">{String(index + 1).padStart(2, "0")}</span></div><div className="presentation-video-copy"><h3>{video.title}</h3><p>{video.description}</p><span className={available ? "video-status available" : "video-status"}>{available ? "Assistir ao vídeo" : "Em preparação"}{available ? <ArrowRight size={14}/> : null}</span></div></>;
        return available ? <button key={video.id} className="presentation-video-card" onClick={() => play(video)}>{content}</button> : <article key={video.id} className="presentation-video-card">{content}</article>;
      })}</div>
    </section>
    <PresentationDossier/>
    <PresentationReferences/>
    <section id="contato" className="presentation-contact"><div><p className="eyebrow">PRÓXIMO PASSO</p><h2>Vamos avaliar essa possibilidade juntos?</h2><p>Uma conversa com a direção e a TI para definir os requisitos e o caminho para uma validação controlada.</p></div><div className="presentation-contact-card"><h3>Fale conosco</h3><p>(21) 98673-9747</p><div className="presentation-contact-options"><a href="tel:+5521986739747" aria-label="Ligar para (21) 98673-9747"><Phone size={20} aria-hidden="true"/><span>Ligar</span></a><a className="contact-whatsapp" href="https://wa.me/5521986739747" target="_blank" rel="noopener noreferrer" aria-label="Conversar pelo WhatsApp"><MessageCircle size={21} aria-hidden="true"/><span>WhatsApp</span></a></div></div></section>
    <footer className="presentation-footer"><p>Proposta de Robson Kerly de Araújo Costa</p><p>Protótipo independente para avaliação.</p><Link href="/app">Acessar o aplicativo <ArrowRight size={14}/></Link></footer>
    <dialog ref={dialog} className="presentation-video-dialog" aria-labelledby="presentation-video-title" onClose={() => setActiveVideo(null)} onClick={event => { if (event.target === event.currentTarget) closeVideo(); }}>
      {activeVideo ? <div className="presentation-video-player"><header><h2 id="presentation-video-title">{activeVideo.title}</h2><button onClick={closeVideo} aria-label="Fechar vídeo"><X size={22}/></button></header><video key={activeVideo.id} src={presentationVideoPath(activeVideo.id)} poster={activeVideo.poster} controls autoPlay playsInline preload="metadata">Seu navegador não permite a reprodução. <a href={presentationVideoPath(activeVideo.id)}>Abrir vídeo</a></video></div> : null}
    </dialog>
  </main>;
}
