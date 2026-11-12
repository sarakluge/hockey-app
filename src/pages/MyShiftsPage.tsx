import { AssignmentOutlined, ExpandMore } from "@mui/icons-material";
import { useState } from "react";
import { roleIcon } from "../lib/roleIcons";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Typography,
} from "@mui/material";
import { Alert, Button } from "@mui/material";

import type { HockeyApp } from "../hooks/useHockeyApp";
import ReplacementSearches, { FindReplacement } from "../components/ReplacementSearches";
import { instructionHref } from "../lib/instructions";
import MatchCard from "../components/MatchCard";
import { pendingReplacementRequests } from "../lib/replacementRequests";

export default function MyShiftsPage({ app }: { app: HockeyApp }) {
  const [inboxExpanded, setInboxExpanded] = useState(false);
  const now = app.demo ? Date.parse("2026-11-05T12:00:00Z") : Date.now();
  const pendingIds = pendingReplacementRequests(app.data, app.ownFamily, now).map(
    (request) => request.search.id,
  );
  const relevantSearchIds = app.data.replacementSearches
    .filter((search) => {
      const match = app.data.matches.find((item) => item.id === search.match_id);
      return (
        match &&
        !["finished", "cancelled"].includes(match.status) &&
        (!match.starts_at || Date.parse(match.starts_at) > now) &&
        (pendingIds.includes(search.id) ||
          (search.original_family_id === app.ownFamily &&
            ["searching", "exhausted"].includes(search.status)))
      );
    })
    .map((search) => search.id);
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
          Administratören behöver koppla ditt konto till rätt spelare.
        </Alert>
      )}
      {relevantSearchIds.length > 0 && (
        <Box
          id="replacement-inbox"
          tabIndex={-1}
          onFocus={(event) => {
            if (event.target === event.currentTarget) setInboxExpanded(true);
          }}
          sx={{ scrollMarginTop: 16 }}
        >
          <Accordion
            expanded={inboxExpanded}
            onChange={(_, expanded) => setInboxExpanded(expanded)}
          >
            <AccordionSummary
              expandIcon={<ExpandMore />}
              aria-controls="my-replacement-details"
              id="my-replacement-summary"
            >
              <Typography>
                Förfrågningar och ersättare ({relevantSearchIds.length})
              </Typography>
            </AccordionSummary>
            <AccordionDetails id="my-replacement-details">
              <ReplacementSearches app={app} searchIds={relevantSearchIds} />
            </AccordionDetails>
          </Accordion>
        </Box>
      )}
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
