import rows from "./omni-fleet-snapshot.json";
import { normalizeRegistration, type AircraftRegistryData } from "./aircraft-registry";

type Plane = { prefix: string; model: string; base: string; available?: boolean; registryData?: AircraftRegistryData };
export function missingOmniAircraft(aircraft: { prefix: string }[]) {
  const existing = new Set(aircraft.map(p => normalizeRegistration(p.prefix)));
  return rows.filter(p => !existing.has(normalizeRegistration(p.prefix)));
}

export function importOmniFleet<T extends { aircraft: Plane[]; models: string[]; bases: string[] }>(catalogs: T, user: string, at: string): T {
  const aliases: Record<string, string> = { "S-92A": "S92", "EC175 B": "H175" };
  const additions = missingOmniAircraft(catalogs.aircraft).map(row => ({
    prefix: row.prefix, model: aliases[row.registeredModel] ?? row.registeredModel,
    base: "A definir", available: true,
    availabilityUpdatedBy: user,
    registryData: {
      ...row, sourceUrl: `https://aeronaves.anac.gov.br/aeronaves/?tipo_pesquisa=marcas&textMarca=${row.prefix}`,
      datasetUrl: "https://sistemas.anac.gov.br/dadosabertos/Aeronaves/RAB/dados_aeronaves.json",
      consultedAt: "2026-09-09", reviewStatus: "pending" as const, importedAt: at, importedBy: user,
    },
  }));
  if (!additions.length) return catalogs;
  return { ...catalogs,
    aircraft: [...catalogs.aircraft, ...additions].sort((a,b) => a.prefix.localeCompare(b.prefix)),
    models: [...new Set([...catalogs.models, ...additions.map(p => p.model)])],
    bases: [...new Set([...catalogs.bases, "A definir"])],
  };
}
