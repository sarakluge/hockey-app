import { Accordion, AccordionSummary, AccordionDetails, Typography } from "@mui/material";
import { ChevronDown } from "lucide-react";
import {
  Button,
  Checkbox,
  FormControlLabel,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import SelectField from "../components/SelectField";
import { useState, useRef } from "react";
import { ShieldCheck, RefreshCw, Upload, Download } from "lucide-react";
import type { HockeyApp } from "../hooks/useHockeyApp";
import { distribution, formatDate, type Profile } from "../lib/types";
import Badge from "../components/Badge";
import Staffing from "../components/Staffing";
import ManualImport from "../components/ManualImport";
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
    readFile,
    preview,
    setPreview,
    importApproved,
    setImportApproved,
    importData,
  } = app;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState("");
  const matches = [...data.matches].sort((first, second) =>
    (first.starts_at || "9999").localeCompare(second.starts_at || "9999"),
  );
  const activeMatch = matches.find((match) => match.id === selected) || matches[0];

  if (!admin)
    return <div className="empty-state">Endast administratörer har åtkomst.</div>;

  return (
    <div className="admin-page">
      <Paper component="section" variant="outlined" className="panel">
        <div className="section-heading">
          <h2>Bemanna en match</h2>
          <Badge tone="green">
            <ShieldCheck size={12} />
            Administratör
          </Badge>
        </div>
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
          <p>Starta matchsynchroniseringen eller importera matchdata först.</p>
        )}
        <p className="small muted">
          OVR, klocka och speaker kan bara tilldelas familjer med motsvarande behörighet.
          Flera uppgifter till samma familj förutsätter flera vuxna.
        </p>
      </Paper>
      <Paper component="section" variant="outlined" className="panel">
        <div className="section-heading">
          <h2>Rättvis fördelning</h2>
          <span className="small muted">Alla importerade matcher</span>
        </div>
        <p className="muted">
          Ett tilldelat pass räknas som ett pass. Båsdörr 1 och 2 räknas tillsammans,
          precis som i Excel.
        </p>
        <TableContainer
          tabIndex={0}
          role="region"
          aria-label="Arbetsfördelning, rulla i sidled för alla kolumner"
        >
          <Table size="small">
            <caption>Antal tilldelade pass per familj i det valda laget.</caption>
            <TableHead>
              <TableRow>
                <TableCell>Familj / spelare</TableCell>
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
                      <strong className="total-pill">{f.total}</strong>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      <Paper component="section" variant="outlined" className="panel">
        <h2>Matchdata & import</h2>
        <p className="muted">
          Automatisk uppdatering var sjätte timme efter att GitHub och Supabase är
          anslutna.
        </p>
        <div className="action-row">
          <Button variant="contained" disabled={busy} onClick={() => void sync()}>
            <RefreshCw size={16} />
            Starta Swehockey-synk
          </Button>
          <Button variant="outlined" onClick={exportData}>
            <Download size={16} />
            Exportera data
          </Button>
        </div>
        <div className="import-box">
          <Upload size={25} />
          <h3>Importera den befintliga Excel-filen</h3>
          <p>Förhandsgranska, koppla matcher och godkänn innan något sparas.</p>
          <Button
            variant="outlined"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            Välj Excel-fil
          </Button>
          <input
            ref={fileInputRef}
            hidden
            type="file"
            accept=".xlsx"
            aria-label="Excel-fil för import"
            onChange={(event) => void readFile(event.target.files?.[0])}
          />
          <small>Originalfilen ändras aldrig. Högst 5 MB.</small>
        </div>
        {preview && (
          <div className="import-preview">
            <h3>
              Förhandsvisning: {preview.rows.length} matcher · {preview.families.length}{" "}
              familjer · {preview.instructions.length} instruktioner
            </h3>
            <ul className="warning-list">
              {preview.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
            {preview.rows.map((r, index) => (
              <div className="import-row" key={index}>
                <strong>
                  {r.label} · {r.opponent}
                </strong>
                <p>
                  {r.day} · {r.arena}
                </p>
                <SelectField
                  label={`Matchkoppling ${r.label}`}
                  value={r.match_id}
                  onChange={(e) =>
                    setPreview((p) =>
                      p
                        ? {
                            ...p,
                            rows: p.rows.map((v, i) =>
                              i === index
                                ? {
                                    ...v,
                                    match_id: e.target.value,
                                    confirmed: false,
                                  }
                                : v,
                            ),
                          }
                        : p,
                    )
                  }
                >
                  <option value="">Välj verifierad match – gissa inte</option>
                  {matches.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.kind === "dm" || (demo && m.competition === "22208")
                        ? "DM"
                        : "Serie"}{" "}
                      ·{" "}
                      {m.starts_at
                        ? formatDate(m.starts_at, {
                            day: "numeric",
                            month: "short",
                          })
                        : "Tid saknas"}{" "}
                      · {m.away_team} · {m.source_id}
                    </option>
                  ))}
                </SelectField>
                <p className="small">
                  {r.assignments.map((a) => `${a.role}: ${a.name}`).join(" · ")}
                </p>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={r.confirmed}
                      disabled={!r.match_id}
                      onChange={(e) =>
                        setPreview((p) =>
                          p
                            ? {
                                ...p,
                                rows: p.rows.map((v, i) =>
                                  i === index
                                    ? {
                                        ...v,
                                        confirmed: e.target.checked,
                                      }
                                    : v,
                                ),
                              }
                            : p,
                        )
                      }
                    />
                  }
                  label={<> Jag har kontrollerat tävling, lag och match-ID.</>}
                />
              </div>
            ))}
            <Accordion>
              <AccordionSummary expandIcon={<ChevronDown size={20} />}>
                <Typography>Visa familjer och behörigheter</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {preview.families.map((f) => (
                  <p key={f.name}>
                    {f.name} · OVR: {f.ovr_ok ? "Ja" : "Nej"} · Klocka:{" "}
                    {f.clock_ok ? "Ja" : "Nej"} · Speaker: {f.speaker_ok ? "Ja" : "Nej"}
                  </p>
                ))}
              </AccordionDetails>
            </Accordion>
            <Accordion>
              <AccordionSummary expandIcon={<ChevronDown size={20} />}>
                <Typography>
                  Visa instruktioner (kan innehålla privata halluppgifter)
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                {preview.instructions.map((i, n) => (
                  <div key={n}>
                    <h4>
                      {i.title} · {i.arena}
                    </h4>
                    <p className="instruction-body">{i.body}</p>
                  </div>
                ))}
              </AccordionDetails>
            </Accordion>
            <FormControlLabel
              control={
                <Checkbox
                  checked={importApproved}
                  onChange={(e) => setImportApproved(e.target.checked)}
                />
              }
              label={
                <>
                  {" "}
                  Jag godkänner att dessa personuppgifter och instruktioner sparas privat
                  i lagets databas.
                </>
              }
            />
            <Button
              variant="contained"
              disabled={
                busy ||
                demo ||
                !importApproved ||
                preview.rows.some((r) => !r.confirmed || !r.match_id) ||
                new Set(preview.rows.map((r) => r.match_id)).size !== preview.rows.length
              }
              onClick={() => void importData()}
            >
              Godkänn och importera
            </Button>
            <Button variant="text" onClick={() => setPreview(null)}>
              Avbryt
            </Button>
            {demo && (
              <p className="small muted">
                Sparande av personuppgifter är avstängt i demoläget.
              </p>
            )}
          </div>
        )}
        <div className="sync-history">
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
            <p className="muted">Ingen synk har körts ännu.</p>
          )}
        </div>
      </Paper>
      <Paper component="section" variant="outlined" className="panel">
        <h2>Användare & godkännande</h2>
        <InviteUser demo={demo} onDone={() => void load()} />
        <p className="muted">
          Be föräldrar logga in en gång. Godkänn sedan kontot och koppla det till rätt
          familj.
        </p>
        {demo ? (
          <p>Riktiga användare visas efter att Supabase har anslutits.</p>
        ) : (
          data.profiles.map((p) => (
            <div className="profile-row" key={p.id}>
              <div>
                <strong>{p.email}</strong>
                <p className="small muted">
                  {p.approved ? "Godkänd" : "Väntar på godkännande"} ·{" "}
                  {p.role === "ADMIN" ? "Administratör" : "Förälder"}
                </p>
              </div>
              <SelectField
                label={`Familj för ${p.email}`}
                value={p.family_id || ""}
                disabled={busy}
                onChange={(e) =>
                  void updateProfile(p.id, {
                    family_id: e.target.value || null,
                  })
                }
              >
                <option value="">Ingen familjekoppling</option>
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
            </div>
          ))
        )}
      </Paper>
      <ManualImport
        onDone={() => void load()}
        demo={demo}
        homeTeam={app.team?.home_team || "Team Söderort(FOC/THH)"}
        competitions={app.competitions.map((item) => item.competition)}
      />
    </div>
  );
}
