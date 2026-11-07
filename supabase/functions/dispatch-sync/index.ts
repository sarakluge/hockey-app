import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import * as cheerio from "npm:cheerio@1.1.2/slim";
import { fromZonedTime } from "npm:date-fns-tz@3.2.0";

type Match = {
  id: string;
  competition: string;
  source_id: string;
  starts_at: string | null;
  home_team: string;
  away_team: string;
  arena: string;
  status: string;
  needs_review: boolean;
};
Deno.serve(async (req: Request) => {
  const allowedOrigins = new Set([
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    ...(Deno.env.get("APP_ORIGIN") || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  ]);
  const origin = req.headers.get("Origin") || "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  if (allowedOrigins.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
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
  // Privileged credentials stay on the server. Authorize this exact team first.
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return respond("Serverns matchhämtning saknar konfiguration.", 503);
  const service = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: team, error: teamError } = await service
    .from("teams")
    .select("home_team, sync_enabled")
    .eq("id", teamId)
    .single();
  if (teamError || !team) return respond("Lagets inställningar kunde inte hämtas.", 503);
  if (!team.sync_enabled)
    return respond("Matchhämtningen är inte aktiverad för laget.", 409);
  const { data: competitions, error: competitionError } = await service
    .from("team_competitions")
    .select("competition")
    .eq("team_id", teamId);
  if (competitionError || !competitions?.length)
    return respond("Laget saknar tävlingar eller tävlingarna kunde inte hämtas.", 503);
  const { error: limit } = await db.rpc("request_sync", { p_team_id: teamId });
  if (limit) return respond(limit.message, 429);
  try {
    const matches: Match[] = [];
    // Read and validate every competition before the single atomic database write.
    for (const { competition } of competitions) {
      if (!/^\d+$/.test(competition)) throw new Error("Ogiltigt tävlingsnummer.");
      const response = await fetch(
        `https://stats.swehockey.se/ScheduleAndResults/Schedule/${competition}`,
        {
          headers: { "User-Agent": "Seket/1.0 (team schedule sync)" },
          signal: AbortSignal.timeout(20000),
        },
      );
      if (!response.ok) throw new Error(`Swehockey: HTTP ${response.status}`);
      matches.push(...parseSchedule(await response.text(), competition, team.home_team));
    }
    const { error: syncError } = await service.rpc("sync_matches", {
      p_team_id: teamId,
      p_matches: matches,
    });
    if (syncError) throw syncError;
    return respond(`${matches.length} hemmamatcher hämtade. Bemanningen finns kvar.`);
  } catch {
    const message =
      "Matcherna kunde inte hämtas från Swehockey eller sparas. Befintliga matcher och bemanning finns kvar. Försök igen senare.";
    await service.from("sync_logs").insert({ team_id: teamId, success: false, message });
    return respond(message, 502);
  }
});

// Standalone for deployment through the Dashboard editor.
// Keep parsing behavior aligned with src/lib/swehockey.ts (covered by edge tests).
function parseSchedule(html: string, competition: string, team: string): Match[] {
  const $ = cheerio.load(html);
  const matches: Match[] = [];
  let date = "";
  let seen = 0;
  $("#groupStandingResultContent .tblContent tr").each((_, row) => {
    const cells = $(row).children("td");
    if (!cells.length) return;
    const day = cells
      .map((_, c) => $(c).text().trim())
      .get()
      .find((t) => /^\d{4}-\d{2}-\d{2}$/.test(t));
    if (day) date = day;
    const tip = $(row).find(".dateLink .lnkTooltip");
    if (!tip.length) return;
    seen++;
    const source_id = tip.attr("title")?.trim();
    const time = tip.text().trim();
    const timeCell = tip.closest("td");
    const gameCell = timeCell.next("td");
    const teams = gameCell
      .text()
      .trim()
      .split(/\s+[-–]\s+/)
      .map((s) => s.trim());
    if (
      !source_id ||
      !/^\d+$/.test(source_id) ||
      teams.length !== 2 ||
      !date ||
      !/^\d{2}:\d{2}$/.test(time)
    )
      throw new Error("Okänt Swehockey-format; synk avbruten utan skrivning.");
    if (teams[0] !== team) return;
    const result = gameCell.next("td").text().trim();
    const status = /inställd|cancelled/i.test(result)
      ? "cancelled"
      : /flyttad|uppskjuten|postponed/i.test(result)
        ? "postponed"
        : /\d+\s*[-–]\s*\d+/.test(result)
          ? "finished"
          : "scheduled";
    const needs_review = time === "00:01" || time === "00:00";
    matches.push({
      id: `${competition}:${source_id}`,
      competition,
      source_id,
      starts_at: needs_review
        ? null
        : fromZonedTime(`${date}T${time}:00`, "Europe/Stockholm").toISOString(),
      home_team: teams[0],
      away_team: teams[1],
      arena: cells.last().text().trim(),
      status: needs_review && status === "scheduled" ? "postponed" : status,
      needs_review,
    });
  });
  if (!seen || !matches.length)
    throw new Error(
      `Inga verifierade hemmamatcher för ${competition}. Kontrollera källa/lag; befintliga data lämnas orörda.`,
    );
  if (new Set(matches.map((m) => m.id)).size !== matches.length)
    throw new Error("Dubbla match-ID i källan.");
  return matches;
}
