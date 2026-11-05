import { createClient } from "@supabase/supabase-js";
import { SOURCES, parseSchedule } from "../src/lib/swehockey";
const url = process.env.SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("SUPABASE_URL och SUPABASE_SERVICE_ROLE_KEY krävs.");
const db = createClient(url, key, { auth: { persistSession: false } });
try {
  const matches = [];
  for (const id of SOURCES) {
    const response = await fetch(
      `https://stats.swehockey.se/ScheduleAndResults/Schedule/${id}`,
      {
        headers: {
          "User-Agent":
            "TeamSoderort-Matchklart/1.0 (youth-team schedule; 6-hour interval)",
        },
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!response.ok) throw new Error(`Swehockey ${id}: HTTP ${response.status}`);
    matches.push(...parseSchedule(await response.text(), id, process.env.TEAM_NAME));
  }
  const { error } = await db.rpc("sync_matches", { p_matches: matches });
  if (error) throw error;
  console.log(`Synk klar: ${matches.length} hemmamatcher. Personuppgifter loggas inte.`);
} catch (error) {
  await db.from("sync_logs").insert({
    success: false,
    message:
      "Synk misslyckades. Kontrollera GitHub Actions och Swehockeys format; bemanning är bevarad.",
  });
  console.error(error instanceof Error ? error.message : "Synk misslyckades");
  process.exitCode = 1;
}
