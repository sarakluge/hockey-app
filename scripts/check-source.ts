import { readFile } from "node:fs/promises";
import { parseSchedule, SOURCES } from "../src/lib/swehockey";
// Valfria lokala HTML-filer kan anges som två argument. Annars läses de offentliga källorna.
for (const [index, id] of SOURCES.entries()) {
  const path = process.argv[index + 2];
  let html: string;
  if (path) {
    html = await readFile(path, "utf8");
  } else {
    const response = await fetch(
      `https://stats.swehockey.se/ScheduleAndResults/Schedule/${id}`,
      {
        headers: {
          "User-Agent": "TeamSoderort-Matchklart/1.0 (manual source verification)",
        },
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!response.ok) throw new Error(`Swehockey ${id}: HTTP ${response.status}`);
    html = await response.text();
  }
  const rows = parseSchedule(html, id);
  console.log(
    `${id}: ${rows.length} verifierade hemmamatcher, ${rows.filter((m) => m.needs_review).length} tider behöver kontrolleras. Ingen databasskrivning.`,
  );
}
