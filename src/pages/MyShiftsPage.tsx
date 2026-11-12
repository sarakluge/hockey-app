import { AssignmentOutlined, ExpandMore } from "@mui/icons-material";
import { useEffect, useRef, useState } from "react";
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
import SelectField from "../components/SelectField";
import { formatDate, type Match } from "../lib/types";
import { pendingReplacementRequests } from "../lib/replacementRequests";

export default function MyShiftsPage({ app }: { app: HockeyApp }) {
  const nextMatchRef = useRef<HTMLDivElement>(null);
  const hasScrolled = useRef(false);
  const [period, setPeriod] = useState("all");
  const [inboxExpanded, setInboxExpanded] = useState(false);
  const [clock, setClock] = useState(Date.now);
  const now = app.demo ? Date.parse("2026-11-05T12:00:00Z") : clock;

  useEffect(() => {
    if (app.demo) return;
    const timer = window.setInterval(() => setClock(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, [app.demo]);
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

  const isPast = (match: Match) =>
    match.status === "finished" ||
    (match.starts_at !== null && Date.parse(match.starts_at) + 60 * 60 * 1000 <= now);
  const ownMatches = matches.filter((match) =>
    assignments.some((assignment) => assignment.match_id === match.id),
  );
  const nextMatch = ownMatches.find(
    (match) => !isPast(match) && match.status !== "cancelled" && match.starts_at,
  );
  const visibleMatches = ownMatches.filter(
    (match) => period === "all" || (period === "past" ? isPast(match) : !isPast(match)),
  );

  useEffect(() => {
    if (hasScrolled.current || period !== "all" || !nextMatch?.id) return;
    let frame = 0;
    // Wait for layout before scrolling, including on Safari/iOS.
    const firstFrame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        if (!nextMatchRef.current) return;
        hasScrolled.current = true;
        // An explicitly opened replacement inbox takes priority.
        if (document.activeElement?.closest("#replacement-inbox")) return;
        nextMatchRef.current.scrollIntoView({ behavior: "instant", block: "start" });
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(frame);
    };
  }, [nextMatch?.id, period]);

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
      <SelectField
        label="Visa pass"
        value={period}
        onChange={(event) => setPeriod(event.target.value)}
      >
        <option value="upcoming">Kommande</option>
        <option value="past">Spelade</option>
        <option value="all">Alla pass</option>
      </SelectField>
      {visibleMatches.map((match) => {
        const ownAssignments = assignments.filter(
          (assignment) => assignment.match_id === match.id,
        );
        if (!ownAssignments.length) return null;

        const past = isPast(match);
        const highlight = match.id === nextMatch?.id ? "Nästa pass" : null;
        const highlightToday =
          Boolean(highlight) &&
          match.starts_at !== null &&
          formatDate(match.starts_at) === formatDate(new Date(now).toISOString());

        return (
          <Box
            key={match.id}
            ref={match.id === nextMatch?.id ? nextMatchRef : undefined}
            sx={{
              scrollMarginTop: "16px",
              "& > article": {
                ...(past && {
                  backgroundColor: "#f1f3f5",
                  filter: "grayscale(1)",
                  boxShadow: "none",
                }),
                ...(highlightToday && {
                  border: "2px solid",
                  borderColor: "primary.main",
                }),
              },
            }}
          >
            <MatchCard match={match} data={app.data} showStaffing={false}>
              {highlight && (
                <Typography sx={{ color: "primary.main", fontWeight: 700 }}>
                  {highlight}
                </Typography>
              )}
              {past && (
                <Typography sx={{ color: "text.secondary", fontWeight: 600 }}>
                  Passet är avslutat
                </Typography>
              )}
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
          </Box>
        );
      })}
      {assignments.length > 0 && !visibleMatches.length && (
        <Box sx={{ textAlign: "center", color: "text.secondary", py: 4 }}>
          <Typography component="h2" sx={{ fontWeight: 600 }}>
            Inga pass att visa
          </Typography>
          <Typography>Välj ett annat filter för att se dina pass.</Typography>
        </Box>
      )}
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
