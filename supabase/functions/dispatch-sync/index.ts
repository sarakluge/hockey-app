import { createClient } from "npm:@supabase/supabase-js@2";
const headers = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") || "http://localhost:5173",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
};
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  const respond = (message: string, status = 200) =>
    new Response(JSON.stringify({ message }), {
      status,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  if (req.method !== "POST") return respond("Metoden stöds inte", 405);
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } },
  );
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) return respond("Logga in", 401);
  let teamId: string;
  try {
    const body = await req.json();
    if (typeof body.team_id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.team_id)) {
      return respond("Lagets UUID krävs", 400);
    }
    teamId = body.team_id;
  } catch {
    return respond("Ogiltig begäran", 400);
  }
  const { data: admin } = await db.rpc("is_admin", { p_team_id: teamId });
  if (!admin) return respond("Administratör krävs", 403);
  const token = Deno.env.get("GITHUB_DISPATCH_TOKEN"),
    repo = Deno.env.get("GITHUB_REPOSITORY");
  if (!token || !repo)
    return respond(
      "Manuell start är inte konfigurerad. Starta sync.yml i GitHub Actions.",
      503,
    );
  const { error: limit } = await db.rpc("request_sync", { p_team_id: teamId });
  if (limit) return respond(limit.message, 429);
  try {
    const result = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/sync.yml/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({ ref: "main", inputs: { team_id: teamId } }),
      },
    );
    if (!result.ok)
      return respond(
        "GitHub kunde inte starta synken. Kontrollera serverkonfigurationen.",
        502,
      );
    return respond("Synk startad. Uppdatera vyn om en minut.");
  } catch {
    return respond("GitHub kunde inte nås.", 502);
  }
});
