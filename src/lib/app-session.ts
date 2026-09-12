import type { SupabaseClient } from "@supabase/supabase-js";
import type { PresentationLoginRequest } from "./presentation-login";

const validProfiles = new Set(["legacy", "admin", "app_manager", "mechanic", "maintenance_assistant", "toolroom", "commander", "copilot", "flight_attendant", "coordination", "dispatch", "maintenance_director", "maintenance_manager", "maintenance_coordinator", "maintenance_leader", "maintenance_inspector", "leader_inspector"]);
export type ApplicationIdentity = {
  employeeNumber: string; accessProfile: string; assignedBase: string;
  workShift: string; avatarDataUrl: string; isPresentationDemo: boolean;
  authUserId?: string;
};
type ExpectedIdentity = { employeeNumber?: string; profile?: string; demo?: boolean };
type DeviceContext = { p_device_key: string; p_device_label: string; p_user_agent: string };

export function verifiedApplicationIdentity(value: unknown, expected: ExpectedIdentity = {}): ApplicationIdentity {
  if(!value || typeof value !== "object") throw Error("Sua sessão não foi confirmada. Entre novamente.");
  const claim = value as Record<string, unknown>;
  if(typeof claim.employeeNumber !== "string" || !claim.employeeNumber || typeof claim.accessProfile !== "string" || !validProfiles.has(claim.accessProfile)) throw Error("O servidor não confirmou seu perfil de acesso.");
  if(expected.employeeNumber && claim.employeeNumber !== expected.employeeNumber || expected.profile && claim.accessProfile !== expected.profile) throw Error("A sessão mudou. Entre novamente com seu login.");
  if(expected.demo && (claim.isPresentationDemo !== true || claim.isAdmin === true || claim.employeeNumber === "0001" || ["admin", "app_manager", "legacy"].includes(claim.accessProfile))) throw Error("O perfil de teste não foi confirmado pelo servidor.");
  return { employeeNumber: claim.employeeNumber, accessProfile: claim.accessProfile, assignedBase: typeof claim.assignedBase === "string" ? claim.assignedBase : "", workShift: typeof claim.workShift === "string" ? claim.workShift : "", avatarDataUrl: typeof claim.avatarDataUrl === "string" ? claim.avatarDataUrl : "", isPresentationDemo: claim.isPresentationDemo === true };
}

export function clearStoredApplicationIdentity(storage: Pick<Storage, "removeItem">) {
  for(const key of ["passagem-de-pista-user", "flight-ia-presentation-user", "flight-ia-presentation-fleets", "flight-ia-presentation-login"]) storage.removeItem(key);
}

export async function endApplicationSession(client: SupabaseClient) {
  const { data } = await client.auth.getSession();
  if(data.session) await client.rpc("disconnect_my_device", { p_auth_user_id: data.session.user.id });
  const { error } = await client.auth.signOut({ scope: "local" });
  if(error) throw Error("Não foi possível encerrar a sessão anterior. Tente novamente.");
}

export async function signInApplication(client: SupabaseClient, request: Exclude<PresentationLoginRequest, { kind: "account" }>, device: DeviceContext): Promise<ApplicationIdentity> {
  // Explicit entry starts without the former device identity, including failed
  // password attempts. A cached administrator can never be the fallback.
  await endApplicationSession(client);
  const { data: anonymous, error: anonymousError } = await client.auth.signInAnonymously();
  if(anonymousError || !anonymous.user) throw Error("Não foi possível conectar ao aplicativo. Tente novamente.");
  try {
    const expected = request.kind === "credentials" ? { employeeNumber: request.login.trim() } : { profile: request.profile, demo: true };
    const result = request.kind === "credentials"
      ? await client.rpc("claim_device_identity", { p_employee_number: request.login.trim(), p_password: request.password })
      : await client.rpc("begin_presentation_demo", { p_profile: request.profile });
    if(result.error) throw Error(request.kind === "credentials" ? "Login não cadastrado ou senha inválida." : "Não foi possível abrir este perfil de teste. Tente novamente.");
    const claim = verifiedApplicationIdentity(result.data, expected);
    const { error: activationError } = await client.rpc("activate_current_device", device);
    if(activationError) throw Error("Não foi possível registrar este dispositivo.");
    const { data: current, error: currentError } = await client.auth.getUser();
    if(currentError || current.user?.id !== anonymous.user.id) throw Error("A sessão mudou. Entre novamente com seu login.");
    const { data: refreshed, error: refreshError } = await client.rpc("refresh_current_device");
    if(refreshError) throw Error("Não foi possível confirmar seu acesso. Tente novamente.");
    return { ...verifiedApplicationIdentity(refreshed, { ...expected, employeeNumber: claim.employeeNumber }), authUserId: anonymous.user.id };
  } catch(error) {
    await endApplicationSession(client).catch(() => undefined);
    throw error;
  }
}

export async function restoreApplicationSession(client: SupabaseClient, employeeNumber: string, device: DeviceContext): Promise<ApplicationIdentity> {
  // localStorage is only a hint. No protected UI mounts before server validation.
  const { data: current, error: currentError } = await client.auth.getUser();
  if(currentError || !current.user) throw Error("Sua sessão expirou. Entre novamente.");
  const { data, error } = await client.rpc("refresh_current_device");
  if(error) throw Error("Não foi possível confirmar sua sessão. Entre novamente.");
  const claim = verifiedApplicationIdentity(data, { employeeNumber });
  const { error: activationError } = await client.rpc("activate_current_device", device);
  if(activationError) throw Error("Não foi possível confirmar este dispositivo. Entre novamente.");
  return { ...claim, authUserId: current.user.id };
}
