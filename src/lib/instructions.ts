import type { Instruction } from "./types";

export function normalizeGuideUrl(value: string) {
  const trimmed = value.trim();
  const markdown = trimmed.match(/^\[[\s\S]*\]\((https?:\/\/[^\s]+)\)$/);
  return markdown ? markdown[1] : trimmed;
}

export function instructionSaveError(error: unknown) {
  const failure = error as { code?: string; message?: string } | null;
  if (failure?.code === "42703" || failure?.code === "PGRST204") {
    return "Databasen saknar fält för instruktioner och guider. Kör migrationen 011_instruction_guides.sql i Supabase och försök igen. Dina uppgifter finns kvar i formuläret.";
  }
  if (failure?.code === "23505") {
    return "En instruktion med samma rubrik, hall och uppgift finns redan. Välj en annan rubrik eller redigera den befintliga instruktionen.";
  }
  return `Instruktionen kunde inte sparas. ${failure?.message || "Kontrollera anslutningen och försök igen."}`;
}

export function instructionRole(role: string) {
  const value = role.trim();
  if (!value || value === "Alla" || value === "Alla uppgifter") return "";
  if (value === "Båsdörr 1" || value === "Båsdörr 2") return "Båsdörr";
  if (value === "Klocka") return "Klockan";
  return value;
}

export function instructionArena(arena: string) {
  const value = arena.trim().replace(/\s+/g, " ").toLocaleLowerCase("sv");
  return value === "alla hallar" ? "" : value;
}

export function instructionHref(role: string, arena = "") {
  const params = new URLSearchParams({ role: instructionRole(role) });
  if (arena) params.set("arena", arena);
  return `#instruktioner?${params}`;
}

export function instructionsForRole(
  instructions: Instruction[],
  selectedRole: string,
  selectedArena = "",
) {
  return instructions.filter((item) => {
    const role = instructionRole(item.role);
    const arena = instructionArena(item.arena);
    return (
      (!role || role === instructionRole(selectedRole)) &&
      (!selectedArena || !arena || arena === instructionArena(selectedArena))
    );
  });
}

export function uniqueInstructionArenas(arenas: string[]) {
  const names = new Map<string, string>();
  for (const arena of arenas) {
    const key = instructionArena(arena);
    if (key && !names.has(key)) names.set(key, arena.trim().replace(/\s+/g, " "));
  }
  return [...names.values()];
}

export function instructionLinks(instruction: Instruction) {
  if (Array.isArray(instruction.links)) return instruction.links;
  return instruction.guide_url
    ? [{ url: instruction.guide_url, label: instruction.guide_label || "" }]
    : [];
}
