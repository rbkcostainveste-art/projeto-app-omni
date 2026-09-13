"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Mic, Send, X } from "lucide-react";

type Props = {
  disabled: boolean;
  onSend: (file: File) => Promise<void>;
  onError: (message: string) => void;
  onActiveChange: (active: boolean) => void;
};

function recordingType() {
  const choices = ["audio/mp4", "audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm"];
  return choices.find(type => MediaRecorder.isTypeSupported(type)) || "";
}

function recordingFile(chunks: Blob[], mimeType: string) {
  const type = mimeType || chunks[0]?.type || "audio/webm";
  const extension = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
  return new File(chunks, `pergunta-${Date.now()}.${extension}`, { type });
}

export function PresentationAssistantVoice({ disabled, onSend, onError, onActiveChange }: Props) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const sendAfterStopRef = useRef(false);
  const cancelledRef = useRef(false);
  const mountedRef = useRef(true);
  const [state, setState] = useState<"idle" | "starting" | "recording" | "sending">("idle");
  const [seconds, setSeconds] = useState(0);

  function finish() {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }

  function cancel() {
    cancelledRef.current = true;
    sendAfterStopRef.current = false;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    else finish();
    setState("idle");
    onActiveChange(false);
  }

  function sendRecording() {
    if (state !== "recording" || recorderRef.current?.state !== "recording") return;
    sendAfterStopRef.current = true;
    recorderRef.current.stop();
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelledRef.current = true;
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      finish();
    };
  }, []);

  useEffect(() => {
    if (state !== "recording") return;
    const timer = window.setInterval(() => setSeconds(current => Math.min(current + 1, 89)), 1000);
    const limit = window.setTimeout(() => {
      setSeconds(90);
      sendAfterStopRef.current = true;
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    }, 90_000);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(limit);
    };
  }, [state]);

  useEffect(() => {
    if (state !== "recording") return;
    function sendWithEnter(event: KeyboardEvent) {
      if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || event.isComposing || event.repeat) return;
      if (event.target instanceof HTMLButtonElement) return;
      event.preventDefault();
      sendAfterStopRef.current = true;
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    }
    window.addEventListener("keydown", sendWithEnter);
    return () => window.removeEventListener("keydown", sendWithEnter);
  }, [state]);

  async function start() {
    if (disabled || state !== "idle") return;
    onError("");
    onActiveChange(true);
    setState("starting");
    setSeconds(0);
    cancelledRef.current = false;
    sendAfterStopRef.current = false;
    chunksRef.current = [];
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw Error("Este navegador não permite gravar mensagens de voz.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (!mountedRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
      streamRef.current = stream;
      const mimeType = recordingType();
      const recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 64_000 });
      recorderRef.current = recorder;
      recorder.ondataavailable = event => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onerror = () => {
        cancelledRef.current = true;
        finish();
        if (mountedRef.current) {
          setState("idle");
          onActiveChange(false);
          onError("Não foi possível concluir a gravação. Tente novamente.");
        }
      };
      recorder.onstop = () => {
        const shouldSend = sendAfterStopRef.current && !cancelledRef.current;
        const file = recordingFile(chunksRef.current, recorder.mimeType);
        finish();
        if (!mountedRef.current) return;
        if (!shouldSend) { setState("idle"); onActiveChange(false); return; }
        if (!file.size || file.size > 3 * 1024 * 1024) {
          setState("idle"); onActiveChange(false);
          onError("A mensagem ficou muito longa. Grave um áudio menor.");
          return;
        }
        setState("sending");
        void onSend(file).catch(cause => {
          if (mountedRef.current) onError(cause instanceof Error ? cause.message : "Não consegui enviar a mensagem de voz.");
        }).finally(() => {
          if (mountedRef.current) { setState("idle"); onActiveChange(false); }
        });
      };
      recorder.start(750);
      setState("recording");
    } catch (cause) {
      finish();
      setState("idle");
      onActiveChange(false);
      const denied = cause instanceof DOMException && cause.name === "NotAllowedError";
      onError(denied ? "Permita o acesso ao microfone para enviar uma mensagem de voz." : cause instanceof Error ? cause.message : "Microfone indisponível.");
    }
  }

  if (state === "idle") return <button type="button" className="pa-voice-start" disabled={disabled} onClick={() => void start()} aria-label="Gravar mensagem de voz" title="Gravar mensagem de voz"><Mic size={19} aria-hidden="true"/></button>;
  return <div className="pa-voice-active">
    {state === "recording" ? <>
      <button type="button" className="pa-voice-cancel" onClick={cancel} aria-label="Cancelar mensagem de voz" title="Cancelar"><X size={18} aria-hidden="true"/></button>
      <span role="status"><i aria-hidden="true"/>Gravando · {seconds}s <small>Enter envia</small></span>
      <button type="button" className="pa-voice-send" onClick={sendRecording} aria-label="Enviar mensagem de voz" aria-keyshortcuts="Enter" title="Enviar · Enter"><Send size={18} aria-hidden="true"/></button>
    </> : <span role="status" className="pa-voice-processing"><LoaderCircle size={17} aria-hidden="true"/>{state === "starting" ? "Abrindo o microfone…" : "Ouvindo sua mensagem…"}</span>}
  </div>;
}
