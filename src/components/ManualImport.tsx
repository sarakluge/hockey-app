import { useState } from "react";
import { supabase, configuredTeamId } from "../lib/supabase";

export default function ManualImport({
  onDone,
  demo,
  homeTeam,
  competitions,
}: {
  onDone: () => void;
  demo: boolean;
  homeTeam: string;
  competitions: string[];
}) {
  const [text, setText] = useState(""),
    [result, setResult] = useState(""),
    [approved, setApproved] = useState(false),
    [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      const rows = JSON.parse(text);
      if (!Array.isArray(rows) || !rows.length)
        throw new Error("Ange en lista med verifierade matchobjekt.");
      for (const r of rows)
        if (
          !r.id ||
          !/^\d+$/.test(r.source_id) ||
          r.id !== `${r.competition}:${r.source_id}` ||
          !competitions.includes(r.competition) ||
          r.home_team !== homeTeam ||
          !r.away_team ||
          !r.arena ||
          !["scheduled", "finished", "postponed", "cancelled"].includes(r.status) ||
          (r.starts_at &&
            (!Number.isFinite(new Date(r.starts_at).getTime()) ||
              !/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$/.test(r.starts_at)))
        )
          throw new Error(
            "Ogiltig match. Följ formatet i README, inklusive tidszon och officiellt matchnummer.",
          );
      if (demo) {
        setResult(`${rows.length} matcher validerade. Demoläget sparar inget.`);
        return;
      }
      const { error } = await supabase!.rpc("manual_matches", {
        p_team_id: configuredTeamId,
        p_matches: rows,
      });
      if (error) throw error;
      setResult("Matchdata sparad. Bemanning är bevarad.");
      onDone();
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Import misslyckades");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>Manuell matchimport · reservlösning</h2>
      <p className="muted">
        Om Swehockey inte kan läsas: klistra in verifierade matchdata som JSON enligt
        README. Matchnummer och tävling måste komma från officiell källa. Inga matchningar
        görs utifrån datum.
      </p>
      <textarea
        rows={6}
        aria-label="Manuella matchdata i JSON"
        placeholder='[{"id":"21495:OFFICIELLT_MATCHNUMMER", ...}]'
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setApproved(false);
        }}
      />
      <label className="check-label">
        <input
          type="checkbox"
          checked={approved}
          onChange={(e) => setApproved(e.target.checked)}
        />
        Jag har verifierat matchnummer, tävling, lag och tider mot källan. Befintliga
        matchuppgifter får uppdateras.
      </label>
      <button
        className="button secondary"
        disabled={!approved || !text || busy}
        onClick={() => void save()}
      >
        Validera och spara matchdata
      </button>
      {result && <p role="status">{result}</p>}
    </section>
  );
}
