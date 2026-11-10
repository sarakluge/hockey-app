import { Refresh, Download } from "@mui/icons-material";
import { instructionRole } from "../lib/instructions";
import InstructionEditor from "../components/InstructionEditor";
import SeasonSchedule from "../components/SeasonSchedule";
import ReplacementSearches from "../components/ReplacementSearches";
import AdminPanel from "../components/AdminPanel";
import { Box } from "@mui/material";
import {
  Button,
  TextField,
  Checkbox,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import SelectField from "../components/SelectField";
import { useState } from "react";

import type { HockeyApp } from "../hooks/useHockeyApp";
import { distribution, formatDate, type Profile } from "../lib/types";
import Badge from "../components/Badge";
import Staffing from "../components/Staffing";
import InviteUser from "../components/InviteUser";
import UserApprovalCard from "../components/UserApprovalCard";

export default function AdminPage({ app }: { app: HockeyApp }) {
  const {
    data,
    demo,
    admin,
    busy,
    userId,
    assign,
    updateProfile,
    load,
    sync,
    exportData,
  } = app;
  const [playerNames, setPlayerNames] = useState("");
  const [selected, setSelected] = useState("");
  const [onlyMissingAccounts, setOnlyMissingAccounts] = useState(false);
  const [userSort, setUserSort] = useState("parent");
  const linkedPlayerNames = new Map(
    data.families.map((player) => [player.id, player.name]),
  );
  const parentName = (profile: Profile) => profile.parent_name?.trim() || profile.email;
  const waitingUsers = data.profiles.filter((profile) => !profile.approved);
  const approvedUsers = data.profiles
    .filter((profile) => profile.approved)
    .sort((a, b) => {
      if (userSort === "child") {
        const aChild = linkedPlayerNames.get(a.family_id || "") || "";
        const bChild = linkedPlayerNames.get(b.family_id || "") || "";
        // Keep approved accounts without a linked player last.
        if (Boolean(aChild) !== Boolean(bChild)) return aChild ? -1 : 1;
        const byChild = aChild.localeCompare(bChild, "sv");
        if (byChild) return byChild;
      }
      return (
        parentName(a).localeCompare(parentName(b), "sv") ||
        a.email.localeCompare(b.email, "sv") ||
        a.id.localeCompare(b.id)
      );
    });
  const playersWithAccounts = [...data.families]
    .sort((a, b) => a.name.localeCompare(b.name, "sv"))
    .map((player) => ({
      player,
      parents: data.profiles.filter((profile) => profile.family_id === player.id),
    }));
  const missingAccounts = playersWithAccounts.filter(
    ({ parents }) => !parents.length,
  ).length;
  const pendingAccounts = playersWithAccounts.filter(
    ({ parents }) => parents.length > 0 && !parents.some((parent) => parent.approved),
  ).length;
  const matches = [...data.matches].sort((first, second) =>
    (first.starts_at || "9999").localeCompare(second.starts_at || "9999"),
  );
  const activeSearches = data.replacementSearches.filter(
    (s) => s.status === "searching",
  ).length;
  const pendingUsers = data.profiles.filter((p) => !p.approved).length;
  const activeMatch = matches.find((match) => match.id === selected) || matches[0];

  if (!admin)
    return (
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
        Endast administratörer har åtkomst.
      </Box>
    );

  return (
    <Box>
      <SeasonSchedule app={app} />
      <AdminPanel
        title="Instruktioner & guider"
        summary={`${new Set(data.instructions.map((item) => instructionRole(item.role))).size} instruktioner`}
      >
        <InstructionEditor app={app} />
      </AdminPanel>
      <AdminPanel
        title="Ersättarsökningar"
        summary={`${activeSearches} pågående`}
        attention={activeSearches > 0}
      >
        <ReplacementSearches app={app} adminView />
      </AdminPanel>
      <AdminPanel title="Bemanna en match" summary={`${matches.length} matcher`}>
        <SelectField
          label="Välj hemmamatch"
          value={activeMatch?.id || ""}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="" disabled>
            Välj match
          </option>
          {matches.map((m) => (
            <option key={m.id} value={m.id}>
              {m.starts_at
                ? formatDate(m.starts_at, {
                    day: "numeric",
                    month: "short",
                  })
                : "Tid saknas"}{" "}
              · {m.away_team} ·{" "}
              {m.kind === "dm" || (demo && m.competition === "22208") ? "DM" : "Serie"}
            </option>
          ))}
        </SelectField>
        {activeMatch ? (
          <Staffing match={activeMatch} data={data} busy={busy} onAssign={assign} />
        ) : (
          <p>Hämta lagets matcher från Swehockey för att börja bemanna.</p>
        )}
        <Box component="p" sx={{ color: "text.secondary", fontSize: "0.8125rem" }}>
          OVR, klocka och speaker kan bara tilldelas spelare vars föräldrar har
          motsvarande behörighet. Schemageneratorn tilldelar högst ett pass per familj och
          match.
        </Box>
      </AdminPanel>
      <AdminPanel
        title="Spelare"
        summary={
          demo
            ? `${data.families.length} spelare · demo`
            : `${data.families.length} spelare · ${missingAccounts} saknar kopplat konto`
        }
        attention={!demo && missingAccounts > 0}
      >
        <p>
          Lägg in barnens för- och efternamn, ett namn per rad. Flera föräldrar kan
          kopplas till samma spelare.
        </p>
        <Box
          component="form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await app.addPlayers(playerNames)) setPlayerNames("");
          }}
          sx={{ display: "grid", gap: 2 }}
        >
          <TextField
            label="Spelarnamn – ett per rad"
            multiline
            minRows={3}
            value={playerNames}
            onChange={(e) => setPlayerNames(e.target.value)}
            required
            disabled={busy}
          />
          <Button
            type="submit"
            variant="contained"
            disabled={busy || !playerNames.trim()}
          >
            Lägg till spelare
          </Button>
        </Box>
        {!data.families.length && <p>Inga spelare tillagda ännu.</p>}
        <Box component="p" sx={{ mt: 2, color: "text.secondary" }}>
          {demo
            ? "Demoläge – riktiga kontokopplingar visas när Supabase är anslutet."
            : `${data.families.length - missingAccounts} av ${data.families.length} spelare har ett kopplat konto. ${pendingAccounts} har bara konton som väntar på godkännande.`}
        </Box>
        <Box component="p" sx={{ color: "text.secondary" }}>
          Saknar kopplat konto betyder att ingen förälder har kopplats till spelaren.
          Kontrollera även Användare & godkännande innan du påminner familjen – ett
          registrerat konto kan fortfarande sakna spelarkoppling.
        </Box>
        <FormControlLabel
          label={`Visa bara spelare som saknar kopplat konto${demo ? "" : ` (${missingAccounts})`}`}
          control={
            <Checkbox
              checked={onlyMissingAccounts}
              onChange={(event) => setOnlyMissingAccounts(event.target.checked)}
              disabled={demo}
            />
          }
        />
        {onlyMissingAccounts && !missingAccounts && data.families.length > 0 && (
          <p>Alla spelare har minst ett kopplat konto.</p>
        )}
        {playersWithAccounts
          .filter(({ parents }) => !onlyMissingAccounts || !parents.length)
          .map(({ player, parents }) => (
            <Box key={player.id} sx={{ py: 2, borderBottom: "1px solid #dfe6ef" }}>
              <Box
                sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}
              >
                <strong>{player.name}</strong>
                {!demo && (
                  <Badge
                    tone={parents.some((parent) => parent.approved) ? "green" : "amber"}
                  >
                    {!parents.length
                      ? "Saknar kopplat konto"
                      : parents.some((parent) => parent.approved)
                        ? "Godkänt konto kopplat"
                        : "Väntar på godkännande"}
                  </Badge>
                )}
              </Box>
              {!demo && parents.length > 0 && (
                <Box component="ul" sx={{ my: 1, pl: 2.5, overflowWrap: "anywhere" }}>
                  {parents.map((parent) => (
                    <li key={parent.id}>
                      {parent.parent_name
                        ? `${parent.parent_name} (${parent.email})`
                        : parent.email}
                      {" · "}
                      {parent.approved ? "Godkänd" : "Väntar på godkännande"}
                    </li>
                  ))}
                </Box>
              )}
              <Box sx={{ display: "flex", flexWrap: "wrap" }}>
                {(
                  [
                    [
                      "staffing_exempt",
                      "Undantagen från schema och ersättarförfrågningar",
                    ],
                    ["ovr_ok", "OVR"],
                    ["clock_ok", "Klocka"],
                    ["speaker_ok", "Speaker/Musik"],
                  ] as const
                ).map(([key, label]) => (
                  <FormControlLabel
                    key={key}
                    label={label}
                    control={
                      <Checkbox
                        checked={player[key]}
                        disabled={busy}
                        slotProps={{
                          input: { "aria-label": `${label} för ${player.name}` },
                        }}
                        onChange={(e) =>
                          void app.updatePlayer(player.id, { [key]: e.target.checked })
                        }
                      />
                    }
                  />
                ))}
              </Box>
            </Box>
          ))}
        <p>
          Undantagna familjer kan fortfarande tilldelas pass manuellt av admin. Befintliga
          pass behålls. Behörigheterna gäller de vuxna som bemannar spelarens pass.
          Markera dem när någon av dem kan uppgiften.
        </p>
      </AdminPanel>
      <AdminPanel title="Rättvis fördelning" summary="Alla lagets matcher">
        <Box component="p" sx={{ color: "text.secondary" }}>
          Ett tilldelat pass räknas som ett pass. Båsdörr 1 och 2 räknas tillsammans.
        </Box>
        <TableContainer
          tabIndex={0}
          role="region"
          aria-label="Arbetsfördelning, rulla i sidled för alla kolumner"
        >
          <Table size="small">
            <caption>Antal tilldelade pass per spelare i det valda laget.</caption>
            <TableHead>
              <TableRow>
                <TableCell>Spelare</TableCell>
                <TableCell>Båsdörr</TableCell>
                <TableCell>OVR</TableCell>
                <TableCell>Klocka</TableCell>
                <TableCell>Speaker</TableCell>
                <TableCell>Matchvärd</TableCell>
                <TableCell>Totalt</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {distribution(data.families, data.assignments)
                .sort((a, b) => a.total - b.total)
                .map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>{f.name}</TableCell>
                    <TableCell>{f.counts[0] + f.counts[1]}</TableCell>
                    {f.counts.slice(2).map((c, i) => (
                      <TableCell key={i}>{c}</TableCell>
                    ))}
                    <TableCell>
                      <Box
                        component="strong"
                        sx={{
                          background: "#edf5ff",
                          color: "#0b2241",
                          padding: "4px 8px",
                          borderRadius: "5px",
                        }}
                      >
                        {f.total}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      </AdminPanel>
      <AdminPanel
        title="Matchhämtning"
        summary={
          data.logs.slice().sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
            ?.success === false
            ? "Senaste hämtning misslyckades"
            : undefined
        }
        attention={
          data.logs.slice().sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
            ?.success === false
        }
      >
        <Box component="p" sx={{ color: "text.secondary" }}>
          Lagets hemmamatcher hämtas från Swehockey. Datum, tider och arenor uppdateras
          vid synk, och bemanningen finns kvar.
        </Box>
        <Box
          sx={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            alignItems: "center",
            "& > .MuiFormControl-root": { flex: 1, minWidth: "170px" },
          }}
        >
          <Button
            variant="contained"
            disabled={busy || (!demo && !app.team?.sync_enabled)}
            onClick={() => void sync()}
          >
            <Refresh sx={{ fontSize: 16 }} />
            Hämta matcher
          </Button>
          <Button variant="outlined" onClick={exportData}>
            <Download sx={{ fontSize: 16 }} />
            Exportera data
          </Button>
        </Box>
        <Box component="p" sx={{ color: "text.secondary" }} role="status">
          {demo
            ? "Demoläge – inga matcher hämtas från Swehockey."
            : app.team?.sync_enabled
              ? "Tryck på Hämta matcher för att uppdatera direkt från Swehockey."
              : "Matchhämtningen är inte aktiverad för laget ännu. Kontakta appansvarig."}
        </Box>
        <Button variant="text" disabled={busy || demo} onClick={() => void load()}>
          Uppdatera status och matchlista
        </Button>
        <Box sx={{ marginTop: "24px" }}>
          <h3>Senaste uppdateringar</h3>
          {data.logs.length ? (
            data.logs
              .slice()
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .slice(0, 10)
              .map((l) => (
                <p key={l.id}>
                  <Badge tone={l.success ? "green" : "amber"}>
                    {l.success ? "Klar" : "Fel"}
                  </Badge>{" "}
                  {formatDate(l.created_at, {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  · {l.message}
                </p>
              ))
          ) : (
            <Box component="p" sx={{ color: "text.secondary" }}>
              Ingen synk har körts ännu.
            </Box>
          )}
        </Box>
      </AdminPanel>
      <AdminPanel
        title="Användare & godkännande"
        summary={
          pendingUsers
            ? `${pendingUsers} väntar på godkännande`
            : `${data.profiles.length} användare`
        }
        attention={pendingUsers > 0}
      >
        <InviteUser demo={demo} onDone={() => void load()} />
        <Box component="p" sx={{ color: "text.secondary" }}>
          Be föräldrar skapa konto och logga in. Kontrollera angivet barnnamn, välj rätt
          spelare och godkänn sedan kontot.
        </Box>
        {demo ? (
          <p>Riktiga användare visas efter att Supabase har anslutits.</p>
        ) : (
          <Box>
            {[
              { id: "waiting", title: "Väntar på godkännande", users: waitingUsers },
              { id: "approved", title: "Godkända användare", users: approvedUsers },
            ].map((group) => (
              <Box
                component="section"
                key={group.id}
                aria-labelledby={`${group.id}-users-heading`}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 2,
                    mt: 2,
                    mb: 2,
                  }}
                >
                  <Box component="h3" id={`${group.id}-users-heading`} sx={{ m: 0 }}>
                    {group.title} ({group.users.length})
                  </Box>
                  {group.id === "approved" && (
                    <SelectField
                      label="Sortera användare efter"
                      value={userSort}
                      onChange={(event) => setUserSort(event.target.value)}
                      sx={{ width: { xs: "100%", sm: 250 }, ml: "auto" }}
                    >
                      <option value="parent">Förälderns namn</option>
                      <option value="child">Kopplat barns namn</option>
                    </SelectField>
                  )}
                </Box>
                {group.users.length === 0 && (
                  <Box component="p" sx={{ color: "text.secondary" }}>
                    {group.id === "waiting"
                      ? "Inga användare väntar på godkännande."
                      : "Inga godkända användare ännu."}
                  </Box>
                )}
                {group.users.map((profile) => (
                  <UserApprovalCard
                    key={profile.id}
                    profile={profile}
                    families={data.families}
                    busy={busy}
                    userId={userId}
                    onUpdate={updateProfile}
                  />
                ))}
              </Box>
            ))}
          </Box>
        )}
      </AdminPanel>
    </Box>
  );
}
