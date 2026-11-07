import { useState } from "react";
import {
  Typography,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { Search, CircleCheck, CircleAlert, Ban } from "lucide-react";
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
  const [families, setFamilies] = useState<Record<string, string>>({});
  const searches = app.data.replacementSearches
    .filter(
      (s) =>
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
  if (!searches.length) return adminView ? <p>Inga ersättarsökningar ännu.</p> : null;
  return (
    <Box sx={{ display: "grid", gap: 2, mt: 2 }}>
      {searches.map((search) => {
        const match = app.data.matches.find((m) => m.id === search.match_id);
        const own = search.original_family_id === app.ownFamily;
        const invitation = app.data.replacementInvitations.find(
          (i) => i.search_id === search.id && i.family_id === app.ownFamily,
        );
        const open = search.status === "searching";
        const StatusIcon = {
          searching: Search,
          found: CircleCheck,
          exhausted: CircleAlert,
          cancelled: Ban,
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
        return (
          <Box
            key={search.id}
            sx={{
              p: 2,
              border: "1px solid",
              borderColor: "primary.main",
              borderRadius: 1,
              backgroundColor: "#eff6ff",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
              <Box
                sx={{ color: statusColor, display: "flex", mt: "2px" }}
                aria-hidden="true"
              >
                <StatusIcon size={22} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  component="h3"
                  sx={{ fontSize: "1rem", fontWeight: 700, color: "text.primary" }}
                >
                  {canRespond ? "Kan din familj ta passet?" : statuses[search.status]}
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
            </Box>
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
            {(open || search.status === "exhausted") && (
              <p>
                {own ? "Ni" : "Den ursprungliga familjen"} ansvarar för passet tills någon
                har tagit över.
              </p>
            )}
            {open && (
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
            {canRespond && (
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                <Button
                  variant="contained"
                  disabled={app.busy}
                  onClick={() =>
                    void app.replacementAction("accept", { searchId: search.id })
                  }
                >
                  Jag kan ta passet
                </Button>
                <Button
                  disabled={app.busy}
                  onClick={() =>
                    void app.replacementAction("decline", { searchId: search.id })
                  }
                >
                  Kan inte
                </Button>
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
          </Box>
        );
      })}
    </Box>
  );
}
