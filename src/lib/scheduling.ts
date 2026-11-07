import {
  eligible,
  ROLES,
  type Assignment,
  type Data,
  type Match,
  type Role,
} from "./types";

export const slotKey = (a: { match_id: string; role: Role }) => `${a.match_id}/${a.role}`;
export function schedulable(m: Match, now = Date.now()) {
  return (
    m.status === "scheduled" &&
    !!m.starts_at &&
    Date.parse(m.starts_at) > now &&
    !m.missing_from_source
  );
}
export function protectedAssignment(a: Assignment, data: Data, now = Date.now()) {
  return (
    !!a.locked ||
    !data.matches.some((m) => m.id === a.match_id && schedulable(m, now)) ||
    data.replacementSearches.some(
      (s) => s.match_id === a.match_id && s.role === a.role && s.status === "searching",
    )
  );
}

// Explore complete season proposals. Augmenting paths preserve maximum coverage even
// when several specialist positions compete for the same family.
export function generateSchedule(
  data: Data,
  redo = false,
  seed = 0,
  now = Date.now(),
): Assignment[] {
  const fixed = data.assignments.filter(
    (a) => !redo || protectedAssignment(a, data, now),
  );
  let best = fixed;
  let bestScore = Infinity;
  const random = (s: string, attempt: number) => {
    let h = seed + attempt * 7919;
    for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return (h >>> 0) / 4294967296;
  };
  for (let attempt = 0; attempt < 64; attempt++) {
    const result = [...fixed];
    const matches = data.matches
      .filter((m) => schedulable(m, now))
      .sort((a, b) =>
        attempt % 2
          ? random(a.id, attempt) - random(b.id, attempt)
          : a.starts_at!.localeCompare(b.starts_at!),
      );
    for (const match of matches) {
      const existing = result.filter((a) => a.match_id === match.id);
      const used = new Set(existing.map((a) => a.family_id));
      const roles = ROLES.filter((r) => !existing.some((a) => a.role === r));
      const candidates = (role: Role) =>
        data.families.filter(
          (f) =>
            !f.staffing_exempt &&
            !used.has(f.id) &&
            eligible(f, role) &&
            !data.unavailability.some(
              (u) => u.match_id === match.id && u.family_id === f.id,
            ),
        );
      const score = (id: string, role: Role) => {
        const history = result.filter((a) => a.family_id === id);
        const f = data.families.find((f) => f.id === id)!;
        const skill = +f.ovr_ok + +f.clock_ok + +f.speaker_ok;
        const repeats = history.filter(
          (a) =>
            (a.role.startsWith("Båsdörr") ? "Båsdörr" : a.role) ===
            (role.startsWith("Båsdörr") ? "Båsdörr" : role),
        ).length;
        const proximity = history.reduce((sum, a) => {
          const date = data.matches.find((m) => m.id === a.match_id)?.starts_at;
          return (
            sum +
            (date
              ? Math.max(
                  0,
                  1 -
                    Math.abs(Date.parse(date) - Date.parse(match.starts_at!)) /
                      (21 * 86400000),
                )
              : 0)
          );
        }, 0);
        return (
          history.length * 12 +
          repeats * 2 +
          proximity * 4 +
          (role.startsWith("Båsdörr") || role === "Matchvärd" ? skill * 5 : skill) +
          random(id + role, attempt) * 8
        );
      };
      roles.sort((a, b) => {
        const special = (r: Role) =>
          ["OVR", "Klockan", "Speaker/Musik"].includes(r) ? 0 : 1;
        return special(a) - special(b) || candidates(a).length - candidates(b).length;
      });
      const allocated = new Map<string, Role>();
      const place = (role: Role, visited: Set<string>): boolean => {
        for (const f of candidates(role).sort(
          (a, b) => score(a.id, role) - score(b.id, role),
        )) {
          if (visited.has(f.id)) continue;
          visited.add(f.id);
          const previous = allocated.get(f.id);
          if (!previous || place(previous, visited)) {
            allocated.set(f.id, role);
            return true;
          }
        }
        return false;
      };
      for (const role of roles) place(role, new Set());
      for (const [family_id, role] of allocated)
        result.push({ match_id: match.id, role, family_id });
    }
    const totals = data.families.map(
      (f) => result.filter((a) => a.family_id === f.id).length,
    );
    const quality =
      -result.length * 1e8 +
      totals.reduce((s, n) => s + n * n, 0) * 100 +
      result.reduce((s, a) => {
        const peers = result.filter((b) => b.family_id === a.family_id && b !== a);
        return s + peers.filter((b) => b.role === a.role).length;
      }, 0);
    if (quality < bestScore) {
      bestScore = quality;
      best = result;
    }
  }
  return best;
}
