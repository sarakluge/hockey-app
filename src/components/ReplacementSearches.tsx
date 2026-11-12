import {
  Search,
  PeopleOutlined,
  CheckCircleOutlined,
  ErrorOutlined,
  Block,
  ExpandMore,
} from "@mui/icons-material";
import { useState } from "react";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Tabs,
  Tab,
  Typography,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";

import type { HockeyApp } from "../hooks/useHockeyApp";
import { eligible, formatDate, type Role } from "../lib/types";
import SelectField from "./SelectField";

export function FindReplacement({
  app,
  matchId,
  role,
}: {
  app: HockeyApp;
  matchId: string;
  role: Role;
}) {
  const [confirm, setConfirm] = useState(false);
  const active = app.data.replacementSearches.some(
    (s) => s.match_id === matchId && s.role === role && s.status === "searching",
  );
  if (active) return null;
  return (
    <>
      <Button disabled={app.busy} onClick={() => setConfirm(true)}>
        Hitta ersättare
      </Button>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        aria-labelledby="replacement-confirm-title"
      >
        <DialogTitle id="replacement-confirm-title">Hitta ersättare</DialogTitle>
        <DialogContent>
          Vill du fråga om någon annan kan ta ditt pass? Du ansvarar fortfarande för
          passet tills någon har tagit över.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(false)}>Avbryt</Button>
          <Button
            variant="contained"
            disabled={app.busy}
            onClick={() => {
              setConfirm(false);
              void app.replacementAction("start", { matchId, role });
            }}
          >
            Starta sökning
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

const statuses = {
  searching: "Söker ersättare",
  found: "Ersättare hittad!",
  exhausted: "Ingen ersättare hittad",
  cancelled: "Sökningen avbruten",
};
const responses = {
  queued: "Väntar på sin grupp",
  pending: "Inväntar svar",
  declined: "Kan inte",
  accepted: "Har tagit över",
  closed: "Stängd",
};
const groups = ["", "Färst pass", "Normal belastning", "Flest pass"];

export default function ReplacementSearches({
  app,
  matchId,
  adminView = false,
}: {
  app: HockeyApp;
  matchId?: string;
  adminView?: boolean;
}) {
  const [expandedSearches, setExpandedSearches] = useState<Record<string, boolean>>({});
  const [acceptSearch, setAcceptSearch] = useState<string | null>(null);
  const [adminTab, setAdminTab] = useState("active");
  const [families, setFamilies] = useState<Record<string, string>>({});
  const searches = app.data.replacementSearches
    .filter(
      (s) =>
        (adminView || s.status !== "cancelled") &&
        (!matchId || s.match_id === matchId) &&
        (adminView ||
          !!matchId ||
          s.original_family_id === app.ownFamily ||
          s.replacement_family_id === app.ownFamily ||
          app.data.replacementInvitations.some(
            (i) =>
              i.search_id === s.id &&
              i.family_id === app.ownFamily &&
              i.response !== "queued",
          )),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const activeCount = searches.filter((s) => s.status === "searching").length;
  const visibleSearches = adminView
    ? searches.filter((s) =>
        adminTab === "active" ? s.status === "searching" : s.status !== "searching",
      )
    : searches;
  if (!searches.length && !adminView) return null;
  return (
    <Box sx={{ display: "grid", gap: adminView ? 1 : 2, mt: adminView ? 0 : 2 }}>
      <Dialog
        open={!!acceptSearch}
        onClose={() => setAcceptSearch(null)}
        aria-labelledby="accept-replacement-title"
      >
        <DialogTitle id="accept-replacement-title">Ta över passet?</DialogTitle>
        <DialogContent>
          {(() => {
            const search = searches.find((s) => s.id === acceptSearch);
            const match = app.data.matches.find((m) => m.id === search?.match_id);
            return (
              <>
                Vill din familj ta över passet som {search?.role} mot {match?.away_team}
                {match?.starts_at && (
                  <>
                    {" "}
                    den{" "}
                    {formatDate(match.starts_at, {
                      day: "numeric",
                      month: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </>
                )}
                ? Passet läggs till under Mina pass.
              </>
            );
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAcceptSearch(null)}>Avbryt</Button>
          <Button
            variant="contained"
            disabled={app.busy}
            onClick={() => {
              if (acceptSearch)
                void app.replacementAction("accept", { searchId: acceptSearch });
              setAcceptSearch(null);
            }}
          >
            Ta passet
          </Button>
        </DialogActions>
      </Dialog>
      {adminView && (
        <Tabs
          value={adminTab}
          onChange={(_, value: string) => setAdminTab(value)}
          aria-label="Filtrera ersättarsökningar"
          sx={{ mb: 1 }}
        >
          <Tab value="active" label={`Pågående (${activeCount})`} />
          <Tab value="history" label={`Historik (${searches.length - activeCount})`} />
        </Tabs>
      )}
      {adminView && !visibleSearches.length && (
        <Typography color="text.secondary" sx={{ py: 2 }}>
          {adminTab === "active"
            ? "Inga pågående ersättarsökningar."
            : "Inga avslutade ersättarsökningar."}
        </Typography>
      )}
      {visibleSearches.map((search) => {
        const match = app.data.matches.find((m) => m.id === search.match_id);
        const own = search.original_family_id === app.ownFamily;
        const invitation = app.data.replacementInvitations.find(
          (i) => i.search_id === search.id && i.family_id === app.ownFamily,
        );
        const open = search.status === "searching";
        const StatusIcon = {
          searching: Search,
          found: CheckCircleOutlined,
          exhausted: ErrorOutlined,
          cancelled: Block,
        }[search.status];
        const statusColor = {
          searching: "primary.main",
          found: "success.main",
          exhausted: "warning.main",
          cancelled: "text.secondary",
        }[search.status];
        const canRespond =
          open &&
          invitation?.response === "pending" &&
          (!search.deadline || new Date(search.deadline) > new Date());
        const family = app.data.families.find((f) => f.id === app.ownFamily);
        const canAccept =
          open &&
          !own &&
          !!family &&
          !family.staffing_exempt &&
          eligible(family, search.role) &&
          !!match &&
          !["finished", "cancelled"].includes(match.status) &&
          (!match.starts_at || new Date(match.starts_at) > new Date()) &&
          !app.data.unavailability.some(
            (u) => u.match_id === search.match_id && u.family_id === family.id,
          );
        const candidates = app.data.families.filter(
          (f) =>
            f.id !== search.original_family_id &&
            eligible(f, search.role) &&
            !app.data.assignments.some(
              (a) => a.match_id === search.match_id && a.family_id === f.id,
            ) &&
            !app.data.unavailability.some(
              (u) => u.match_id === search.match_id && u.family_id === f.id,
            ),
        );
        const details = (
          <>
            {!adminView && (
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                <Box
                  sx={{ color: statusColor, display: "flex", mt: "2px" }}
                  aria-hidden="true"
                >
                  <StatusIcon sx={{ fontSize: 22 }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    component="h3"
                    sx={{ fontSize: "1rem", fontWeight: 700, color: "text.primary" }}
                  >
                    {open && own ? "Du söker ersättare" : statuses[search.status]}
                  </Typography>
                  <Typography
                    component="p"
                    variant="body2"
                    sx={{ mt: 0.5, color: "text.secondary", overflowWrap: "anywhere" }}
                  >
                    {search.role}
                    {!matchId && (
                      <>
                        {" "}
                        · {match?.away_team}
                        {match?.starts_at && (
                          <>
                            {" "}
                            ·{" "}
                            {formatDate(match.starts_at, {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </>
                        )}
                      </>
                    )}
                  </Typography>
                </Box>
                {canRespond && !own && (
                  <Chip
                    icon={<PeopleOutlined />}
                    label="Tillfrågad"
                    color="primary"
                    size="small"
                    sx={{ ml: "auto" }}
                  />
                )}
              </Box>
            )}
            <p>
              {app.data.families.find((f) => f.id === search.original_family_id)?.name}
              {search.replacement_family_id && (
                <>
                  {" "}
                  →{" "}
                  {
                    app.data.families.find((f) => f.id === search.replacement_family_id)
                      ?.name
                  }
                </>
              )}
            </p>
            {(own || adminView) && (open || search.status === "exhausted") && (
              <p>
                {own ? "Ni" : "Den ursprungliga familjen"} ansvarar för passet tills någon
                har tagit över.
              </p>
            )}
            {open && (own || adminView) && (
              <p>
                Grupp {search.current_group}: {groups[search.current_group]}
                {search.deadline && (
                  <>
                    . Svar senast{" "}
                    {formatDate(search.deadline, {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    .
                  </>
                )}
              </p>
            )}
            {open && !own && !adminView && (
              <p>
                {canRespond
                  ? "Din familj har fått frågan om att ta över passet."
                  : "Alla behöriga familjer kan ta passet."}
              </p>
            )}
            {canAccept && (
              <Box
                sx={{
                  display: "flex",
                  gap: 1,
                  flexWrap: "wrap",
                  justifyContent: canRespond ? "flex-start" : "flex-end",
                }}
              >
                <Button
                  variant="contained"
                  disabled={app.busy}
                  onClick={() => setAcceptSearch(search.id)}
                >
                  Ta passet
                </Button>
                {canRespond && (
                  <Button
                    variant="outlined"
                    disabled={app.busy}
                    onClick={() =>
                      void app.replacementAction("decline", { searchId: search.id })
                    }
                  >
                    Kan inte
                  </Button>
                )}
              </Box>
            )}
            {invitation?.response === "declined" && open && (
              <p>Din familj har svarat: Kan inte.</p>
            )}
            {open && (own || adminView) && (
              <Button
                disabled={app.busy}
                onClick={() =>
                  void app.replacementAction("cancel", { searchId: search.id })
                }
              >
                Avbryt sökningen
              </Button>
            )}
            {adminView && (
              <>
                <ul>
                  {app.data.replacementInvitations
                    .filter((i) => i.search_id === search.id)
                    .map((i) => (
                      <li key={i.family_id}>
                        {app.data.families.find((f) => f.id === i.family_id)?.name} ·
                        Grupp {i.priority_group} · {responses[i.response]}
                        {i.invited_at && (
                          <>
                            {" "}
                            · Tillfrågad{" "}
                            {formatDate(i.invited_at, {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </>
                        )}
                        {i.responded_at && (
                          <>
                            {" "}
                            · Svar{" "}
                            {formatDate(i.responded_at, {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </>
                        )}
                      </li>
                    ))}
                </ul>
                {open && (
                  <Box sx={{ display: "grid", gap: 1 }}>
                    <Button
                      disabled={app.busy}
                      onClick={() =>
                        void app.replacementAction("next", { searchId: search.id })
                      }
                    >
                      Gå vidare till nästa grupp
                    </Button>
                    <SelectField
                      label="Tilldela ersättare manuellt"
                      value={families[search.id] || ""}
                      onChange={(e) =>
                        setFamilies({ ...families, [search.id]: e.target.value })
                      }
                    >
                      <option value="">Välj familj</option>
                      {candidates.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </SelectField>
                    <Button
                      variant="outlined"
                      disabled={app.busy || !families[search.id]}
                      onClick={() =>
                        void app.replacementAction("assign", {
                          searchId: search.id,
                          familyId: families[search.id],
                        })
                      }
                    >
                      Tilldela och avsluta sökningen
                    </Button>
                  </Box>
                )}
              </>
            )}
          </>
        );
        if (adminView) {
          const invitations = app.data.replacementInvitations.filter(
            (i) => i.search_id === search.id,
          );
          const pending = invitations.filter((i) => i.response === "pending").length;
          return (
            <Accordion
              key={search.id}
              expanded={!!expandedSearches[search.id]}
              onChange={(_, expanded) =>
                setExpandedSearches((previous) => ({
                  ...previous,
                  [search.id]: expanded,
                }))
              }
            >
              <AccordionSummary
                expandIcon={<ExpandMore sx={{ fontSize: 18 }} />}
                id={`replacement-${search.id}-summary`}
                aria-controls={`replacement-${search.id}-details`}
                sx={{ "& .MuiAccordionSummary-content": { minWidth: 0 } }}
              >
                <Box
                  sx={{
                    minWidth: 0,
                    width: "100%",
                    display: "flex",
                    alignItems: { xs: "flex-start", sm: "center" },
                    flexDirection: { xs: "column", sm: "row" },
                    gap: 1,
                  }}
                >
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      component="span"
                      sx={{
                        display: "block",
                        fontWeight: 650,
                        fontSize: "0.875rem",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {search.role} · {match?.away_team}
                    </Typography>
                    <Typography
                      component="span"
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block" }}
                    >
                      {match?.starts_at
                        ? formatDate(match.starts_at, {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Tid saknas"}{" "}
                      ·{" "}
                      {
                        app.data.families.find((f) => f.id === search.original_family_id)
                          ?.name
                      }
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 1,
                    }}
                  >
                    <Chip
                      size="small"
                      variant="outlined"
                      color={
                        search.status === "found"
                          ? "success"
                          : search.status === "exhausted"
                            ? "warning"
                            : "default"
                      }
                      label={
                        open
                          ? `Inväntar svar (${pending}) · Grupp ${search.current_group}`
                          : statuses[search.status]
                      }
                    />
                    <Typography component="span" variant="caption" color="primary.main">
                      {expandedSearches[search.id] ? "Dölj detaljer" : "Visa detaljer"}
                    </Typography>
                  </Box>
                </Box>
              </AccordionSummary>
              <AccordionDetails
                sx={{
                  p: 2,
                  pt: 0,
                  "& p": { mt: 0, mb: 1.5 },
                  "& ul": { pl: 2.5, overflowWrap: "anywhere" },
                }}
              >
                {details}
              </AccordionDetails>
            </Accordion>
          );
        }
        return (
          <Box
            key={search.id}
            sx={{
              p: 2,
              border: "1px solid",
              borderColor: "#c5dfff",
              borderRadius: 2,
              backgroundColor: "#eff6ff",
            }}
          >
            {details}
          </Box>
        );
      })}
    </Box>
  );
}
