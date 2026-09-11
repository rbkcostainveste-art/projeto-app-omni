type AssignedFlight = {
  commander?: string;
  copilot?: string;
  flightAttendant?: string;
  deletedAt?: string;
  cancelled?: boolean;
  planningStatus?: "planned" | "confirmed";
  returned?: boolean;
  shutdown?: string;
  actualShutdown?: string | null;
  maintenancePostId?: string;
};

export type CrewFlightGroup = "maintenance" | "confirmed" | "planned" | "cancelled" | "returned" | "finished";

export function crewFlightGroup(flight: AssignedFlight): CrewFlightGroup {
  if (flight.cancelled) return "cancelled";
  if (flight.returned) return "returned";
  if (flight.shutdown === "ok" || flight.actualShutdown) return "finished";
  if (flight.maintenancePostId) return "maintenance";
  return flight.planningStatus === "planned" ? "planned" : "confirmed";
}

// Cancellation changes the status, never who can see the flight.
export function groupCrewFlights<T extends AssignedFlight>(flights: T[], user: string) {
  const visible = user.trim() ? flights.filter((flight) => !flight.deletedAt
    && [flight.commander, flight.copilot, flight.flightAttendant].includes(user)) : [];
  return {
    visible,
    maintenance: visible.filter((flight) => crewFlightGroup(flight) === "maintenance"),
    confirmed: visible.filter((flight) => crewFlightGroup(flight) === "confirmed"),
    planned: visible.filter((flight) => crewFlightGroup(flight) === "planned"),
    cancelled: visible.filter((flight) => crewFlightGroup(flight) === "cancelled"),
    returned: visible.filter((flight) => crewFlightGroup(flight) === "returned"),
    finished: visible.filter((flight) => crewFlightGroup(flight) === "finished"),
  };
}
