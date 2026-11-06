import { createClient } from "@supabase/supabase-js";
import { parseSchedule } from "../src/lib/swehockey";
import type { Match } from "../src/lib/types";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("SUPABASE_URL och SUPABASE_SERVICE_ROLE_KEY krävs.");
const db = createClient(url, key, { auth: { persistSession: false } });

// A service credential is trusted infrastructure. Each RPC still targets ONE team.
let query = db.from("teams").select("id, home_team").eq("sync_enabled", true);
if (process.env.SYNC_TEAM_ID) query = query.eq("id", process.env.SYNC_TEAM_ID);
const { data: teams, error } = await query;
if (error) throw error;
if (!teams?.length) throw new Error("Inga synkaktiverade lag för det valda urvalet.");

const pageCache = new Map<string, string>();
for (const team of teams) {
  try {
    const { data: competitions, error: sourceError } = await db
      .from("team_competitions")
      .select("competition")
      .eq("team_id", team.id);
    if (sourceError) throw sourceError;
    if (!competitions?.length) throw new Error("Laget saknar tävlingar.");
    const matches: Match[] = [];
    for (const { competition } of competitions) {
      if (!/^\d+$/.test(competition)) throw new Error("Ogiltigt tävlingsnummer.");
      let html = pageCache.get(competition);
      if (!html) {
        const response = await fetch(
          `https://stats.swehockey.se/ScheduleAndResults/Schedule/${competition}`,
          {
            headers: {
              "User-Agent": "Seket/1.0 (youth-team schedules; 6-hour interval)",
            },
            signal: AbortSignal.timeout(30000),
          },
        );
        if (!response.ok) throw new Error(`Swehockey: HTTP ${response.status}`);
        html = await response.text();
        pageCache.set(competition, html);
      }
      matches.push(...parseSchedule(html, competition, team.home_team));
    }
    const { error: syncError } = await db.rpc("sync_matches", {
      p_team_id: team.id,
      p_matches: matches,
    });
    if (syncError) throw syncError;
    console.log(`Lag ${team.id}: ${matches.length} hemmamatcher synkade.`);
  } catch (error) {
    const { error: logError } = await db.from("sync_logs").insert({
      team_id: team.id,
      success: false,
      message:
        "Synk misslyckades. Kontrollera källan och jobbets konfiguration; bemanning bevarad.",
    });
    if (logError) console.error(`Fellogg kunde inte sparas för lag ${team.id}.`);
    console.error(`Lag ${team.id}:`, error instanceof Error ? error.message : "Synkfel");
    process.exitCode = 1;
  }
}
