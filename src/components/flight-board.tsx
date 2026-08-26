"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, CalendarDays, Check, ChevronDown, Clock3, Fuel, Gauge, LogOut, Menu, Plane, Plus, Search, ShieldCheck, UserRound, X } from "lucide-react";

type CheckValue = "pending" | "ok" | "no";
type Flight = {
  id: string; prefix: string; model: string; base: string; date: string; departure: string;
  duration: number; fuelAmount: number; fuel: CheckValue; preflight: CheckValue; hums: CheckValue;
  engineStart: CheckValue; shutdown: CheckValue; revision: number; acknowledged: Record<string, number>;
  createdBy: string; updatedBy: string;
};

const demoFlights: Flight[] = [
  { id: "1", prefix: "PR-OMN", model: "H145", base: "Jacarepaguá", date: "2026-08-26", departure: "09:40", duration: 1.5, fuelAmount: 620, fuel: "ok", preflight: "ok", hums: "ok", engineStart: "ok", shutdown: "pending", revision: 4, acknowledged: { "1024": 4 }, createdBy: "1048", updatedBy: "1024" },
  { id: "2", prefix: "PP-AZU", model: "S-76C++", base: "Macaé", date: "2026-08-26", departure: "11:20", duration: 2, fuelAmount: 780, fuel: "ok", preflight: "ok", hums: "pending", engineStart: "pending", shutdown: "pending", revision: 3, acknowledged: {}, createdBy: "1024", updatedBy: "1048" },
  { id: "3", prefix: "PR-LFT", model: "AW139", base: "Cabo Frio", date: "2026-08-26", departure: "07:10", duration: 1.2, fuelAmount: 690, fuel: "ok", preflight: "ok", hums: "ok", engineStart: "ok", shutdown: "ok", revision: 6, acknowledged: { "1024": 6 }, createdBy: "1031", updatedBy: "1031" },
];

const checkLabels = { fuel: "Abastecimento", preflight: "Pré-voo", hums: "HUMS", engineStart: "Acionamento", shutdown: "Corte" } as const;
type CheckKey = keyof typeof checkLabels;

function arrivalTime(flight: Pick<Flight, "departure" | "duration">) {
  const [hour, minute] = flight.departure.split(":").map(Number);
  const total = hour * 60 + minute + Math.round(flight.duration * 60);
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function flightStatus(flight: Flight, user: string) {
  if (flight.shutdown === "ok") return { key: "finished", label: "Voo encerrado", color: "#94a3b8" };
  if (flight.engineStart === "ok") return { key: "flying", label: "Em voo", color: "#22a06b" };
  if ((flight.acknowledged[user] ?? 0) >= flight.revision) return { key: "aware", label: "Ciente", color: "#2383e2" };
  return { key: "attention", label: "Aguardando ciência", color: "#f2b824" };
}

export function FlightBoard() {
  const [user, setUser] = useState("");
  const [login, setLogin] = useState("1024");
  const [password, setPassword] = useState("1234");
  const [loginError, setLoginError] = useState("");
  const [flights, setFlights] = useState<Flight[]>(demoFlights);
  const [hydrated, setHydrated] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({ date: "2026-08-26", base: "", model: "", prefix: "" });

  useEffect(() => {
    const restore = window.setTimeout(() => {
      const stored = localStorage.getItem("passagem-de-pista-flights");
      const storedUser = sessionStorage.getItem("passagem-de-pista-user");
      if (stored) setFlights(JSON.parse(stored));
      if (storedUser) setUser(storedUser);
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(restore);
  }, []);
  useEffect(() => { if (hydrated) localStorage.setItem("passagem-de-pista-flights", JSON.stringify(flights)); }, [flights, hydrated]);

  const options = useMemo(() => ({
    bases: [...new Set(flights.map((item) => item.base))], models: [...new Set(flights.map((item) => item.model))], prefixes: [...new Set(flights.map((item) => item.prefix))],
  }), [flights]);
  const visible = useMemo(() => flights.filter((item) =>
    (!filters.date || item.date === filters.date) && (!filters.base || item.base === filters.base) &&
    (!filters.model || item.model === filters.model) && (!filters.prefix || item.prefix === filters.prefix)
  ).sort((a, b) => `${b.date}${b.departure}`.localeCompare(`${a.date}${a.departure}`)), [flights, filters]);

  function enter(event: React.FormEvent) {
    event.preventDefault();
    if (!/^\d{3,10}$/.test(login) || password !== "1234") { setLoginError("Matrícula ou senha inválida. Para o teste, use 1024 e 1234."); return; }
    sessionStorage.setItem("passagem-de-pista-user", login); setUser(login);
  }
  function updateCheck(id: string, key: CheckKey, value: CheckValue) {
    setFlights((items) => items.map((flight) => {
      if (flight.id !== id || flight.shutdown === "ok") return flight;
      const revision = flight.revision + 1;
      return { ...flight, [key]: value, revision, updatedBy: user, acknowledged: { ...flight.acknowledged, [user]: revision } };
    }));
  }
  function acknowledge(id: string) { setFlights((items) => items.map((flight) => flight.id === id ? { ...flight, acknowledged: { ...flight.acknowledged, [user]: flight.revision } } : flight)); }

  if (!hydrated) return null;
  if (!user) return <LoginScreen login={login} password={password} error={loginError} setLogin={setLogin} setPassword={setPassword} onSubmit={enter} />;
  return (
    <div className="min-h-screen bg-[#f4f7fb]">
      <header className="sticky top-0 z-30 border-b border-[#dbe5f1] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center gap-4 px-4 sm:px-8">
          <button className="rounded-xl p-2 text-[#66768a] hover:bg-[#edf4fb] md:hidden" aria-label="Abrir menu"><Menu size={22} /></button>
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#1167d8] text-white shadow-[0_8px_20px_#1167d833]"><Plane size={21} /></div><div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#6480a0]">Operações aéreas</p><h1 className="text-lg font-bold tracking-[-.02em]">Passagem de Pista</h1></div></div>
          <div className="ml-auto flex items-center gap-2"><button className="relative rounded-xl border border-[#dce6f0] p-2.5 text-[#52677f] hover:bg-[#f2f7fc]" aria-label="Notificações"><Bell size={19} /><span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#f0b429] ring-2 ring-white" /></button><div className="desktop-only ml-2 flex items-center gap-3 border-l border-[#e1e8f0] pl-4"><div className="grid h-9 w-9 place-items-center rounded-full bg-[#dcebff] text-[#1769e0]"><UserRound size={18} /></div><div><p className="text-xs text-[#718197]">Matrícula</p><p className="text-sm font-bold">{user}</p></div></div><button onClick={() => { sessionStorage.removeItem("passagem-de-pista-user"); setUser(""); }} className="rounded-xl p-2.5 text-[#718197] hover:bg-[#edf4fb]" aria-label="Sair"><LogOut size={19} /></button></div>
        </div>
      </header>
      <main className="mx-auto max-w-[1440px] px-4 py-7 sm:px-8">
        <section className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-1 text-sm font-medium text-[#1769e0]">Visão operacional</p><h2 className="text-2xl font-bold tracking-[-.035em] sm:text-[30px]">Linha do tempo de voos</h2><p className="mt-1 text-sm text-[#6a7d93]">Acompanhe cada aeronave do pré-voo ao corte.</p></div><button onClick={() => setNewOpen(true)} className="flex h-11 items-center gap-2 rounded-xl bg-[#1268d8] px-4 text-sm font-bold text-white shadow-[0_8px_20px_#1268d833] transition hover:-translate-y-0.5 hover:bg-[#095cbf]"><Plus size={18} /> Lançar voo</button></section>
        <section className="mb-7 rounded-2xl border border-[#dce6f0] bg-white p-4 shadow-[0_8px_30px_#173b6210]"><button onClick={() => setFiltersOpen((value) => !value)} className="flex w-full items-center justify-between font-bold md:hidden"><span className="flex items-center gap-2"><Search size={17} /> Filtros</span><ChevronDown size={18} className={filtersOpen ? "rotate-180" : ""} /></button><div className={`${filtersOpen ? "grid" : "hidden"} mt-4 gap-3 md:mt-0 md:grid md:grid-cols-4`}><Filter label="Data" icon={<CalendarDays size={15} />}><input type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} /></Filter><Filter label="Base de operação"><select value={filters.base} onChange={(e) => setFilters({ ...filters, base: e.target.value })}><option value="">Todas as bases</option>{options.bases.map((value) => <option key={value}>{value}</option>)}</select></Filter><Filter label="Modelo"><select value={filters.model} onChange={(e) => setFilters({ ...filters, model: e.target.value })}><option value="">Todos os modelos</option>{options.models.map((value) => <option key={value}>{value}</option>)}</select></Filter><Filter label="Prefixo"><select value={filters.prefix} onChange={(e) => setFilters({ ...filters, prefix: e.target.value })}><option value="">Todos os prefixos</option>{options.prefixes.map((value) => <option key={value}>{value}</option>)}</select></Filter></div></section>
        <div className="mb-4 flex items-center justify-between"><p className="text-sm font-semibold text-[#52677f]">{visible.length} {visible.length === 1 ? "voo encontrado" : "voos encontrados"}</p><StatusLegend /></div>
        <section className="relative grid gap-5 pb-12 lg:grid-cols-2">{visible.map((flight, index) => <FlightCard key={flight.id} flight={flight} user={user} index={index} onCheck={updateCheck} onAcknowledge={acknowledge} />)}{visible.length === 0 ? <div className="col-span-full rounded-2xl border border-dashed border-[#becddd] bg-white px-6 py-16 text-center"><Plane className="mx-auto mb-3 text-[#9bb0c7]" /><h3 className="font-bold">Nenhum voo encontrado</h3><p className="mt-1 text-sm text-[#718197]">Ajuste os filtros ou lance um novo voo.</p></div> : null}</section>
      </main>
      {newOpen ? <NewFlightModal user={user} onClose={() => setNewOpen(false)} onCreate={(flight) => { setFlights((items) => [flight, ...items]); setNewOpen(false); setFilters((current) => ({ ...current, date: flight.date })); }} /> : null}
    </div>
  );
}

function LoginScreen({ login, password, error, setLogin, setPassword, onSubmit }: { login: string; password: string; error: string; setLogin: (value: string) => void; setPassword: (value: string) => void; onSubmit: (event: React.FormEvent) => void }) {
  return <main className="grid min-h-screen place-items-center bg-[#edf4fb] p-5"><div className="grid w-full max-w-[980px] overflow-hidden rounded-[28px] bg-white shadow-[0_30px_90px_#0b234224] md:grid-cols-[1.05fr_.95fr]"><section className="hidden min-h-[610px] flex-col justify-between bg-[#0d315e] p-12 text-white md:flex"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-white/12"><Plane /></div><span className="font-bold">Passagem de Pista</span></div><div><p className="mb-4 text-xs font-bold uppercase tracking-[.22em] text-[#7db4f7]">Consciência situacional</p><h1 className="max-w-md text-4xl font-bold leading-tight tracking-[-.04em]">Cada voo, cada ação, todos na mesma página.</h1><p className="mt-5 max-w-md leading-relaxed text-[#bdd3ec]">Acompanhe o trilho operacional das aeronaves em tempo real, do abastecimento ao corte.</p></div><div className="flex gap-6 text-xs text-[#9ebcdd]"><span className="flex items-center gap-2"><ShieldCheck size={16} /> Registro por matrícula</span><span className="flex items-center gap-2"><Gauge size={16} /> Status ao vivo</span></div></section><section className="flex flex-col justify-center p-8 sm:p-12"><div className="mb-8 md:hidden"><div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-[#1268d8] text-white"><Plane /></div></div><p className="text-sm font-bold text-[#1769e0]">Bem-vindo</p><h2 className="mt-1 text-3xl font-bold tracking-[-.04em]">Acesse a operação</h2><p className="mt-2 text-sm text-[#718197]">Entre com sua matrícula funcional.</p><form onSubmit={onSubmit} className="mt-8 space-y-4"><label className="block"><span className="mb-2 block text-sm font-semibold">Matrícula</span><div className="flex items-center rounded-xl border border-[#cedae8] px-3 focus-within:border-[#1769e0] focus-within:ring-4 focus-within:ring-[#1769e014]"><UserRound size={17} className="text-[#8192a5]" /><input autoFocus inputMode="numeric" value={login} onChange={(e) => setLogin(e.target.value)} className="h-12 w-full bg-transparent px-3 outline-none" placeholder="Ex.: 1024" /></div></label><label className="block"><span className="mb-2 block text-sm font-semibold">Senha</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 w-full rounded-xl border border-[#cedae8] px-4 outline-none focus:border-[#1769e0] focus:ring-4 focus:ring-[#1769e014]" /></label>{error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}<button className="h-12 w-full rounded-xl bg-[#1268d8] font-bold text-white hover:bg-[#095cbf]">Entrar</button></form><p className="mt-6 rounded-xl bg-[#f2f7fc] p-3 text-center text-xs text-[#63768c]">Ambiente de teste: matrícula <strong>1024</strong> · senha <strong>1234</strong></p></section></div></main>;
}

function Filter({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) { return <label><span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-[#64788e]">{icon}{label}</span><div className="[&>input]:h-10 [&>input]:w-full [&>input]:rounded-lg [&>input]:border [&>input]:border-[#d6e1ec] [&>input]:bg-white [&>input]:px-3 [&>input]:text-sm [&>input]:outline-none [&>select]:h-10 [&>select]:w-full [&>select]:rounded-lg [&>select]:border [&>select]:border-[#d6e1ec] [&>select]:bg-white [&>select]:px-3 [&>select]:text-sm [&>select]:outline-none">{children}</div></label>; }
function StatusLegend() { return <div className="desktop-only flex items-center gap-4 text-[11px] font-semibold text-[#718197]">{[["#f2b824", "Atenção"], ["#2383e2", "Ciente"], ["#22a06b", "Em voo"], ["#94a3b8", "Encerrado"]].map(([color, label]) => <span key={label} className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{label}</span>)}</div>; }

function FlightCard({ flight, user, index, onCheck, onAcknowledge }: { flight: Flight; user: string; index: number; onCheck: (id: string, key: CheckKey, value: CheckValue) => void; onAcknowledge: (id: string) => void }) {
  const status = flightStatus(flight, user); const locked = status.key === "finished";
  return <article className="animate-rise overflow-hidden rounded-2xl border bg-white shadow-[0_10px_35px_#173b6210]" style={{ borderColor: status.color, borderLeftWidth: 5, animationDelay: `${index * 60}ms` }}><div className="flex items-start justify-between gap-3 border-b border-[#e6edf4] p-5"><div className="flex gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-[#edf5ff] text-[#1769e0]"><Plane size={21} /></div><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-mono text-xl font-bold tracking-[-.02em]">{flight.prefix}</h3><span className="rounded-md bg-[#edf2f7] px-2 py-1 text-[10px] font-bold text-[#607388]">{flight.model}</span></div><p className="mt-1 text-xs text-[#718197]">{flight.base}</p></div></div><span className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ color: status.color, backgroundColor: `${status.color}18` }}><i className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: status.color }} />{status.label}</span></div><div className="grid grid-cols-3 border-b border-[#e6edf4] bg-[#fafcff] px-5 py-3 text-xs"><div><span className="block text-[#7d8da0]">Data e saída</span><strong className="mt-1 flex items-center gap-1.5"><CalendarDays size={13} />{flight.date.split("-").reverse().join("/")} · {flight.departure}</strong></div><div><span className="block text-[#7d8da0]">Tempo previsto</span><strong className="mt-1 flex items-center gap-1.5"><Clock3 size={13} />{flight.duration.toLocaleString("pt-BR")}h</strong></div><div><span className="block text-[#7d8da0]">Pouso previsto</span><strong className="mt-1 flex items-center gap-1.5"><Plane size={13} className="rotate-90" />{arrivalTime(flight)}</strong></div></div><div className="p-5"><div className="mb-3 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[.12em] text-[#73869a]">Checklist operacional</p><span className="flex items-center gap-1 text-xs font-semibold text-[#566c84]"><Fuel size={14} />{flight.fuelAmount} L</span></div><div className="grid gap-2 sm:grid-cols-2">{(Object.keys(checkLabels) as CheckKey[]).map((key) => <CheckRow key={key} label={checkLabels[key]} value={flight[key]} disabled={locked} onChange={(value) => onCheck(flight.id, key, value)} full={key === "shutdown"} />)}</div></div><footer className="flex items-center justify-between gap-3 border-t border-[#e6edf4] bg-[#fbfcfe] px-5 py-3"><p className="text-[11px] text-[#7b8b9d]">Última ação: matrícula <strong>{flight.updatedBy}</strong></p>{status.key === "attention" ? <button onClick={() => onAcknowledge(flight.id)} className="flex items-center gap-1.5 rounded-lg bg-[#fff7dd] px-3 py-2 text-xs font-bold text-[#926b00] hover:bg-[#ffefb8]"><Check size={14} /> Marcar ciência</button> : <span className="flex items-center gap-1 text-xs font-semibold text-[#63778e]"><Check size={14} /> Atualizado</span>}</footer></article>;
}

function CheckRow({ label, value, disabled, onChange, full }: { label: string; value: CheckValue; disabled: boolean; onChange: (value: CheckValue) => void; full?: boolean }) { return <div className={`flex items-center justify-between rounded-xl border border-[#e1e9f1] p-2.5 ${full ? "sm:col-span-2" : ""}`}><span className="text-xs font-semibold">{label}</span><div className="flex gap-1"><button disabled={disabled} onClick={() => onChange("ok")} className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold transition ${value === "ok" ? "bg-[#daf5e8] text-[#13764a] ring-1 ring-[#96d8b9]" : "bg-[#f1f4f7] text-[#728397] hover:bg-[#e5ebf1]"}`}>OK</button><button disabled={disabled} onClick={() => onChange("no")} className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold transition ${value === "no" ? "bg-[#fee8e8] text-[#b42318] ring-1 ring-[#efb1ad]" : "bg-[#f1f4f7] text-[#728397] hover:bg-[#e5ebf1]"}`}>NO</button></div></div>; }

function NewFlightModal({ user, onClose, onCreate }: { user: string; onClose: () => void; onCreate: (flight: Flight) => void }) {
  const now = new Date(); const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const [form, setForm] = useState({ prefix: "", model: "H145", base: "Jacarepaguá", date: localDate, departure: now.toTimeString().slice(0, 5), duration: "1.5", fuelAmount: "0" });
  function submit(event: React.FormEvent) { event.preventDefault(); onCreate({ id: crypto.randomUUID(), ...form, prefix: form.prefix.toUpperCase(), duration: Number(form.duration), fuelAmount: Number(form.fuelAmount), fuel: "pending", preflight: "pending", hums: "pending", engineStart: "pending", shutdown: "pending", revision: 1, acknowledged: { [user]: 1 }, createdBy: user, updatedBy: user }); }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#071a30]/60 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><div role="dialog" aria-modal="true" aria-labelledby="new-flight-title" className="animate-rise w-full max-w-xl rounded-2xl bg-white shadow-2xl"><header className="flex items-start justify-between border-b border-[#e0e8f0] p-5"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#1769e0]">Novo registro</p><h2 id="new-flight-title" className="mt-1 text-xl font-bold">Lançar voo</h2></div><button onClick={onClose} className="rounded-lg p-2 text-[#6f8194] hover:bg-[#edf3f8]" aria-label="Fechar"><X size={20} /></button></header><form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2"><ModalField label="Prefixo"><input required placeholder="PR-XXX" value={form.prefix} onChange={(e) => setForm({ ...form, prefix: e.target.value })} /></ModalField><ModalField label="Modelo"><select value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })}><option>H145</option><option>AW139</option><option>S-76C++</option><option>H225</option></select></ModalField><ModalField label="Base de operação"><select value={form.base} onChange={(e) => setForm({ ...form, base: e.target.value })}><option>Jacarepaguá</option><option>Macaé</option><option>Cabo Frio</option><option>Vitória</option></select></ModalField><ModalField label="Data"><input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></ModalField><ModalField label="Hora do voo"><input required type="time" value={form.departure} onChange={(e) => setForm({ ...form, departure: e.target.value })} /></ModalField><ModalField label="Tempo previsto (horas)"><input required type="number" min="0.1" step="0.1" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} /></ModalField><ModalField label="Abastecimento (litros)" full><input required type="number" min="0" value={form.fuelAmount} onChange={(e) => setForm({ ...form, fuelAmount: e.target.value })} /></ModalField><footer className="mt-2 flex justify-end gap-2 border-t border-[#e3eaf1] pt-4 sm:col-span-2"><button type="button" onClick={onClose} className="rounded-xl border border-[#d5e0eb] px-4 py-2.5 text-sm font-bold text-[#5d7187]">Cancelar</button><button className="flex items-center gap-2 rounded-xl bg-[#1268d8] px-4 py-2.5 text-sm font-bold text-white"><Plus size={16} /> Criar card</button></footer></form></div></div>;
}
function ModalField({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) { return <label className={full ? "sm:col-span-2" : ""}><span className="mb-1.5 block text-xs font-bold text-[#5d7187]">{label}</span><div className="[&>input]:h-11 [&>input]:w-full [&>input]:rounded-xl [&>input]:border [&>input]:border-[#cedbe7] [&>input]:px-3 [&>input]:outline-none [&>select]:h-11 [&>select]:w-full [&>select]:rounded-xl [&>select]:border [&>select]:border-[#cedbe7] [&>select]:bg-white [&>select]:px-3 [&>select]:outline-none">{children}</div></label>; }
