import AdminPanel from "../components/AdminPanel";
import { Box } from "@mui/material";
import { Accordion, AccordionSummary, AccordionDetails, Typography } from "@mui/material";
import { ChevronDown } from "lucide-react";
import {
  Button,
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
          <p>Starta matchsynchroniseringen eller importera matchdata först.</p>
        )}
        <Box component="p" sx={{ color: "text.secondary", fontSize: "0.8125rem" }}>
          OVR, klocka och speaker kan bara tilldelas familjer med motsvarande behörighet.
          Flera uppgifter till samma familj förutsätter flera vuxna.
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
            Alla importerade matcher
          </Box>
        </Box>
        <Box component="p" sx={{ color: "text.secondary" }}>
          Ett tilldelat pass räknas som ett pass. Båsdörr 1 och 2 räknas tillsammans,
          precis som i Excel.
        </Box>
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
        <h2>Matchdata & import</h2>
        <Box component="p" sx={{ color: "text.secondary" }}>
          Automatisk uppdatering var sjätte timme efter att GitHub och Supabase är
          anslutna.
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
          <Button variant="contained" disabled={busy} onClick={() => void sync()}>
            <RefreshCw size={16} />
            Starta Swehockey-synk
          </Button>
          <Button variant="outlined" onClick={exportData}>
            <Download size={16} />
            Exportera data
          </Button>
        </Box>
        <Box
          sx={{
            background: "#f7f9fc",
            border: "1px dashed #bccbdd",
            borderRadius: "12px",
            padding: "24px",
            margin: "24px 0",
            textAlign: "center",
            "& > svg": { display: "block", color: "#365d85", margin: "0 auto 15px" },
            "& small": { display: "block", marginTop: "10px", color: "#58677b" },
          }}
        >
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
        </Box>
        {preview && (
          <Box
            sx={{
              "& .MuiFormControlLabel-root": {
                display: "flex",
                marginTop: "12px",
                marginBottom: "16px",
              },
              "& details": { margin: "16px 0" },
            }}
          >
            <h3>
              Förhandsvisning: {preview.rows.length} matcher · {preview.families.length}{" "}
              familjer · {preview.instructions.length} instruktioner
            </h3>
            <Box
              component="ul"
              sx={{ color: "#885400", paddingLeft: "22px", lineHeight: "1.7" }}
            >
              {preview.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </Box>
            {preview.rows.map((r, index) => (
              <Box
                sx={{
                  borderTop: "1px solid #dfe6ef",
                  padding: "20px 0",
                  "& > .MuiFormControl-root": { margin: "12px 0" },
                }}
                key={index}
              >
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
                <Box
                  component="p"
                  sx={{ color: "text.secondary", fontSize: "0.8125rem" }}
                >
                  {r.assignments.map((a) => `${a.role}: ${a.name}`).join(" · ")}
                </Box>
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
              </Box>
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
                    <Box component="p" sx={{ whiteSpace: "pre-wrap" }}>
                      {i.body}
                    </Box>
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
              <Box component="p" sx={{ color: "text.secondary", fontSize: "0.8125rem" }}>
                Sparande av personuppgifter är avstängt i demoläget.
              </Box>
            )}
          </Box>
        )}
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
          Be föräldrar logga in en gång. Godkänn sedan kontot och koppla det till rätt
          familj.
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
                <strong>{p.email}</strong>
                <Box
                  component="p"
                  sx={{ color: "text.secondary", fontSize: "0.8125rem" }}
                >
                  {p.approved ? "Godkänd" : "Väntar på godkännande"} ·{" "}
                  {p.role === "ADMIN" ? "Administratör" : "Förälder"}
                </Box>
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
            </Box>
          ))
        )}
      </AdminPanel>
      <ManualImport
        onDone={() => void load()}
        demo={demo}
        homeTeam={app.team?.home_team || "Team Söderort(FOC/THH)"}
        competitions={app.competitions.map((item) => item.competition)}
      />
    </Box>
  );
}
