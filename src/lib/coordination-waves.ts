type WaveFlight = { id?: string | number; prefix: string; maintenancePostId?:string; date: string; departure: string; wave?: number; planningStatus?: string; cancelled?: boolean; deletedAt?: string; shutdown?: string; actualShutdown?: string | null; operationEndedAt?: string };

export function operationalWaves<T extends WaveFlight>(flights: T[], date: string) {
  const groups = new Map<number, T[]>();
  const counts = new Map<string, number>();
  const daily = flights.filter(flight => !flight.maintenancePostId && flight.date === date
    && flight.planningStatus && !flight.cancelled && !flight.deletedAt)
    .sort((a, b) => a.departure.localeCompare(b.departure)
      || (a.wave ?? 1) - (b.wave ?? 1) || String(a.id ?? '').localeCompare(String(b.id ?? '')));
  for (const flight of daily) {
    // Persisted wave numbers may belong to the aircraft a flight was copied from.
    // Completed flights still occupy their sequence, but no longer show in planning.
    const wave = (counts.get(flight.prefix) ?? 0) + 1;
    counts.set(flight.prefix, wave);
    if (flight.shutdown === 'ok' || flight.actualShutdown || flight.operationEndedAt) continue;
    groups.set(wave, [...(groups.get(wave) ?? []), flight]);
  }
  return [...groups].sort(([a], [b]) => a - b).map(([wave, items]) => ({ date, wave, items: items.sort((a, b) => a.departure.localeCompare(b.departure)) }));
}
