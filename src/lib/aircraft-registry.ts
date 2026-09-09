export type AircraftRegistryData = {
  manufacturer: string;
  registeredModel: string;
  serialNumber: string;
  manufactureYear: string;
  sourceUrl: string;
  consultedAt: string;
  reviewStatus: "pending";
  importedAt?: string;
  importedBy?: string;
};

// Snapshot transcribed from the official RAB technical-details tab, by prefix.
// It describes registration identity, not current configuration or airworthiness.
const rows = [
  ["PR-CGO", "LEONARDO S.P.A", "AW139", "31498", "2013"],
  ["PR-CHT", "SIKORSKY AIRCRAFT", "S-92A", "920119", "2009"],
  ["PR-OHD", "AGUSTA", "AW139", "41306", "2013"],
  ["PR-OHG", "SIKORSKY AIRCRAFT", "S-92A", "920187", "2013"],
  ["PR-OHI", "SIKORSKY AIRCRAFT", "S-92A", "920184", "2013"],
  ["PR-OHJ", "AGUSTA", "AW139", "41335", "2013"],
  ["PR-OHK", "SIKORSKY AIRCRAFT", "S-92A", "920137", "2010"],
  ["PR-OHL", "AGUSTA", "AW139", "41337", "2013"],
  ["PR-OOR", "LEONARDO S.P.A", "AW189", "89022", "2024"],
  ["PR-OOV", "LEONARDO S.P.A", "AW139", "41599", "2024"],
  ["PR-OTH", "LEONARDO S.P.A", "AW139", "41574", "2021"],
] as const;

export function normalizeRegistration(prefix: string) {
  return prefix.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export const aircraftRegistrySnapshot: Readonly<Record<string, AircraftRegistryData>> = Object.fromEntries(
  rows.map(([prefix, manufacturer, registeredModel, serialNumber, manufactureYear]) => [normalizeRegistration(prefix), {
    manufacturer, registeredModel, serialNumber, manufactureYear,
    sourceUrl: `https://aeronaves.anac.gov.br/aeronaves/?tipo_pesquisa=marcas&textMarca=${prefix}`,
    consultedAt: "2026-09-09",
    reviewStatus: "pending" as const,
  }]),
);

export function registryModelMatches(model: string, registeredModel: string) {
  const normalize = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const app = normalize(model);
  const rab = normalize(registeredModel);
  return app === rab || (app === "S92" && rab === "S92A");
}

export function importAircraftRegistry<T extends { prefix: string; registryData?: AircraftRegistryData }>(
  aircraft: T[], importedBy: string, importedAt: string,
): T[] {
  return aircraft.map((plane) => {
    const data = aircraftRegistrySnapshot[normalizeRegistration(plane.prefix)];
    // Preserve existing technical records and every operational field.
    if (plane.registryData || !data) return plane;
    return { ...plane, registryData: { ...data, importedAt, importedBy } };
  });
}
