"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Bell, X } from "lucide-react";

export type ScreenNotification = { id: string; title: string; description: string; at: string };
type Feed = { scope: string; items: ScreenNotification[]; open: (id: string) => void };
type Publisher = (source: string, feed: Feed | null) => void;
const PublisherContext = createContext<{ scope: string; publish: Publisher } | null>(null);
const FeedsContext = createContext<Record<string, Feed>>({});

// A feed belongs to both the signed-in identity and the currently mounted screen.
export function ScreenNotificationsProvider({ scope, children }: { scope: string; children: ReactNode }) {
  const [feeds, setFeeds] = useState<Record<string, Feed>>({});
  const publish = useCallback<Publisher>((source, feed) => setFeeds(previous => {
    const next = { ...previous };
    if (feed) next[source] = feed;
    else delete next[source];
    return next;
  }), []);
  const context = useMemo(() => ({ scope, publish }), [scope, publish]);
  return <PublisherContext.Provider value={context}><FeedsContext.Provider value={feeds}>{children}</FeedsContext.Provider></PublisherContext.Provider>;
}

export function useScreenNotifications(source: string, items: ScreenNotification[], onOpen: (id: string) => void) {
  const context = useContext(PublisherContext);
  const handler = useRef(onOpen);
  useEffect(() => { handler.current = onOpen; });
  // Compare the data, not array/callback identity: screens may derive these on each render.
  const serialized = JSON.stringify(items);
  const publish = context?.publish;
  const scope = context?.scope;
  useEffect(() => {
    if (!publish || !scope) return;
    publish(source, { scope, items: JSON.parse(serialized), open: id => handler.current(id) });
    return () => publish(source, null);
  }, [publish, scope, source, serialized]);
}

export function ScreenNotificationFeed({ items, onOpen }: { items: ScreenNotification[]; onOpen: (id: string) => void }) {
  useScreenNotifications("flights", items, onOpen);
  return null;
}

export function ScreenNotificationBell({ onToggle }: { onToggle?: () => void }) {
  const context = useContext(PublisherContext);
  const feeds = useContext(FeedsContext);
  const scope = context?.scope ?? "";
  return <ScopedNotificationBell key={scope} scope={scope} feeds={feeds} onToggle={onToggle}/>;
}

function ScopedNotificationBell({scope, feeds, onToggle}: {scope:string; feeds:Record<string,Feed>; onToggle?:()=>void}) {
  const root = useRef<HTMLDivElement>(null);
  const [openScope, setOpenScope] = useState<string | null>(null);
  const storageKey = `flight-ia-screen-notifications:${scope}`;
  const [seen, setSeen] = useState<{scope:string;ids:string[]}>(() => {
    let ids: string[] = [];
    try { const stored = JSON.parse(localStorage.getItem(storageKey) ?? "[]"); if (Array.isArray(stored)) ids = stored.filter(id => typeof id === "string"); } catch { /* Storage is optional, including server rendering. */ }
    return {scope, ids};
  });
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpenScope(null); };
    const escape = (event: KeyboardEvent) => { if(event.key === "Escape") setOpenScope(null); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, []);
  const items = Object.entries(feeds).filter(([, feed]) => feed.scope === scope).flatMap(([source, feed]) => feed.items.map(item => ({ ...item, key: `${source}:${item.id}`, open: () => feed.open(item.id) }))).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const unread = items.filter(item => seen.scope === scope && !seen.ids.includes(item.key)).length;
  const open = openScope === scope;
  function toggle() {
    onToggle?.();
    setOpenScope(open ? null : scope);
    if (!open) {
      const ids = [...new Set([...(seen.scope === scope ? seen.ids : []), ...items.map(item => item.key)])].slice(-1000);
      setSeen({ scope, ids });
      try { localStorage.setItem(storageKey, JSON.stringify(ids)); } catch { /* Keep in-memory read state. */ }
    }
  }
  return <div ref={root} className="relative"><button onClick={toggle} aria-label={`Notificações desta tela: ${unread} novas`} aria-expanded={open} className="relative grid h-11 w-11 place-items-center rounded-xl bg-white/15 text-white transition hover:bg-white/25"><Bell size={20}/>{unread ? <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#ffd452] px-1 text-[10px] font-black text-[#3c2b00]">{Math.min(unread, 99)}</span> : null}</button>{open ? <aside aria-label="Notificações desta tela" className="absolute right-0 top-14 z-50 max-h-[65dvh] w-[min(360px,90vw)] overflow-auto rounded-2xl border bg-white p-3 text-[#17324d] shadow-2xl"><header className="mb-2 flex items-center justify-between"><strong>Notificações desta tela</strong><button onClick={() => setOpenScope(null)} aria-label="Fechar notificações" className="p-2"><X size={18}/></button></header>{items.slice(0, 50).map(item => <button key={item.key} onClick={() => { setOpenScope(null); item.open(); }} className="block w-full rounded-xl p-3 text-left hover:bg-blue-50"><strong className="block text-sm">{item.title}</strong><span className="block text-xs text-slate-600">{item.description}</span><small className="text-slate-500">{new Date(item.at).toLocaleString("pt-BR")}</small></button>)}{!items.length ? <p className="p-5 text-center text-sm text-slate-500">Nenhuma notificação para você nesta tela.</p> : null}</aside> : null}</div>;
}
