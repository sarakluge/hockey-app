export const TEAM = "Team Söderort(FOC/THH)";
export const ROLES = [
  "Båsdörr 1",
  "Båsdörr 2",
  "OVR",
  "Klockan",
  "Speaker/Musik",
  "Matchvärd",
] as const;

export type Role = (typeof ROLES)[number];
export type Team = {
  id: string;
  club_id: string;
  name: string;
  home_team: string;
  sync_enabled: boolean;
};

export type Competition = {
  competition: string;
  kind: "serie" | "dm";
};

export type Match = {
  team_id?: string;
  kind?: "serie" | "dm";
  id: string;
  competition: string;
  source_id: string;
  starts_at: string | null;
  home_team: string;
  away_team: string;
  arena: string;
  status: string;
  changed_at?: string | null;
  missing_from_source?: boolean;
  needs_review?: boolean;
};

export type Family = {
  id: string;
  name: string;
  ovr_ok: boolean;
  clock_ok: boolean;
  speaker_ok: boolean;
};

export type Assignment = { match_id: string; role: Role; family_id: string };

export type Profile = {
  team_id: string;
  id: string;
  email: string;
  parent_name?: string | null;
  child_name?: string | null;
  role: "ADMIN" | "PARENT";
  approved: boolean;
  family_id: string | null;
};

export type Instruction = {
  id?: string;
  title: string;
  body: string;
  arena: string;
  role: string;
};

export type SyncLog = {
  id: string;
  created_at: string;
  success: boolean;
  message: string;
};

export type Data = {
  matches: Match[];
  families: Family[];
  assignments: Assignment[];
  instructions: Instruction[];
  logs: SyncLog[];
  profiles: Profile[];
};

export function eligible(f: Family, role: string) {
  return role === "OVR"
    ? f.ovr_ok
    : role === "Klockan"
      ? f.clock_ok
      : role === "Speaker/Musik"
        ? f.speaker_ok
        : true;
}

export function distribution(families: Family[], assignments: Assignment[]) {
  return families.map((f) => ({
    ...f,
    total: assignments.filter((a) => a.family_id === f.id).length,
    counts: ROLES.map(
      (r) => assignments.filter((a) => a.family_id === f.id && a.role === r).length,
    ),
  }));
}

export function formatDate(value: string, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    ...options,
  }).format(new Date(value));
}
