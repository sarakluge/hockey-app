import readXlsxFile from "read-excel-file";
import { formatDate, ROLES, type Family, type Instruction, type Match } from "./types";

type Cell = unknown;

export type ImportRow = {
  label: string;
  opponent: string;
  day: string;
  arena: string;
  match_id: string;
  confirmed: boolean;
  assignments: { role: string; name: string }[];
};

export type ImportPreview = {
  families: Omit<Family, "id">[];
  rows: ImportRow[];
  instructions: Instruction[];
  warnings: string[];
};

const str = (v: Cell) => (v == null ? "" : String(v).trim());

export async function previewExcel(file: File, matches: Match[]): Promise<ImportPreview> {
  if (file.size > 5 * 1024 * 1024) throw new Error("Filen får vara högst 5 MB.");
  const schedule = await readXlsxFile(file, { sheet: "Seketschema U16F" });
  const players = await readXlsxFile(file, { sheet: "Spelare och fördelning" });
  const guide = await readXlsxFile(file, {
    sheet: "Seket - Förberedelser & Avslut",
  });
  if (str(schedule[0]?.[0]) !== "Matchdatum" || str(players[0]?.[0]) !== "Spelare")
    throw new Error("Arbetsbokens rubriker känns inte igen.");
  return buildPreview(schedule, players, guide, matches);
}

export function buildPreview(
  schedule: unknown[][],
  players: unknown[][],
  guide: unknown[][],
  matches: Match[],
): ImportPreview {
  const warnings: string[] = [];
  const families = players
    .slice(1)
    .filter((r) => str(r[0]))
    .map((r) => ({
      name: str(r[0]),
      ovr_ok: str(r[7]).toLowerCase() === "ja",
      clock_ok: str(r[8]).toLowerCase() === "ja",
      speaker_ok: str(r[9]).toLowerCase() === "ja",
    }));
  const rows = schedule
    .slice(1)
    .filter((r) => str(r[2]))
    .map((r, index) => {
      const date = r[0] instanceof Date ? r[0].toISOString().slice(0, 10) : "";
      const assignments = ROLES.flatMap((role, i) =>
        str(r[i + 3]) ? [{ role, name: str(r[i + 3]) }] : [],
      );
      const candidates = matches.filter(
        (m) =>
          m.away_team === str(r[2]) &&
          m.starts_at &&
          formatDate(m.starts_at, {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }) === date,
      );
      if (candidates.length !== 1)
        warnings.push(
          `Rad ${index + 2}: ingen entydig matchning. Välj rätt match manuellt.`,
        );
      for (const a of assignments) {
        const f = families.find((f) => f.name === a.name);
        if (!f) warnings.push(`Rad ${index + 2}: ${a.name} saknas i spelarlistan.`);
        else if (
          (a.role === "OVR" && !f.ovr_ok) ||
          (a.role === "Klockan" && !f.clock_ok) ||
          (a.role === "Speaker/Musik" && !f.speaker_ok)
        )
          warnings.push(
            `Rad ${index + 2}: ${a.name} saknar markerad behörighet för ${a.role}. Kontrollera och rätta i en kopia av filen.`,
          );
      }
      if (new Set(assignments.map((a) => a.name)).size < assignments.length)
        warnings.push(
          `Rad ${index + 2}: samma familj har flera uppgifter. Bekräfta att olika vuxna kan bemanna dem.`,
        );
      return {
        label: `Rad ${index + 2}`,
        opponent: str(r[2]),
        day: date || str(r[0]),
        arena: str(r[1]),
        match_id: candidates.length === 1 ? candidates[0].id : "",
        confirmed: false,
        assignments,
      };
    });
  const instructions: Instruction[] = [];
  for (const r of guide.slice(3))
    for (let col = 1; col <= 8; col++) {
      const body = str(r[col]);
      if (body)
        instructions.push({
          title: `${col % 2 ? "Innan match" : "Efter match"} · ${["OVR", "Klockan", "Speaker/Musik", "Båsdörr"][Math.floor((col - 1) / 2)]}`,
          body,
          arena: str(r[0]),
          role: ["OVR", "Klockan", "Speaker/Musik", "Båsdörr"][Math.floor((col - 1) / 2)],
        });
    }
  warnings.push(
    "Namn avser spelare/familjer, inte identifierade föräldrar. Konton måste kopplas manuellt. Behörighetsflaggor uppdateras från filen vid import.",
  );
  return { families, rows, instructions, warnings };
}
