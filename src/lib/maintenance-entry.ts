// Same roles allowed to open a technical discrepancy directly in maintenance.
export function canOpenDirectFault(profile: string) {
  return [
    "admin",
    "app_manager",
    "maintenance_inspector",
    "maintenance_coordinator",
    "maintenance_manager",
    "maintenance_director",
  ].includes(profile);
}

export type MaintenanceEntry = "report" | "direct_fault";

export type MaintenanceSeed = {
  type: "fault" | "discrepancy";
  prefix: string;
  sourceFlightId: string;
  directFault?: boolean;
};
