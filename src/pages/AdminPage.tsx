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
import { ShieldCheck, RefreshCw, Download } from "lucide-react";
import type { HockeyApp } from "../hooks/useHockeyApp";
import { distribution, formatDate, type Profile } from "../lib/types";
import Badge from "../components/Badge";
import Staffing from "../components/Staffing";
import InviteUser from "../components/InviteUser";

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
  const matches = [...data.matches].sort((first, second) =>
    (first.starts_at || "9999").localeCompare(second.starts_at || "9999"),
  );
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
      <AdminPanel>
        <h2>Ersättarsökningar</h2>
        <ReplacementSearches app={app} adminView />
      </AdminPanel>
      <AdminPanel>
        <h2>Spelare</h2>
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
        {[...data.families]
          .sort((a, b) => a.name.localeCompare(b.name, "sv"))
          .map((player) => (
            <Box key={player.id} sx={{ py: 2, borderBottom: "1px solid #dfe6ef" }}>
              <strong>{player.name}</strong>
              <Box sx={{ display: "flex", flexWrap: "wrap" }}>
                {(
                  [
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
          Behörigheterna gäller de vuxna som bemannar spelarens pass. Markera dem när
          någon av dem kan uppgiften.
        </p>
      </AdminPanel>
      <AdminPanel>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
            marginBottom: "16px",
            "& h2": { marginBottom: "0" },
          }}
        >
          <h2>Bemanna en match</h2>
          <Badge tone="green">
            <ShieldCheck size={12} />
            Administratör
          </Badge>
        </Box>
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
          motsvarande behörighet. Flera uppgifter till samma spelare förutsätter flera
          vuxna.
        </Box>
      </AdminPanel>
      <AdminPanel>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
            marginBottom: "16px",
            "& h2": { marginBottom: "0" },
          }}
        >
          <h2>Rättvis fördelning</h2>
          <Box component="span" sx={{ color: "text.secondary", fontSize: "0.8125rem" }}>
            Alla lagets matcher
          </Box>
        </Box>
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
      <AdminPanel>
        <h2>Matcher från Swehockey</h2>
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
            <RefreshCw size={16} />
            Hämta matcher
          </Button>
          <Button variant="outlined" onClick={exportData}>
            <Download size={16} />
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
      <AdminPanel>
        <h2>Användare & godkännande</h2>
        <InviteUser demo={demo} onDone={() => void load()} />
        <Box component="p" sx={{ color: "text.secondary" }}>
          Be föräldrar skapa konto och logga in. Kontrollera angivet barnnamn, välj rätt
          spelare och godkänn sedan kontot.
        </Box>
        {demo ? (
          <p>Riktiga användare visas efter att Supabase har anslutits.</p>
        ) : (
          data.profiles.map((p) => (
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                alignItems: "center",
                padding: "20px 0",
                borderTop: "1px solid #dfe6ef",
                "& > div:first-child": { flexBasis: "100%", overflowWrap: "anywhere" },
                "& > .MuiFormControl-root": { flex: "1", minWidth: "150px" },
              }}
              key={p.id}
            >
              <div>
                <strong>{p.parent_name || p.email}</strong>
                {p.parent_name && <div>{p.email}</div>}
                <div>
                  {p.family_id
                    ? `Förälder till ${data.families.find((f) => f.id === p.family_id)?.name || "okänd spelare"}`
                    : "Ingen spelarkoppling"}
                </div>
                {p.child_name && <div>Angivet barn vid registrering: {p.child_name}</div>}
                <Box
                  component="p"
                  sx={{ color: "text.secondary", fontSize: "0.8125rem" }}
                >
                  {p.approved ? "Godkänd" : "Väntar på godkännande"} ·{" "}
                  {p.role === "ADMIN" ? "Administratör" : "Förälder"}
                </Box>
              </div>
              <SelectField
                label={`Spelare för ${p.parent_name || p.email}`}
                value={p.family_id || ""}
                disabled={busy}
                onChange={(e) =>
                  void updateProfile(p.id, {
                    family_id: e.target.value || null,
                  })
                }
              >
                <option value="">Ingen spelarkoppling</option>
                {data.families.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label={`Roll för ${p.email}`}
                disabled={busy || p.id === userId}
                value={p.role}
                onChange={(e) =>
                  void updateProfile(p.id, {
                    role: e.target.value as Profile["role"],
                  })
                }
              >
                <option value="PARENT">Förälder</option>
                <option value="ADMIN">Administratör</option>
              </SelectField>
              <Button
                variant="outlined"
                disabled={busy || p.id === userId}
                onClick={() =>
                  void updateProfile(p.id, {
                    approved: !p.approved,
                  })
                }
              >
                {p.approved ? "Återkalla" : "Godkänn"}
              </Button>
            </Box>
          ))
        )}
      </AdminPanel>
    </Box>
  );
}
