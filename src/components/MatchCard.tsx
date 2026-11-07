import { Alert, Card, Divider, Typography } from "@mui/material";
import { MapPin } from "lucide-react";
import type { ReactNode } from "react";
import { formatDate, type Data, type Match } from "../lib/types";
import Badge from "./Badge";
import Staffing from "./Staffing";

const statuses: Record<string, string> = {
  finished: "Spelad",
  postponed: "Inväntar ny tid",
  cancelled: "Inställd",
};

interface MatchCardProps {
  match: Match;
  data: Data;
  children?: ReactNode;
  showStaffing?: boolean;
}

export default function MatchCard({
  match,
  data,
  children,
  showStaffing = true,
}: MatchCardProps) {
  const isDm = match.kind === "dm" || (!match.kind && match.competition === "22208");
  const date = match.starts_at
    ? formatDate(match.starts_at, { weekday: "long", day: "numeric", month: "long" })
    : "Datum inväntas";
  const time = match.starts_at
    ? formatDate(match.starts_at, { hour: "2-digit", minute: "2-digit" })
    : "– – : – –";

  return (
    <Card
      component="article"
      className={showStaffing ? "match-card" : "match-card shift-card"}
    >
      <div className="match-date-row">
        <Typography variant="h2" sx={{ fontSize: { xs: "1rem", sm: "1.2rem" } }}>
          {date.charAt(0).toUpperCase() + date.slice(1)}
        </Typography>
        <Badge tone={isDm ? "purple" : ""}>{isDm ? "DM" : "Serie"}</Badge>
      </div>
      <div className="match-overview">
        <p className="match-time">{time}</p>
        <div className="match-opponent">
          <h3>
            <span>vs.</span> {match.away_team}
          </h3>
          <p className="arena">
            <MapPin size={18} />
            {match.arena}
          </p>
        </div>
      </div>
      <div className="match-alerts">
        {statuses[match.status] && <Badge tone="amber">{statuses[match.status]}</Badge>}
        {match.changed_at && <Badge tone="amber">Ändrad matchinfo</Badge>}
        {(match.needs_review || match.missing_from_source) && (
          <Alert severity="warning" sx={{ mt: 1, width: "100%" }}>
            {match.missing_from_source
              ? "Saknas i källan. Bemanningen är bevarad."
              : "Matchtiden behöver kontrolleras."}
          </Alert>
        )}
      </div>
      {showStaffing && (
        <>
          <Divider sx={{ my: 1.5 }} />
          <section className="match-staffing">
            <h3>Bemanning</h3>
            <Staffing match={match} data={data} />
          </section>
        </>
      )}
      {children}
    </Card>
  );
}
