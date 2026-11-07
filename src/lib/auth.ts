/** The origin/base path are application configuration, never user-supplied redirects. */
export function authRedirectUrl(origin: string, basePath: string, recovery = false) {
  const url = new URL(basePath, origin);
  if (recovery) url.searchParams.set("auth", "recovery");
  return url.href;
}

export function isPasswordRecoveryUrl(url: string) {
  const parsed = new URL(url);
  return (
    parsed.searchParams.get("auth") === "recovery" ||
    new URLSearchParams(parsed.hash.slice(1)).get("type") === "recovery"
  );
}

export function clearPasswordRecoveryUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("auth");
  url.hash = "";
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}

export function passwordValidation(password: string, confirmation: string) {
  if (password.length < 8) return "Använd minst 8 tecken i lösenordet.";
  if (password !== confirmation) return "Lösenorden stämmer inte överens.";
  return "";
}
