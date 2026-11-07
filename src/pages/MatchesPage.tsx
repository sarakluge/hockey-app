import { Box } from "@mui/material";
import SelectField from "../components/SelectField";
import { useState } from "react";
import type { HockeyApp } from "../hooks/useHockeyApp";
import MatchCard from "../components/MatchCard";

export default function MatchesPage({ app }: { app: HockeyApp }) {
  const [period, setPeriod] = useState("upcoming");
  const [competition, setCompetition] = useState("all");
  const now = app.demo ? new Date("2026-11-05T12:00:00Z") : new Date();
  const matches = [...app.data.matches]
    .sort((first, second) =>
      (first.starts_at || "9999").localeCompare(second.starts_at || "9999"),
    )
    .filter((match) => {
      const isPast =
        match.status === "finished" ||
        (match.starts_at !== null && new Date(match.starts_at) < now);
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
      <Box sx={{ display: "grid", gap: "20px" }}>
        {matches.map((match) => (
          <MatchCard key={match.id} match={match} data={app.data} />
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
