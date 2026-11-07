import type { Data } from "./types";

export function pendingReplacementRequests(
  data: Data,
  familyId: string | null | undefined,
  now = Date.now(),
) {
  if (!familyId) return [];
  return data.replacementInvitations
    .flatMap((invitation) => {
      if (invitation.family_id !== familyId || invitation.response !== "pending")
        return [];
      const search = data.replacementSearches.find((s) => s.id === invitation.search_id);
      if (
        !search ||
        search.status !== "searching" ||
        (search.deadline && Date.parse(search.deadline) <= now)
      )
        return [];
      const match = data.matches.find((m) => m.id === search.match_id);
      if (
        !match ||
        match.status === "finished" ||
        match.status === "cancelled" ||
        (match.starts_at && Date.parse(match.starts_at) <= now)
      )
        return [];
      return [
        { search, match, key: `${familyId}:${search.id}:${invitation.invited_at}` },
      ];
    })
    .sort((a, b) =>
      (a.search.deadline || "9999").localeCompare(b.search.deadline || "9999"),
    );
}
