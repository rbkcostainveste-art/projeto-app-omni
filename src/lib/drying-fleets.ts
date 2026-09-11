const key = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();

export function authorizedDryingFleets(fleets: string[]) {
  const unique = new Map<string, string>();
  for (const fleet of fleets) if (key(fleet) && !unique.has(key(fleet))) unique.set(key(fleet), fleet.trim());
  return [...unique.values()].sort((a, b) => a.localeCompare(b));
}

// Keep the user's saved choice, but never revive an authorization removed from their profile.
export function savedDryingFleets(raw: string, authorized: string[]) {
  try {
    const saved: unknown = JSON.parse(raw || "[]");
    if (!Array.isArray(saved)) return [];
    const selected = new Set(saved.filter((value): value is string => typeof value === "string").map(key));
    return authorizedDryingFleets(authorized).filter(fleet => selected.has(key(fleet)));
  } catch { return []; }
}
