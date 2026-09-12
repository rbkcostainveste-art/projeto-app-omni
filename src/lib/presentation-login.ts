// Passwords stay in this tab's memory. Only a non-secret intent marker survives
// reload so an interrupted login cannot silently restore a previous account.
export type PresentationDemoProfile = "maintenance_leader" | "mechanic" | "commander" | "coordination" | "toolroom";
export type PresentationLoginRequest =
  | { kind: "credentials"; login: string; password: string }
  | { kind: "demo"; profile: PresentationDemoProfile }
  | { kind: "account"; expired?: boolean };
const intentKey = "flight-ia-presentation-entry";
let pending: { request: PresentationLoginRequest; expiresAt: number } | null = null;
function prepare(request: PresentationLoginRequest) {
  pending = { request, expiresAt: Date.now() + 60_000 };
  try { sessionStorage.setItem(intentKey, "pending"); } catch { /* Memory handoff still works. */ }
}
export function preparePresentationLogin(login: string, password: string) { prepare({ kind: "credentials", login: login.trim(), password }); }
export function preparePresentationDemo(profile: PresentationDemoProfile) { prepare({ kind: "demo", profile }); }
export function preparePresentationAccountLogin() { prepare({ kind: "account" }); }
export function hasPendingPresentationLogin() {
  try { return pending !== null || sessionStorage.getItem(intentKey) === "pending"; }
  catch { return pending !== null; }
}
export function consumePresentationLogin(): PresentationLoginRequest | null {
  const hadIntent = hasPendingPresentationLogin();
  const entry = pending;
  pending = null;
  try { sessionStorage.removeItem(intentKey); } catch { /* No persisted credentials to clear. */ }
  if(entry && entry.expiresAt > Date.now()) return entry.request;
  return hadIntent ? { kind: "account", expired: true } : null;
}
