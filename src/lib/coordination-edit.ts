import type { CoordinatedFlight, Draft } from "../components/flight-coordination";

export const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const recurrenceLabel = (draft: Draft) => draft.repeat
  ? `Repetição ativa · ${[...draft.weekdays].sort((a, b) => a - b).map((day) => `${weekdays[day]} ${draft.weekdayTimes[day]}`).join(", ")}`
  : "";

export function flightToDraft(flight: CoordinatedFlight): Draft {
  const weekdayTimes: Record<number, string> = {};
  for (const match of (flight.recurrenceLabel ?? "").matchAll(/(Dom|Seg|Ter|Qua|Qui|Sex|Sáb) (\d{2}:\d{2})/g)) {
    weekdayTimes[weekdays.indexOf(match[1])] = match[2];
  }
  const minutes = Math.round(flight.duration * 60);
  return {
    id: flight.id, prefix: flight.prefix, date: flight.date, departure: flight.departure,
    destination: flight.destination ?? "", duration: `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`,
    fuelAmount: String(flight.fuelAmount ?? 0), fuelUnit: flight.fuelUnit,
    commander: flight.commander ?? "", copilot: flight.copilot ?? "", flightAttendant: flight.flightAttendant ?? "",
    repeat: Boolean(flight.recurrenceLabel), weekdays: Object.keys(weekdayTimes).map(Number), weekdayTimes,
  };
}

export function editableOccurrences(flight: CoordinatedFlight, flights: CoordinatedFlight[]) {
  return flights.filter((item) => item.id !== flight.id && !item.deletedAt && !item.cancelled
    && item.planningStatus === "planned" && !item.actualEngineStart && !item.actualShutdown
    && item.engineStart === "pending" && item.shutdown === "pending" && item.date > flight.date
    && (flight.recurrenceId ? item.recurrenceId === flight.recurrenceId
      : Boolean(flight.recurrenceLabel) && !item.recurrenceId && item.prefix === flight.prefix
        && item.recurrenceLabel === flight.recurrenceLabel))
    .sort((a, b) => a.date.localeCompare(b.date) || a.departure.localeCompare(b.departure));
}

type EditOperation = { kind: "create" | "update"; flight: CoordinatedFlight };

// Keep existing occurrence IDs; only newly selected dates need new flights.
export function planFlightEdit(original: CoordinatedFlight, updated: CoordinatedFlight, draft: Draft,
  future: CoordinatedFlight[], allFlights: CoordinatedFlight[], user: string): EditOperation[] {
  const operations: EditOperation[] = [];
  const label = recurrenceLabel(draft);
  const previous = flightToDraft(original);
  const scheduleChanged = recurrenceLabel(previous) !== label || original.date !== draft.date;
  const recurrenceId = draft.repeat ? original.recurrenceId || (scheduleChanged ? crypto.randomUUID() : "") : "";
  operations.push({ kind: "update", flight: { ...updated, recurrenceLabel: label, recurrenceId, updatedBy: user } });
  // Changing ordinary flight fields does not regenerate its schedule.
  if (!scheduleChanged) return operations;
  const at = new Date().toISOString();
  const end = new Date(`${draft.date}T12:00:00`);
  end.setDate(end.getDate() + 83);
  const wanted = new Map<string, string>();
  if (draft.repeat) {
    const date = new Date(`${draft.date}T12:00:00`);
    for (date.setDate(date.getDate() + 1); date <= end; date.setDate(date.getDate() + 1)) {
      if (draft.weekdays.includes(date.getDay())) wanted.set(date.toISOString().slice(0, 10), draft.weekdayTimes[date.getDay()]);
    }
  }
  // A confirmed or operated occurrence already occupying a date is preserved.
  for (const item of allFlights) {
    const sameSeries = original.recurrenceId ? item.recurrenceId === original.recurrenceId
      : Boolean(original.recurrenceLabel) && item.prefix === original.prefix && item.recurrenceLabel === original.recurrenceLabel;
    if (sameSeries && item.id !== original.id && !item.deletedAt
      && !future.some((candidate) => candidate.id === item.id)) wanted.delete(item.date);
  }
  for (const item of future) {
    const departure = wanted.get(item.date);
    if (departure) {
      // Crew is assigned per occurrence, never carried into a rescheduled repetition.
      operations.push({ kind: "update", flight: { ...item, departure, commander: "", copilot: "", flightAttendant: "", recurrenceLabel: label, recurrenceId, updatedBy: user } });
      wanted.delete(item.date);
    } else {
      operations.push({ kind: "update", flight: { ...item, deletedAt: at, recurrenceLabel: "", recurrenceId: "", updatedBy: user } });
    }
  }
  for (const [date, departure] of wanted) {
    const wave = Math.max(0, ...allFlights.filter((item) => !item.deletedAt && item.prefix === updated.prefix && item.date === date).map((item) => item.wave ?? 1)) + 1;
    operations.push({ kind: "create", flight: {
      id: crypto.randomUUID(), prefix: updated.prefix, model: updated.model, base: updated.base,
      date, departure, destination: updated.destination, duration: updated.duration, fuelAmount: updated.fuelAmount, fuelUnit: updated.fuelUnit,
      fuel: "pending", preflight: "pending", hums: "pending", engineStart: "pending", shutdown: "pending",
      planningStatus: "planned", wave, revision: 1, acknowledged: { [user]: 1 },
      commander: "", copilot: "", flightAttendant: "", recurrenceLabel: label, recurrenceId,
      createdBy: user, updatedBy: user, actionBy: { created: user },
      history: [{ field: "created", value: "Repetição programada pela Coordenação", employeeNumber: user, at }],
    } });
  }
  return operations;
}
