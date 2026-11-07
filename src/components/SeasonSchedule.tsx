import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";
import type { HockeyApp } from "../hooks/useHockeyApp";
import { distribution, eligible, formatDate, ROLES, type Assignment } from "../lib/types";
import {
  generateSchedule,
  protectedAssignment,
  schedulable,
  slotKey,
} from "../lib/scheduling";
import AdminPanel from "./AdminPanel";
import SelectField from "./SelectField";

export default function SeasonSchedule({ app }: { app: HockeyApp }) {
  const [redo, setRedo] = useState(false);
  const [draft, setDraft] = useState<Assignment[] | null>(null);
  const [base, setBase] = useState<Assignment[]>([]);
  const [seed, setSeed] = useState(0);
  const [selected, setSelected] = useState("");
  const { data, busy } = app;
  const matches = data.matches
    .filter((m) => schedulable(m))
    .sort((a, b) => a.starts_at!.localeCompare(b.starts_at!));
  const match = matches.find((m) => m.id === selected) || matches[0];
  const missing = draft
    ? matches.reduce(
        (n, m) =>
          n +
          ROLES.filter((r) => !draft.some((a) => a.match_id === m.id && a.role === r))
            .length,
        0,
      )
    : 0;
  return (
    <AdminPanel title="Skapa schema" summary={`${matches.length} kommande matcher`}>
      <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 2, "& li": { mb: 1 } }}>
        <li>Skapa ett förslag för hela säsongens kommande matcher.</li>
        <li>
          OVR, klocka och speaker/musik bemannas först med familjer som valt uppgiften.
        </li>
        <li>
          Förslaget tar hänsyn till otillgänglighet och fördelar passen utifrån tidigare
          tilldelningar, variation och spridning över säsongen.
        </li>
        <li>
          Automatisk schemaläggning ger högst ett pass per familj och match. Du kan
          manuellt ge samma familj flera positioner.
        </li>
        <li>Familjer som markerats som undantagna väljs bara manuellt av admin.</li>
        <li>
          Genomförda pass, låsta pass och pass med pågående ersättarsökning bevaras
          alltid.
        </li>
        <li>
          Granska förslaget, ändra manuellt eller generera ett nytt. Familjerna ser de nya
          passen först när du klickar på ”Godkänn och publicera schema”.
        </li>
      </Box>
      <FormControlLabel
        control={
          <Checkbox
            checked={redo}
            disabled={busy}
            onChange={(e) => setRedo(e.target.checked)}
          />
        }
        label="Fördela även om redan tilldelade, olåsta pass"
      />
      <Box component="p" sx={{ color: "text.secondary", fontSize: "0.875rem", mb: 2 }}>
        {redo
          ? "Ikryssad: förslaget får byta familj på redan tilldelade, olåsta pass i kommande matcher. Skyddade pass bevaras. Ändringen sker först när du publicerar."
          : "Ej ikryssad: alla befintliga tilldelningar behålls. Förslaget fyller bara obemannade positioner."}
      </Box>
      <Button
        variant="contained"
        disabled={busy || !matches.length}
        onClick={() => {
          setBase(data.assignments);
          setDraft(generateSchedule(data, redo, seed));
          setSeed(seed + 1);
        }}
      >
        {" "}
        {draft ? "Generera nytt förslag" : "Skapa schema"}
      </Button>
      {draft && (
        <Box sx={{ display: "grid", gap: 2, mt: 2 }}>
          <Alert severity={missing ? "warning" : "success"}>
            {missing
              ? `${missing} obemannade positioner. De visas som Ej tillsatt i matchlistan nedan.`
              : "Alla positioner är bemannade."}{" "}
            Förslaget visas för familjerna först när du publicerar. Manuella ändringar
            låses automatiskt.
          </Alert>
          <SelectField
            label="Förhandsgranska match"
            value={match?.id || ""}
            onChange={(e) => setSelected(e.target.value)}
          >
            {matches.map((m) => (
              <option key={m.id} value={m.id}>
                {formatDate(m.starts_at!, { day: "numeric", month: "short" })} ·{" "}
                {m.away_team} ·{" "}
                {
                  ROLES.filter(
                    (r) => !draft.some((a) => a.match_id === m.id && a.role === r),
                  ).length
                }{" "}
                obemannade
              </option>
            ))}
          </SelectField>
          {match &&
            ROLES.map((role) => {
              const a = draft.find((a) => a.match_id === match.id && a.role === role);
              const original = base.find(
                (a) => a.match_id === match.id && a.role === role,
              );
              const protectedSlot = original && protectedAssignment(original, data);
              return (
                <Box key={role} sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                  <SelectField
                    label={role}
                    value={a?.family_id || ""}
                    disabled={busy || !!protectedSlot}
                    onChange={(e) =>
                      setDraft((rows) => [
                        ...rows!.filter(
                          (x) => slotKey(x) !== slotKey({ match_id: match.id, role }),
                        ),
                        ...(e.target.value
                          ? [
                              {
                                match_id: match.id,
                                role,
                                family_id: e.target.value,
                                locked: true,
                              },
                            ]
                          : []),
                      ])
                    }
                  >
                    <option value="">Ej tillsatt</option>
                    {data.families
                      .filter(
                        (f) =>
                          f.id === a?.family_id ||
                          (eligible(f, role) &&
                            !data.unavailability.some(
                              (u) => u.match_id === match.id && u.family_id === f.id,
                            )),
                      )
                      .map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                  </SelectField>
                  {a && (
                    <FormControlLabel
                      label="Låst"
                      control={
                        <Checkbox
                          checked={!!a.locked}
                          disabled={busy || !!protectedSlot}
                          onChange={(e) =>
                            setDraft((rows) =>
                              rows!.map((x) =>
                                slotKey(x) === slotKey(a)
                                  ? { ...x, locked: e.target.checked }
                                  : x,
                              ),
                            )
                          }
                        />
                      }
                    />
                  )}
                </Box>
              );
            })}
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <caption>
                Antal pass inklusive genomförda och tidigare tilldelningar.
              </caption>
              <TableHead>
                <TableRow>
                  <TableCell>Familj</TableCell>
                  <TableCell>Nu</TableCell>
                  <TableCell>Efter publicering</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {distribution(data.families, draft).map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>{f.name}</TableCell>
                    <TableCell>
                      {base.filter((a) => a.family_id === f.id).length}
                    </TableCell>
                    <TableCell>{f.total}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
          <Button
            variant="contained"
            disabled={busy}
            onClick={async () => {
              if (await app.publishSchedule(base, draft)) setDraft(null);
            }}
          >
            Godkänn och publicera schema
          </Button>
          <Button disabled={busy} onClick={() => setDraft(null)}>
            Kasta förslaget
          </Button>
        </Box>
      )}
    </AdminPanel>
  );
}
