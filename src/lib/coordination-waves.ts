type WaveFlight = { date: string; departure: string; wave?: number; planningStatus?: string; cancelled?: boolean; deletedAt?: string; shutdown?: string; actualShutdown?: string | null; operationEndedAt?: string };

export function operationalWaves<T extends WaveFlight>(flights: T[], date: string) {
  const groups = new Map<number, T[]>();
  for (const flight of flights) {
    if (flight.date !== date || !flight.planningStatus || flight.cancelled || flight.deletedAt || flight.shutdown === 'ok' || flight.actualShutdown || flight.operationEndedAt) continue;
    const wave = flight.wave ?? 1;
    groups.set(wave, [...(groups.get(wave) ?? []), flight]);
  }
  return [...groups].sort(([a], [b]) => a - b).map(([wave, items]) => ({ date, wave, items: items.sort((a, b) => a.departure.localeCompare(b.departure)) }));
}
