type AssignedFlight = {
  commander?: string;
  copilot?: string;
  flightAttendant?: string;
  deletedAt?: string;
  cancelled?: boolean;
  planningStatus?: "planned" | "confirmed";
};

// Cancellation changes the status, never who can see the flight.
export function groupCrewFlights<T extends AssignedFlight>(flights: T[], user: string) {
  const visible = user.trim() ? flights.filter((flight) => !flight.deletedAt
    && [flight.commander, flight.copilot, flight.flightAttendant].includes(user)) : [];
  return {
    visible,
    confirmed: visible.filter((flight) => !flight.cancelled && flight.planningStatus !== "planned"),
    planned: visible.filter((flight) => !flight.cancelled && flight.planningStatus === "planned"),
    cancelled: visible.filter((flight) => flight.cancelled),
  };
}
