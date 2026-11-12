import { Alert, Checkbox, FormControlLabel, Box } from "@mui/material";
import SelectField from "../components/SelectField";
import { useEffect, useState } from "react";
import type { HockeyApp } from "../hooks/useHockeyApp";
import ReplacementSearches from "../components/ReplacementSearches";
import MatchCard from "../components/MatchCard";
import { formatDate } from "../lib/types";

export default function MatchesPage({ app }: { app: HockeyApp }) {
  const [period, setPeriod] = useState("upcoming");
  const [competition, setCompetition] = useState("all");
  const [clock, setClock] = useState(Date.now);
  const now = app.demo ? new Date("2026-11-05T12:00:00Z") : new Date(clock);
  useEffect(() => {
    if (app.demo) return;
    const timer = window.setInterval(() => setClock(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, [app.demo]);
  const matches = [...app.data.matches]
    .sort((first, second) =>
      (first.starts_at || "9999").localeCompare(second.starts_at || "9999"),
    )
    .filter((match) => {
      const isPast =
        match.status === "finished" ||
        (match.starts_at !== null &&
          Date.parse(match.starts_at) + 60 * 60 * 1000 <= now.getTime());
      const matchesPeriod = period === "all" || (period === "past" ? isPast : !isPast);
      return (
        matchesPeriod && (competition === "all" || match.competition === competition)
      );
    });

  return (
    <>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: "12px",
          "@media (max-width: 360px)": { gridTemplateColumns: "1fr" },
        }}
      >
        <SelectField
          label="Visa matcher"
          value={period}
          onChange={(event) => setPeriod(event.target.value)}
        >
          <option value="upcoming">Kommande</option>
          <option value="past">Spelade</option>
          <option value="all">Alla matcher</option>
        </SelectField>
        <SelectField
          label="Tävling"
          value={competition}
          onChange={(event) => setCompetition(event.target.value)}
        >
          <option value="all">Serie & DM</option>
          {app.competitions.map((item) => (
            <option key={item.competition} value={item.competition}>
              {item.kind === "dm" ? "DM" : "Serie"} · {item.competition}
            </option>
          ))}
        </SelectField>
      </Box>
      {app.ownFamily ? (
        <Alert severity="info">
          Markera de matcher där din familj inte kan bemanna. Valet gäller hela familjen
          och kan ändras här.
        </Alert>
      ) : (
        <Alert severity="info">
          Administratören behöver koppla ditt konto till en spelare innan du kan ange
          familjens tillgänglighet.
        </Alert>
      )}
      <Box sx={{ display: "grid", gap: "20px" }}>
        {matches.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            data={app.data}
            highlighted={
              !["finished", "cancelled"].includes(match.status) &&
              match.starts_at !== null &&
              formatDate(match.starts_at) === formatDate(now.toISOString()) &&
              Date.parse(match.starts_at) + 60 * 60 * 1000 > now.getTime()
            }
          >
            <ReplacementSearches app={app} matchId={match.id} />
            {app.ownFamily &&
              match.status !== "finished" &&
              match.status !== "cancelled" &&
              (!match.starts_at || new Date(match.starts_at) >= now) && (
                <Box sx={{ mt: 2 }}>
                  <FormControlLabel
                    label="Min familj är inte tillgänglig"
                    control={
                      <Checkbox
                        checked={app.data.unavailability.some(
                          (item) =>
                            item.match_id === match.id &&
                            item.family_id === app.ownFamily,
                        )}
                        disabled={app.busy}
                        onChange={(event) =>
                          void app.setUnavailable(match.id, event.target.checked)
                        }
                      />
                    }
                  />
                  {app.data.unavailability.some(
                    (item) =>
                      item.match_id === match.id && item.family_id === app.ownFamily,
                  ) &&
                    app.data.assignments.some(
                      (item) =>
                        item.match_id === match.id && item.family_id === app.ownFamily,
                    ) && (
                      <Alert severity="warning">
                        Ni har redan ett pass på denna match. Använd Hitta ersättare under
                        Mina pass om ni behöver hjälp.
                      </Alert>
                    )}
                </Box>
              )}
          </MatchCard>
        ))}
      </Box>
      {!matches.length && (
        <Box
          sx={{
            textAlign: "center",
            color: "#58677b",
            padding: "40px 12px",
            "& svg": { marginBottom: "12px" },
            "& h2": { fontSize: "1.2rem", margin: "0 0 10px" },
            "& p": { margin: "0" },
          }}
        >
          <h2>Inga matcher att visa</h2>
          <p>Välj ett annat filter eller be administratören uppdatera matcherna.</p>
        </Box>
      )}
    </>
  );
}
