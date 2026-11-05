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
      <div className="match-filters">
        <label>
          <span className="sr-only">Visa matcher</span>
          <select
            aria-label="Visa matcher"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
          >
            <option value="upcoming">Kommande matcher</option>
            <option value="past">Spelade matcher</option>
            <option value="all">Alla matcher</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Tävling</span>
          <select
            aria-label="Tävling"
            value={competition}
            onChange={(event) => setCompetition(event.target.value)}
          >
            <option value="all">Serie & DM</option>
            <option value="21495">Serie</option>
            <option value="22208">DM</option>
          </select>
        </label>
      </div>
      <div className="match-list">
        {matches.map((match) => (
          <MatchCard key={match.id} match={match} data={app.data} />
        ))}
      </div>
      {!matches.length && (
        <div className="empty-state">
          <h2>Inga matcher att visa</h2>
          <p>Välj ett annat filter eller be administratören uppdatera matcherna.</p>
        </div>
      )}
    </>
  );
}
