import { ExpandMore, EditOutlined } from "@mui/icons-material";
import { instructionLinks } from "../lib/instructions";
import SelectField from "./SelectField";
import { useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  Typography,
} from "@mui/material";

import type { HockeyApp } from "../hooks/useHockeyApp";
import { INSTRUCTION_PHASES, ROLES, type Instruction } from "../lib/types";
import {
  instructionArena,
  uniqueInstructionArenas,
  instructionRole,
  normalizeGuideUrl,
} from "../lib/instructions";
import { roleIcon } from "../lib/roleIcons";

function hallFields(role: string, arena: string, existing: Instruction[] = []) {
  return Object.entries(INSTRUCTION_PHASES).flatMap(([phase, label]) => {
    const items = existing.filter((item) => (item.phase || "general") === phase);
    return items.length
      ? items.map((item) => ({ ...item, arena }))
      : [
          {
            title: `${role || "Gemensamt"} · ${label}`,
            arena,
            role,
            body: "",
            phase: phase as Instruction["phase"],
            guide_url: "",
            guide_label: "",
          },
        ];
  });
}

export default function InstructionEditor({ app }: { app: HockeyApp }) {
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [draft, setDraft] = useState<Instruction[]>([]);
  const [newArena, setNewArena] = useState("");
  const roles = [
    ...new Set([
      "",
      ...ROLES.map(instructionRole),
      ...app.data.instructions.map((item) => instructionRole(item.role)),
    ]),
  ];
  const halls = [...new Set(draft.map((item) => item.arena))];
  const availableArenas = uniqueInstructionArenas(
    app.data.matches.map((match) => match.arena),
  ).filter(
    (arena) => !halls.some((hall) => instructionArena(hall) === instructionArena(arena)),
  );
  function edit(role: string) {
    const existing = app.data.instructions.filter(
      (item) => instructionRole(item.role) === role,
    );
    const arenas = ["", ...uniqueInstructionArenas(existing.map((item) => item.arena))];
    setDraft(
      arenas.flatMap((arena) =>
        hallFields(
          role,
          arena,
          existing.filter(
            (item) => instructionArena(item.arena) === instructionArena(arena),
          ),
        ),
      ),
    );
    setEditingRole(role);
    setNewArena("");
  }
  function change(index: number, patch: Partial<Instruction>) {
    setDraft((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }
  return (
    <Box>
      <p>
        Redigera en uppgift i taget. Samla alla hallars rutiner och lathundar här och
        spara hela uppgiften samtidigt.
      </p>
      {editingRole === null ? (
        <List disablePadding aria-label="Redigera instruktioner per uppgift">
          {roles.map((role) => {
            const Icon = roleIcon(role);
            const hasContent = app.data.instructions.some(
              (item) => instructionRole(item.role) === role,
            );
            return (
              <ListItem key={role} disablePadding divider>
                <ListItemButton disabled={app.busy} onClick={() => edit(role)}>
                  <ListItemIcon>
                    <Icon sx={{ fontSize: 24 }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={role || "Gemensamt för alla uppgifter"}
                    secondary={
                      hasContent ? "Redigera instruktioner" : "Lägg till instruktioner"
                    }
                  />
                  <EditOutlined sx={{ fontSize: 18 }} />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      ) : (
        <Box
          component="form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await app.saveRoleInstructions(editingRole, draft)) setEditingRole(null);
          }}
        >
          <Typography
            component="h3"
            sx={{ fontSize: "1.125rem", fontWeight: 700, mb: 1 }}
          >
            {editingRole || "Gemensamt för alla uppgifter"}
          </Typography>
          <p>
            Fyll bara i delarna som behövs. En enkel uppgift kan ha en enda allmän
            instruktion. Lämna övriga fält tomma. Rensar du en befintlig text och dess
            länk tas den delen bort när du sparar.
          </p>
          {halls.map((arena) => (
            <Accordion key={arena} defaultExpanded={!arena} sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMore sx={{ fontSize: 20 }} />}>
                <Typography component="h4" sx={{ fontWeight: 700 }}>
                  {arena || "Gemensamt för alla hallar"}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                {draft.map((item, index) =>
                  item.arena !== arena ? null : (
                    <Box key={index} sx={{ display: "grid", gap: 1.5, mb: 3 }}>
                      <TextField
                        label={INSTRUCTION_PHASES[item.phase || "general"]}
                        multiline
                        minRows={3}
                        value={item.body}
                        disabled={app.busy}
                        onChange={(event) => change(index, { body: event.target.value })}
                      />
                      <Box>
                        {instructionLinks(item).map((link, linkIndex) => (
                          <Box key={linkIndex} sx={{ display: "grid", gap: 1.5, mb: 2 }}>
                            <TextField
                              label={`Länktext ${linkIndex + 1}`}
                              value={link.label}
                              disabled={app.busy}
                              onChange={(event) =>
                                change(index, {
                                  links: instructionLinks(item).map((current, i) =>
                                    i === linkIndex
                                      ? { ...current, label: event.target.value }
                                      : current,
                                  ),
                                })
                              }
                            />
                            <TextField
                              label={`Guidelänk ${linkIndex + 1}`}
                              type="url"
                              required
                              value={link.url}
                              disabled={app.busy}
                              onChange={(event) =>
                                change(index, {
                                  links: instructionLinks(item).map((current, i) =>
                                    i === linkIndex
                                      ? {
                                          ...current,
                                          url: normalizeGuideUrl(event.target.value),
                                        }
                                      : current,
                                  ),
                                })
                              }
                            />
                            <Button
                              color="error"
                              disabled={app.busy}
                              sx={{ justifySelf: "start" }}
                              onClick={() =>
                                change(index, {
                                  links: instructionLinks(item).filter(
                                    (_, i) => i !== linkIndex,
                                  ),
                                })
                              }
                            >
                              Ta bort länk {linkIndex + 1}
                            </Button>
                          </Box>
                        ))}
                        <Button
                          disabled={app.busy}
                          onClick={() =>
                            change(index, {
                              links: [...instructionLinks(item), { url: "", label: "" }],
                            })
                          }
                        >
                          Lägg till länk
                        </Button>
                      </Box>
                    </Box>
                  ),
                )}
              </AccordionDetails>
            </Accordion>
          ))}
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 1,
              alignItems: "center",
              my: 2,
            }}
          >
            <SelectField
              label="Hall från lagets hemmamatcher"
              value={availableArenas.includes(newArena) ? newArena : ""}
              disabled={app.busy || !availableArenas.length}
              onChange={(event) => setNewArena(event.target.value)}
              helperText={
                availableArenas.length
                  ? "Välj en befintlig matchhall för att koppla instruktionerna rätt."
                  : "Inga fler hallar att lägga till. Hämta hemmamatcher för att få fler hallval."
              }
              sx={{ flex: 1, minWidth: 200 }}
            >
              <option value="" disabled>
                Välj hall
              </option>
              {availableArenas.map((arena) => (
                <option key={arena} value={arena}>
                  {arena}
                </option>
              ))}
            </SelectField>
            <Button
              disabled={
                app.busy ||
                !availableArenas.includes(newArena) ||
                halls.some(
                  (arena) => instructionArena(arena) === instructionArena(newArena),
                )
              }
              onClick={() => {
                if (!availableArenas.includes(newArena)) return;
                setDraft((current) => [
                  ...current,
                  ...hallFields(editingRole, newArena.trim()),
                ]);
                setNewArena("");
              }}
            >
              Lägg till hall
            </Button>
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button type="submit" variant="contained" disabled={app.busy}>
              Spara {editingRole || "gemensamma instruktioner"}
            </Button>
            <Button disabled={app.busy} onClick={() => setEditingRole(null)}>
              Avbryt
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}
