export type Delivery = {
  id: string;
  lease_id: string;
  channel: "email" | "push";
  email: string;
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } } | null;
  search_id: string;
  message: string;
  role: string;
  away_team: string;
  starts_at: string | null;
  deadline: string | null;
  is_request: boolean;
};
type Result = { error: unknown; data?: Delivery[] | null };
type Dependencies = {
  env: (name: string) => string | undefined;
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<Result>;
  push: (
    subscription: NonNullable<Delivery["subscription"]>,
    payload: string,
    ttl: number,
  ) => Promise<unknown>;
};
const date = (value: string) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export async function dispatchNotifications(req: Request, deps: Dependencies) {
  const token = deps.env("NOTIFICATION_DISPATCH_SECRET");
  if (!token || req.headers.get("Authorization") !== `Bearer ${token}`)
    return new Response("Unauthorized", { status: 401 });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const appUrl = deps.env("APP_URL");
  if (!appUrl || new URL(appUrl).protocol !== "https:")
    return new Response("APP_URL must be configured with HTTPS", { status: 503 });
  const channels: string[] = [];
  if (
    deps.env("VAPID_PUBLIC_KEY") &&
    deps.env("VAPID_PRIVATE_KEY") &&
    deps.env("VAPID_SUBJECT")
  )
    channels.push("push");
  if (!channels.length)
    return new Response("No delivery channels configured", { status: 503 });
  const claimed = await deps.rpc("claim_notification_deliveries", {
    p_channels: channels,
  });
  if (claimed.error) return new Response("Queue unavailable", { status: 503 });
  let sent = 0,
    failed = 0;
  for (const item of claimed.data || []) {
    let result = "sent";
    let error: string | null = null;
    try {
      if (item.channel !== "push") throw new Error("Unsupported notification channel");
      const url = new URL(appUrl);
      url.hash = "mina";
      const title = item.is_request ? "Kan ni ta ett pass?" : "Besked om ersättare";
      const body = [
        item.message,
        `${item.role} · ${item.away_team}`,
        item.starts_at ? `Match: ${date(item.starts_at)}` : "Matchtid ej fastställd",
        item.deadline ? `Svara senast ${date(item.deadline)}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      const ttl = item.deadline
        ? Math.max(
            0,
            Math.min(3600, Math.floor((Date.parse(item.deadline) - Date.now()) / 1000)),
          )
        : 3600;
      if (!ttl) {
        result = "skipped";
      } else
        await deps.push(
          item.subscription!,
          JSON.stringify({
            title,
            body,
            url: url.href,
            tag: `replacement-${item.search_id}`,
          }),
          ttl,
        );

      if (result === "sent") sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      result =
        item.channel === "push" && (status === 404 || status === 410)
          ? "expired"
          : "retry";
      // Do not persist provider bodies, email addresses, credentials or push endpoints.
      error = status ? `Provider HTTP ${status}` : "Delivery failed";
      failed++;
    }
    const finished = await deps.rpc("finish_notification_delivery", {
      p_id: item.id,
      p_lease_id: item.lease_id,
      p_result: result,
      p_error: error,
    });
    if (finished.error)
      return new Response("Could not acknowledge delivery", { status: 503 });
  }
  return Response.json({ sent, failed });
}
