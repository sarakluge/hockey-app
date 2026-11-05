import * as cheerio from "cheerio";
import { fromZonedTime } from "date-fns-tz";
import { TEAM, type Match } from "./types";
export const SOURCES = ["21495", "22208"];
export function parseSchedule(html: string, competition: string, team = TEAM): Match[] {
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
