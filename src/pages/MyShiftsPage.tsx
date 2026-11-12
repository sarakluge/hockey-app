import { AssignmentOutlined } from "@mui/icons-material";
import { roleIcon } from "../lib/roleIcons";
import { Box } from "@mui/material";
import { Alert, Button } from "@mui/material";

import type { HockeyApp } from "../hooks/useHockeyApp";
import ReplacementSearches, { FindReplacement } from "../components/ReplacementSearches";
import { instructionHref } from "../lib/instructions";
import MatchCard from "../components/MatchCard";

export default function MyShiftsPage({ app }: { app: HockeyApp }) {
  const matches = [...app.data.matches].sort((first, second) =>
    (first.starts_at || "9999").localeCompare(second.starts_at || "9999"),
  );
  const assignments = app.data.assignments.filter(
    (assignment) => assignment.family_id === app.ownFamily,
  );

  return (
    <Box sx={{ display: "grid", gap: "20px" }}>
      {!app.demo && (
        <Alert
          severity="info"
          action={
            <Button color="inherit" href="#profil">
              Notisinställningar
            </Button>
          }
        >
          Aktivera pushnotiser under Min profil för att få ersättarförfrågningar även när
          appen är stängd.
        </Alert>
      )}
      {!app.ownFamily && (
        <Alert severity="info">
          Administratören behöver koppla ditt konto till rätt spelare.
        </Alert>
      )}
      {app.data.replacementNotifications
        .filter((n) => n.family_id === app.ownFamily)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 8)
        .map((n) => (
          <Alert severity="info" key={n.id}>
            {n.message}
          </Alert>
        ))}
      <Box id="replacement-inbox" tabIndex={-1} sx={{ scrollMarginTop: 16 }}>
        <ReplacementSearches app={app} />
      </Box>
      {matches.map((match) => {
        const ownAssignments = assignments.filter(
          (assignment) => assignment.match_id === match.id,
        );
        if (!ownAssignments.length) return null;

        return (
          <MatchCard key={match.id} match={match} data={app.data} showStaffing={false}>
            {ownAssignments.map((assignment) => {
              const Icon = roleIcon(assignment.role);
              return (
                <Box key={assignment.role}>
                  <Button
                    sx={{
                      justifyContent: "flex-start",
                      marginTop: "12px",
                      background: "#eff6ff",
                    }}
                    variant="outlined"
                    fullWidth
                    href={instructionHref(assignment.role, match.arena)}
                    key={assignment.role}
                    startIcon={<Icon sx={{ fontSize: 25 }} />}
                  >
                    <strong>Min uppgift: {assignment.role}</strong>
                  </Button>
                  {match.status !== "finished" &&
                    match.status !== "cancelled" &&
                    (!match.starts_at ||
                      new Date(match.starts_at) >
                        (app.demo ? new Date("2026-11-05T12:00:00Z") : new Date())) && (
                      <FindReplacement
                        app={app}
                        matchId={match.id}
                        role={assignment.role}
                      />
                    )}
                </Box>
              );
            })}
          </MatchCard>
        );
      })}
      {!assignments.length && (
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
          <AssignmentOutlined />
          <h2>Inga tilldelade pass ännu</h2>
          <p>Dina uppgifter visas här när bemanningen är planerad.</p>
        </Box>
      )}
    </Box>
  );
}
