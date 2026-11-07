import { Box } from "@mui/material";
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
      sx={{ padding: "20px", "@media (max-width: 400px)": { padding: "16px" } }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <Typography variant="h2" sx={{ fontSize: { xs: "1rem", sm: "1.2rem" } }}>
          {date.charAt(0).toUpperCase() + date.slice(1)}
        </Typography>
        <Badge tone={isDm ? "purple" : ""}>{isDm ? "DM" : "Serie"}</Badge>
      </Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: "20px",
          margin: "14px 0",
          "@media (max-width: 400px)": { gap: "12px" },
        }}
      >
        <Box
          component="p"
          sx={{
            fontSize: showStaffing ? "clamp(2.2rem, 10vw, 3.25rem)" : "2rem",
            fontWeight: "750",
            letterSpacing: "-0.04em",
            lineHeight: "1.2",
            margin: "0",
            whiteSpace: "nowrap",
            "@media (max-width: 400px)": { fontSize: "2.15rem" },
          }}
        >
          {time}
        </Box>
        <Box
          sx={{
            flex: "1",
            minWidth: "0",
            "& h3": {
              fontSize: "1rem",
              margin: "0",
              lineHeight: "1.4",
              overflowWrap: "anywhere",
            },
          }}
        >
          <h3>
            <span>vs.</span> {match.away_team}
          </h3>
          <Box
            component="p"
            sx={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              color: "#58677b",
              margin: "5px 0 0",
              fontSize: "0.875rem",
            }}
          >
            <MapPin size={18} />
            {match.arena}
          </Box>
        </Box>
      </Box>
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          "&:empty": { display: "none" },
        }}
      >
        {statuses[match.status] && <Badge tone="amber">{statuses[match.status]}</Badge>}
        {match.changed_at && <Badge tone="amber">Ändrad matchinfo</Badge>}
        {(match.needs_review || match.missing_from_source) && (
          <Alert severity="warning" sx={{ mt: 1, width: "100%" }}>
            {match.missing_from_source
              ? "Saknas i källan. Bemanningen är bevarad."
              : "Matchtiden behöver kontrolleras."}
          </Alert>
        )}
      </Box>
      {showStaffing && (
        <>
          <Divider sx={{ my: 1.5 }} />
          <Box
            component="section"
            sx={{ "& > h3": { fontSize: "0.875rem", margin: "0 0 8px" } }}
          >
            <h3>Bemanning</h3>
            <Staffing match={match} data={data} />
          </Box>
        </>
      )}
      {children}
    </Card>
  );
}
