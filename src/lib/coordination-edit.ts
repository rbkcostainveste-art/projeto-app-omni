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

export type FlightScope = "this" | "future";
export type FlightAction = "edit" | "delete" | "cancel";

export function recurrenceKey(flight: CoordinatedFlight) {
  return flight.recurrenceId || (flight.recurrenceLabel
    ? `legacy:${JSON.stringify([flight.prefix, flight.destination ?? "", flight.recurrenceLabel, flight.createdBy, flight.history?.find((event) => event.field === "created")?.at.slice(0, 10) ?? ""])}`
    : "");
}

export function editableOccurrences(flight: CoordinatedFlight, flights: CoordinatedFlight[]) {
  const key = recurrenceKey(flight);
  return flights.filter((item) => item.id !== flight.id && !item.deletedAt && !item.cancelled
    && Boolean(item.planningStatus) && !item.operationStartedAt && !item.actualEngineStart && !item.actualShutdown
    && item.engineStart === "pending" && item.shutdown === "pending"
    && `${item.date}T${item.departure}` > `${flight.date}T${flight.departure}`
    && Boolean(key) && recurrenceKey(item) === key)
    .sort((a, b) => a.date.localeCompare(b.date) || a.departure.localeCompare(b.departure));
}

export type EditOperation = { kind: "create" | "update"; flight: CoordinatedFlight };

export function planFlightAction(original: CoordinatedFlight, flights: CoordinatedFlight[], action: "delete" | "cancel", scope: FlightScope, user: string, reason = ""): EditOperation[] {
  const targets = scope === "future" ? [...editableOccurrences(original, flights), original] : [original];
  const at = new Date().toISOString();
  return targets.map((flight) => ({ kind: "update", flight: { ...flight, updatedBy: user,
    ...(action === "delete" ? { deletedAt: at, deletedBy: user }
      : { cancelled: true, cancelledAt: at, cancellationReason: reason.trim() }),
  } }));
}

// Keep existing occurrence IDs; only newly selected dates need new flights.
export function planFlightEdit(original: CoordinatedFlight, updated: CoordinatedFlight, draft: Draft,
  future: CoordinatedFlight[], allFlights: CoordinatedFlight[], user: string, scope: FlightScope = "this"): EditOperation[] {
  const operations: EditOperation[] = [];
  const existingKey = recurrenceKey(original);
  if (scope === "this" && existingKey) {
    return [{ kind: "update", flight: { ...updated, recurrenceLabel: original.recurrenceLabel, recurrenceId: existingKey, updatedBy: user } }];
  }
  const previous = flightToDraft(original);
  const scheduleChanged = recurrenceLabel(previous) !== recurrenceLabel(draft);
  const label = scope === "future" && draft.repeat && !scheduleChanged && updated.departure !== original.departure
    ? recurrenceLabel({ ...draft, weekdayTimes: Object.fromEntries(draft.weekdays.map((day) => [day, updated.departure])) })
    : recurrenceLabel(draft);
  const recurrenceId = draft.repeat ? existingKey || crypto.randomUUID() : "";
  const commonFields = ["prefix", "model", "base", "destination", "duration", "fuelAmount", "fuelUnit", "departure"] as const;
  const commonPatch = Object.fromEntries(commonFields.filter((field) => original[field] !== updated[field]).map((field) => [field, updated[field]]));
  const targets = scope === "future" ? future : [];
  operations.push({ kind: "update", flight: { ...updated, recurrenceLabel: label, recurrenceId, updatedBy: user } });
  // Broadcast only changed flight fields. Dates and crew belong to each occurrence.
  if (!scheduleChanged) {
    for (const item of targets) operations.push({ kind: "update", flight: { ...item, ...commonPatch, recurrenceLabel: label, recurrenceId, updatedBy: user } });
    return operations;
  }
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
    const sameSeries = Boolean(existingKey) && recurrenceKey(item) === existingKey;
    if (sameSeries && item.id !== original.id
      && !targets.some((candidate) => candidate.id === item.id)) wanted.delete(item.date);
  }
  for (const item of targets) {
    const departure = wanted.get(item.date);
    if (departure) {
      // Keep this occurrence's own assignment; never copy crew from the edited flight.
      operations.push({ kind: "update", flight: { ...item, ...commonPatch, departure, recurrenceLabel: label, recurrenceId, updatedBy: user } });
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
