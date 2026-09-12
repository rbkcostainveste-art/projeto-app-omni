// Credentials exist only in this tab's JavaScript memory during client navigation.
// The application consumes them once and applies its existing server validation.
type PresentationCredentials = { login: string; password: string; expiresAt: number };
let pending: PresentationCredentials | null = null;
export function preparePresentationLogin(login: string, password: string) {
  pending = { login: login.trim(), password, expiresAt: Date.now() + 60_000 };
}
export function consumePresentationLogin() {
  const credentials = pending;
  pending = null;
  return credentials && credentials.expiresAt > Date.now() ? credentials : null;
}
