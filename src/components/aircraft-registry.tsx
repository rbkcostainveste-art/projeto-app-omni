"use client";

import { useState } from "react";
import { missingOmniAircraft } from "@/lib/omni-fleet-import";
import { aircraftRegistrySnapshot, normalizeRegistration, registryModelMatches, type AircraftRegistryData } from "@/lib/aircraft-registry";

export function AircraftRegistry({ aircraft, onImport, onImportFleet }: {
  aircraft: { prefix: string; model: string; registryData?: AircraftRegistryData }[];
  onImport: () => void;
  onImportFleet: () => void;
}) {
  const [filter, setFilter] = useState("");
  const importable = aircraft.filter((plane) => !plane.registryData && aircraftRegistrySnapshot[normalizeRegistration(plane.prefix)]).length;
  const imported = aircraft.filter((plane) => plane.registryData).length;
  const missing = missingOmniAircraft(aircraft).length;
  const visible = aircraft.filter((plane) => normalizeRegistration(plane.prefix).includes(normalizeRegistration(filter)));

  return <details className="rounded-xl border border-[#dce6f0] p-4 md:col-span-2">
    <summary className="cursor-pointer font-bold">Aeronaves · dados técnicos ANAC ({imported}/{aircraft.length})</summary>
    <p className="mt-3 text-sm text-slate-600">Fabricante, modelo de registro, série e ano consultados no RAB em 09/09/2026. Revisão documental da empresa pendente.</p>
    <p className="mt-2 text-xs text-slate-500">Para aplicar manuais, ainda será necessário verificar configuração, modificações e efetividade. Estes dados não indicam liberação para voo.</p>
    <button type="button" disabled={!importable} onClick={onImport} className="mt-3 rounded-lg bg-[#1268d8] px-4 py-2 text-sm font-bold text-white disabled:bg-slate-200 disabled:text-slate-500">
      {importable ? `Cadastrar dados públicos de ${importable} aeronaves` : "Nenhum dado novo para cadastrar"}
    </button>
    {missing > 0 && <div className="mt-3 rounded-lg bg-blue-50 p-3 text-sm">
      <p>Relação pública da Omni: {missing} aeronaves ainda não cadastradas. Serão incluídas como disponíveis, com base A definir. Os cadastros existentes serão preservados.</p>
      <button type="button" onClick={onImportFleet} className="mt-2 rounded-lg bg-[#1268d8] px-4 py-2 font-bold text-white">Cadastrar {missing} aeronaves da Omni</button>
    </div>}
    <label className="mt-4 block text-xs font-semibold text-slate-600">Buscar dados técnicos por prefixo
      <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="PR-OHK" className="mt-1 block h-10 w-full rounded-lg border border-slate-300 px-3 text-sm uppercase" />
    </label>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {visible.map((plane) => {
        const data = plane.registryData ?? aircraftRegistrySnapshot[normalizeRegistration(plane.prefix)];
        const conflict = data && !registryModelMatches(plane.model, data.registeredModel);
        return <article key={plane.prefix} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <h4 className="font-bold">{plane.prefix}</h4>
          {!data ? <p className="mt-2 text-xs text-slate-500">Consulta pública ainda não realizada para este prefixo.</p> : <>
            <p className="mt-1 text-xs font-semibold text-amber-800">{plane.registryData ? "Cadastrado · revisão documental pendente" : "Prévia · ainda não cadastrado"}</p>
            <dl className="mt-3 space-y-1 text-sm">
              <div><dt className="inline text-slate-500">Fabricante: </dt><dd className="inline">{data.manufacturer}</dd></div>
              <div><dt className="inline text-slate-500">Modelo ANAC: </dt><dd className="inline">{data.registeredModel}</dd></div>
              <div><dt className="inline text-slate-500">Número de série: </dt><dd className="inline font-semibold">{data.serialNumber}</dd></div>
              <div><dt className="inline text-slate-500">Ano: </dt><dd className="inline">{data.manufactureYear}</dd></div>
              {data.rabStatus && <div><dt className="inline text-slate-500">Código no RAB: </dt><dd className="inline">{data.rabStatus}</dd></div>}
            </dl>
            {data.rabStatus && !data.rabStatus.startsWith("N") && <p className="mt-2 text-xs font-semibold text-amber-800">O RAB informa restrição cadastral. Confira a fonte; a disponibilidade no aplicativo foi definida separadamente.</p>}
            {conflict && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs font-semibold text-amber-900">Divergência de modelo: aplicativo {plane.model}; ANAC {data.registeredModel}. Conferir antes de usar em consultas técnicas.</p>}
            <a href={data.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-xs font-semibold text-blue-700 underline">Consultar fonte ANAC · {data.consultedAt.split("-").reverse().join("/")}</a>
          </>}
        </article>;
      })}
      {!visible.length && <p className="text-sm text-slate-500">Nenhuma aeronave encontrada.</p>}
    </div>
  </details>;
}
