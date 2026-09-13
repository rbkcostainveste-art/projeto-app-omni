"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, ChevronRight, LoaderCircle, MessageCircle, RotateCcw, Send, ShieldCheck, Sparkles, Square, X } from "lucide-react";
import "./presentation-assistant.css";

type AssistantLink = { id: string; label: string; href: string };
type ConversationMessage = { role: "user" | "assistant"; content: string; links?: AssistantLink[] };
type RequestMessage = Pick<ConversationMessage, "role" | "content">;

const suggestedQuestions = [
  { label: "Segurança de dados", question: "Como a proposta trata a segurança dos dados da empresa?" },
  { label: "Implantação na empresa", question: "Como o aplicativo poderia ser implantado no ambiente da minha empresa?" },
  { label: "Ferramentas para minha equipe", question: "Quais ferramentas podem facilitar o trabalho da minha equipe?" },
  { label: "Como funciona na prática", question: "Pode me mostrar um exemplo de como os setores trabalham juntos no aplicativo?" },
];

export function openPresentationAssistant(question?: string) {
  window.dispatchEvent(new CustomEvent("presentation-assistant:open", { detail: { question } }));
}

function safeLinks(value: unknown): AssistantLink[] {
  if (!Array.isArray(value)) return [];
  return value.filter((link): link is AssistantLink => (
    typeof link === "object" && link !== null &&
    typeof link.id === "string" && typeof link.label === "string" &&
    typeof link.href === "string" && /^#[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(link.href)
  )).slice(0, 4).map(link => ({ ...link, label: link.label.slice(0, 100) }));
}

export function PresentationAssistant() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retryMessages, setRetryMessages] = useState<RequestMessage[] | null>(null);

  function showAssistant(initialQuestion?: string) {
    if (initialQuestion) setQuestion(initialQuestion.slice(0, 2000));
    if (!dialogRef.current || dialogRef.current.open) return;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current.showModal();
    setOpen(true);
  }

  useEffect(() => {
    function handleOpen(event: Event) {
      const detail: unknown = (event as CustomEvent).detail;
      const initialQuestion = typeof detail === "object" && detail !== null && "question" in detail && typeof detail.question === "string" ? detail.question : undefined;
      if (initialQuestion) setQuestion(initialQuestion.slice(0, 2000));
      if (!dialogRef.current || dialogRef.current.open) return;
      restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialogRef.current.showModal();
      setOpen(true);
    }
    window.addEventListener("presentation-assistant:open", handleOpen);
    return () => {
      window.removeEventListener("presentation-assistant:open", handleOpen);
      requestRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    function fitViewport() {
      dialogRef.current?.style.setProperty("--assistant-viewport-height", `${viewport?.height ?? window.innerHeight}px`);
      dialogRef.current?.style.setProperty("--assistant-viewport-top", `${viewport?.offsetTop ?? 0}px`);
    }
    fitViewport();
    viewport?.addEventListener("resize", fitViewport);
    viewport?.addEventListener("scroll", fitViewport);
    return () => {
      viewport?.removeEventListener("resize", fitViewport);
      viewport?.removeEventListener("scroll", fitViewport);
    };
  }, [open]);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (open && transcript) transcript.scrollTop = transcript.scrollHeight;
  }, [messages, busy, error, open]);

  async function requestAnswer(payload: RequestMessage[]) {
    if (requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true);
    setError("");
    setRetryMessages(payload);
    let timedOut = false;
    const timer = window.setTimeout(() => { timedOut = true; controller.abort(); }, 60_000);
    try {
      const response = await fetch("/api/presentation-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payload }),
        signal: controller.signal,
      });
      if (!response.ok) {
        if (response.status === 429) throw new Error("Muitas perguntas em pouco tempo. Aguarde um instante e tente novamente.");
        throw new Error("Não consegui responder agora. Sua pergunta está preservada; tente novamente em instantes.");
      }
      const result: unknown = await response.json();
      if (typeof result !== "object" || result === null || !("answer" in result) || typeof result.answer !== "string" || !result.answer.trim()) {
        throw new Error("A resposta não chegou completa. Tente novamente.");
      }
      const content = result.answer.trim().slice(0, 12_000);
      const links = safeLinks("links" in result ? result.links : []);
      setMessages(current => [...current, { role: "assistant", content, links }]);
      setRetryMessages(null);
    } catch (cause) {
      if (controller.signal.aborted) {
        setError(timedOut ? "A resposta demorou mais que o esperado. Você pode tentar novamente." : "Resposta interrompida. Sua pergunta continua aqui para tentar novamente.");
      } else {
        setError(cause instanceof Error && !(cause instanceof TypeError) && !(cause instanceof SyntaxError) ? cause.message : "Não foi possível conectar ao assistente. Sua pergunta está preservada; tente novamente.");
      }
    } finally {
      window.clearTimeout(timer);
      if (requestRef.current === controller) {
        requestRef.current = null;
        setBusy(false);
      }
    }
  }

  function sendQuestion(content: string) {
    const cleanQuestion = content.trim().slice(0, 2000);
    if (!cleanQuestion || requestRef.current) return;
    const nextMessages: ConversationMessage[] = [...messages, { role: "user", content: cleanQuestion }];
    setMessages(nextMessages);
    setQuestion("");
    const payload: RequestMessage[] = [];
    let characters = 0;
    for (const message of nextMessages.slice(-12).reverse()) {
      const content = message.content.slice(0, 2000);
      if (characters + content.length > 16000) break;
      payload.unshift({ role: message.role, content }); characters += content.length;
    }
    void requestAnswer(payload);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendQuestion(question);
  }

  function closeAssistant() {
    dialogRef.current?.close();
  }

  function visitSection(href: string) {
    restoreFocusRef.current = null;
    closeAssistant();
    if (window.location.hash === href) window.dispatchEvent(new HashChangeEvent("hashchange"));
  }

  return <>
    <button type="button" className="presentation-assistant-launcher" aria-haspopup="dialog" aria-controls="presentation-assistant-dialog" aria-expanded={open} onClick={() => showAssistant()}>
      <span className="pa-launcher-icon"><MessageCircle size={24} aria-hidden="true"/><span>IA</span></span>
      <span><strong>Converse com a IA</strong><small>Respostas na hora, aqui no site</small></span>
      <ChevronRight size={17} aria-hidden="true"/>
    </button>

    <dialog ref={dialogRef} id="presentation-assistant-dialog" className="presentation-assistant-dialog" aria-labelledby="presentation-assistant-title" onClose={() => { setOpen(false); restoreFocusRef.current?.focus({ preventScroll: true }); }}>
      <header className="pa-header">
        <span className="pa-header-icon"><Sparkles size={23} aria-hidden="true"/></span>
        <div><h2 id="presentation-assistant-title">Converse com a IA</h2><p>Pergunte e receba a resposta aqui</p></div>
        <button type="button" className="pa-close" aria-label="Fechar assistente" onClick={closeAssistant} autoFocus><X size={21} aria-hidden="true"/></button>
      </header>

      <div ref={transcriptRef} className="pa-transcript" role="log" aria-label="Conversa com o assistente" aria-live="polite" aria-relevant="additions text">
        <div className="pa-welcome">
          <span className="pa-welcome-label"><ShieldCheck size={15} aria-hidden="true"/> Segurança, confiança e operação</span>
          <h3>Olá! Qual é a sua dúvida?</h3>
          <p>Sou o assistente de IA deste projeto. Respondo aqui, na conversa, sobre ferramentas, segurança e implantação.</p>
          <p>Pode perguntar, pedir um exemplo e aprofundar o assunto. Se me contar sua área, adapto a explicação para você.</p>
        </div>
        {messages.length === 0 && <div className="pa-suggestions" aria-label="Perguntas para começar">{suggestedQuestions.map(item => <button key={item.label} type="button" disabled={busy} onClick={() => sendQuestion(item.question)}>{item.label}<ArrowUpRight size={16} aria-hidden="true"/></button>)}</div>}
        {messages.map((message, index) => <article className={`pa-message pa-message-${message.role}`} key={index}>
          <span className="pa-message-author">{message.role === "user" ? "Você" : "Assistente IA"}</span>
          <div className="pa-message-text">{message.content.split(/\n\s*\n/).map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}</div>
          {message.links && message.links.length > 0 && <nav className="pa-answer-links" aria-label="Explore na apresentação">{message.links.map(link => <a href={link.href} key={link.id} onClick={() => visitSection(link.href)}>{link.label}<ArrowUpRight size={15} aria-hidden="true"/></a>)}</nav>}
        </article>)}
        {busy && <div className="pa-thinking" role="status"><LoaderCircle size={17} aria-hidden="true"/><span>Preparando sua resposta…</span></div>}
        {error && <div className="pa-error" role="alert"><p>{error}</p>{retryMessages && <button type="button" onClick={() => void requestAnswer(retryMessages)} disabled={busy}><RotateCcw size={15} aria-hidden="true"/> Tentar novamente</button>}</div>}
      </div>

      <footer className="pa-composer-wrap">
        <form className="pa-composer" onSubmit={submit}>
          <label htmlFor="presentation-assistant-question" className="pa-sr-only">Sua pergunta sobre o aplicativo</label>
          <textarea ref={textareaRef} id="presentation-assistant-question" value={question} onChange={event => setQuestion(event.target.value)} maxLength={2000} rows={2} placeholder="Escreva sua dúvida sobre o aplicativo…" enterKeyHint="enter" onKeyDown={event => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && !window.matchMedia("(max-width: 600px)").matches) { event.preventDefault(); sendQuestion(question); }
          }}/>
          {busy ? <button className="pa-send pa-stop" type="button" aria-label="Interromper resposta" title="Interromper resposta" onClick={() => requestRef.current?.abort()}><Square size={16} aria-hidden="true"/></button> : <button className="pa-send" type="submit" disabled={!question.trim()} aria-label="Enviar pergunta" title="Enviar pergunta"><Send size={18} aria-hidden="true"/></button>}
        </form>
        <p className="pa-privacy-note">Perguntas processadas pela OpenAI. Não envie dados pessoais ou operacionais.</p>
      </footer>
    </dialog>
  </>;
}
