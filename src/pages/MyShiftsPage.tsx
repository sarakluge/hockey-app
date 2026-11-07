import { Box } from "@mui/material";
import { Alert, Button } from "@mui/material";
import { Mic, Timer, ClipboardList } from "lucide-react";
import type { HockeyApp } from "../hooks/useHockeyApp";
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
      {!app.ownFamily && (
        <Alert severity="info">
          Administratören behöver koppla ditt konto till rätt familj.
        </Alert>
      )}
      {matches.map((match) => {
        const ownAssignments = assignments.filter(
          (assignment) => assignment.match_id === match.id,
        );
        if (!ownAssignments.length) return null;

        return (
          <MatchCard key={match.id} match={match} data={app.data} showStaffing={false}>
            {ownAssignments.map((assignment) => {
              const Icon =
                assignment.role === "Klockan"
                  ? Timer
                  : assignment.role === "Speaker/Musik"
                    ? Mic
                    : ClipboardList;
              return (
                <Button
                  sx={{
                    justifyContent: "flex-start",
                    marginTop: "12px",
                    background: "#eff6ff",
                  }}
                  variant="outlined"
                  fullWidth
                  href="#instruktioner"
                  key={assignment.role}
                  startIcon={<Icon size={25} />}
                >
                  <strong>Min uppgift: {assignment.role}</strong>
                </Button>
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
          <ClipboardList />
          <h2>Inga tilldelade pass ännu</h2>
          <p>Dina uppgifter visas här när bemanningen är planerad.</p>
        </Box>
      )}
    </Box>
  );
}
