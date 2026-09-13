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
    return await completeApplicationEntry(client, anonymous.user.id, {
      ...device, p_kind: request.kind,
      p_employee_number: request.kind === "credentials" ? request.login.trim() : null,
      p_password: request.kind === "credentials" ? request.password : null,
      p_profile: request.kind === "demo" ? request.profile : null,
    }, expected);
  } catch(error) {
    await endApplicationSession(client).catch(() => undefined);
    throw error;
  }
}

export async function restoreApplicationSession(client: SupabaseClient, employeeNumber: string, device: DeviceContext): Promise<ApplicationIdentity> {
  // localStorage is only a hint. No protected UI mounts before server validation.
  const { data } = await client.auth.getSession();
  if(!data.session) throw Error("Sua sessão expirou. Entre novamente.");
  return completeApplicationEntry(client, data.session.user.id, {
    ...device, p_kind: "restore", p_employee_number: employeeNumber,
  }, { employeeNumber });
}

async function completeApplicationEntry(client: SupabaseClient, authUserId: string, args: DeviceContext & {
  p_kind: "credentials" | "demo" | "restore";
  p_employee_number?: string | null; p_password?: string | null; p_profile?: string | null;
}, expected: ExpectedIdentity): Promise<ApplicationIdentity> {
  // Account checks and device activation share one database transaction. The
  // independent Auth check runs alongside it instead of adding another wait.
  const [result, current] = await Promise.all([
    client.rpc("complete_application_entry", { ...args, p_expected_auth_user_id: authUserId }),
    client.auth.getUser(),
  ]);
  if(current.error || current.data.user?.id !== authUserId) throw Error("A sessão mudou. Entre novamente com seu login.");
  if(result.error) throw Error(args.p_kind === "credentials"
    ? "Não foi possível entrar. Confira seu login e senha e tente novamente."
    : "Não foi possível confirmar seu acesso. Tente novamente.");
  if(result.data?.authUserId !== authUserId) throw Error("A sessão mudou. Entre novamente com seu login.");
  const identity = verifiedApplicationIdentity(result.data, expected);
  // A different tab may have switched accounts while the requests were running.
  const { data: latest } = await client.auth.getSession();
  if(latest.session?.user.id !== authUserId) throw Error("A sessão mudou. Entre novamente com seu login.");
  return { ...identity, authUserId };
}
