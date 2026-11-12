import { configuredTeamId, supabase } from "./supabase";

export const pushPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
export function supportsPush() {
  return (
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}
export function needsHomeScreen() {
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return (
    ios &&
    !window.matchMedia("(display-mode: standalone)").matches &&
    !(navigator as Navigator & { standalone?: boolean }).standalone
  );
}
function registration() {
  return navigator.serviceWorker.register(
    `${import.meta.env.BASE_URL}notification-sw.js`,
    {
      scope: import.meta.env.BASE_URL,
    },
  );
}
export async function currentPushSubscription() {
  if (!supportsPush()) return null;
  const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
  return reg ? reg.pushManager.getSubscription() : null;
}
export async function enablePush(userId: string) {
  if (!supabase || !configuredTeamId || !pushPublicKey)
    throw new Error("Pushnotiser är inte konfigurerade ännu.");
  if (!supportsPush() || needsHomeScreen())
    throw new Error(
      "Lägg appen på hemskärmen och öppna den där för att aktivera pushnotiser.",
    );
  // Request permission directly from the button click, before other async work (iOS).
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error("Tillåt notiser i webbläsarens eller mobilens inställningar.");
  await registration();
  const reg = await navigator.serviceWorker.ready;
  const key = Uint8Array.from(
    atob(pushPublicKey.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
  const existing = await reg.pushManager.getSubscription();
  const subscription =
    existing ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key,
    }));
  const json = subscription.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      team_id: configuredTeamId,
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    },
    { onConflict: "team_id,user_id,endpoint" },
  );
  if (error) {
    if (!existing) await subscription.unsubscribe();
    throw new Error("Pushnotiser kunde inte sparas. Försök igen.");
  }
}
export async function disablePush(userId: string) {
  const subscription = await currentPushSubscription();
  if (!subscription || !supabase || !configuredTeamId) return;
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("team_id", configuredTeamId)
    .eq("user_id", userId)
    .eq("endpoint", subscription.endpoint);
  if (error) throw new Error("Pushnotiser kunde inte stängas av. Försök igen.");
  // A browser subscription may be shared with another account/team on this device.
  // Keep the browser endpoint; the server-side recipient mapping controls delivery.
}
export async function isPushEnabled(userId: string) {
  const subscription = await currentPushSubscription();
  if (!subscription || !supabase || !configuredTeamId) return false;
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id")
    .eq("team_id", configuredTeamId)
    .eq("user_id", userId)
    .eq("endpoint", subscription.endpoint);
  if (error) throw new Error("Inställningarna för push kunde inte hämtas.");
  return !!data?.length;
}
