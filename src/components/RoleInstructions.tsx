import { instructionLinks } from "../lib/instructions";
import InstructionText from "./InstructionText";
import { ChevronRight, ArrowLeft } from "lucide-react";
import { roleIcon } from "../lib/roleIcons";
import { instructionsForRole, uniqueInstructionArenas } from "../lib/instructions";
import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Link,
} from "@mui/material";
import { INSTRUCTION_PHASES, ROLES, type Instruction } from "../lib/types";
import { instructionArena, instructionHref, instructionRole } from "../lib/instructions";
import SelectField from "./SelectField";

function selection() {
  const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
  return {
    role: instructionRole(params.get("role") || ""),
    arena: params.get("arena") || "",
  };
}

export default function RoleInstructions({
  instructions,
  arenas,
}: {
  instructions: Instruction[];
  arenas: string[];
}) {
  const [selected, setSelected] = useState(selection);
  useEffect(() => {
    const update = () => setSelected(selection());
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  const roles = [
    ...new Set([
      ...ROLES.map(instructionRole),
      ...instructions.map((item) => instructionRole(item.role)).filter(Boolean),
    ]),
  ];
  const halls = uniqueInstructionArenas([
    ...arenas,
    ...instructions.map((item) => item.arena),
    selected.arena,
  ]);
  const selectedHall =
    halls.find((arena) => instructionArena(arena) === instructionArena(selected.arena)) ||
    "";
  const relevant = instructionsForRole(instructions, selected.role, selected.arena);
  const RoleIcon = roleIcon(selected.role);
  const arenaGroups = ["", ...uniqueInstructionArenas(relevant.map((item) => item.arena))]
    .map((arena) => ({
      arena,
      items: relevant.filter(
        (item) => instructionArena(item.arena) === instructionArena(arena),
      ),
    }))
    .filter((group) => group.items.length);
  return (
    <Paper component="section" variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
      {!selected.role ? (
        <>
          <Typography component="h2" variant="h2" sx={{ mb: 1 }}>
            Instruktioner för ditt pass
          </Typography>
          <Typography sx={{ mb: 2 }}>
            Välj uppgift för att se vad du behöver göra och hitta rätt lathund.
          </Typography>
          <List disablePadding aria-label="Instruktioner per uppgift">
            {roles.map((role) => {
              const Icon = roleIcon(role);
              return (
                <ListItem key={role} disablePadding divider>
                  <ListItemButton
                    component="a"
                    href={instructionHref(role)}
                    sx={{ py: 1.5 }}
                  >
                    <ListItemIcon sx={{ minWidth: 40, color: "primary.main" }}>
                      <Icon size={24} />
                    </ListItemIcon>
                    <ListItemText primary={role} />
                    <ChevronRight size={20} aria-hidden="true" />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </>
      ) : (
        <>
          <Button
            href="#instruktioner"
            startIcon={<ArrowLeft size={16} />}
            sx={{ mb: 2 }}
          >
            Alla uppgifter
          </Button>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 2,
              pb: 2.5,
              mb: 2.5,
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                component="h2"
                sx={{
                  fontWeight: 750,
                  fontSize: { xs: "1.75rem", sm: "2rem" },
                  letterSpacing: "-0.03em",
                  mb: 1.5,
                }}
              >
                {selected.role}
              </Typography>
              <SelectField
                label="Hall"
                value={selectedHall}
                onChange={(event) => {
                  window.location.hash = instructionHref(
                    selected.role,
                    event.target.value,
                  );
                }}
                sx={{ maxWidth: 320 }}
              >
                <option value="">Alla hallar</option>
                {halls.map((arena) => (
                  <option key={arena} value={arena}>
                    {arena}
                  </option>
                ))}
              </SelectField>
            </Box>
            <Box sx={{ color: "primary.main", pt: 1 }}>
              <RoleIcon size={40} strokeWidth={1.5} aria-hidden="true" />
            </Box>
          </Box>
          {!relevant.length && (
            <Typography>
              Inga instruktioner finns för den här uppgiften
              {selected.arena ? ` i ${selected.arena}` : ""} ännu. Kontakta lagets
              administratör eller lagledare.
            </Typography>
          )}
          {arenaGroups.map((group) => (
            <Box
              component="section"
              key={group.arena}
              sx={{
                "& + section": {
                  mt: 4,
                  pt: 3,
                  borderTop: "1px solid",
                  borderColor: "divider",
                },
              }}
            >
              <Typography
                component="h3"
                sx={{ fontWeight: 750, fontSize: "1.25rem", mb: 2 }}
              >
                {group.arena || "Gemensamt för alla hallar"}
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
                  gap: 2,
                }}
              >
                {Object.entries(INSTRUCTION_PHASES).map(([phase, label]) => {
                  const items = group.items.filter(
                    (item) => (item.phase || "general") === phase,
                  );
                  if (!items.length) return null;
                  return (
                    <Box
                      component="section"
                      key={phase}
                      sx={{
                        gridColumn: phase === "general" ? "1 / -1" : "auto",
                        p: { xs: 2, sm: 2.5 },
                        borderRadius: 2,
                        background: "linear-gradient(135deg, #f3f6fb, #eaf0f8)",
                      }}
                    >
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 2 }}
                      >
                        <Typography
                          component="h4"
                          sx={{ fontSize: "1.125rem", fontWeight: 750 }}
                        >
                          {label}
                        </Typography>
                      </Box>
                      {items.map((item, index) => {
                        const automaticTitle = `${instructionRole(item.role) || "Gemensamt"} · ${label}`;
                        const showTitle =
                          item.title !== automaticTitle &&
                          item.title !== `${selected.role} · ${label}` &&
                          !(
                            phase === "after" &&
                            [
                              instructionRole(item.role) || "Gemensamt",
                              selected.role,
                            ].some(
                              (role) => item.title === `${role} · Efter match och i paus`,
                            )
                          );
                        return (
                          <Box
                            key={item.id || index}
                            sx={{
                              "& + div": {
                                borderTop: "1px solid",
                                borderColor: "divider",
                                mt: 2,
                                pt: 2,
                              },
                            }}
                          >
                            {showTitle && (
                              <Typography component="h4" sx={{ fontWeight: 700, mb: 1 }}>
                                {item.title}
                              </Typography>
                            )}
                            {item.body && (
                              <InstructionText
                                text={item.body}
                                columns={phase === "general"}
                              />
                            )}
                            {instructionLinks(item)
                              .filter((link) => /^https?:\/\/[^\s]+$/.test(link.url))
                              .map((link, linkIndex) => (
                                <Box
                                  key={linkIndex}
                                  sx={{ mt: item.body || linkIndex ? 1.5 : 0 }}
                                >
                                  <Link
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    underline="always"
                                    sx={{ overflowWrap: "anywhere" }}
                                  >
                                    {link.label || "Öppna guide"} (ny flik)
                                  </Link>
                                </Box>
                              ))}
                          </Box>
                        );
                      })}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          ))}
        </>
      )}
    </Paper>
  );
}
