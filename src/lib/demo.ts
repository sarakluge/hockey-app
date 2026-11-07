import { ROLES, TEAM, type Data } from "./types";
// Helt fiktiva matcher och familjer. Inga uppgifter från originalarbetsboken.
const families = [
  "Familj Lind",
  "Familj Berg",
  "Familj Ek",
  "Familj Holm",
  "Familj Strand",
  "Familj Nyström",
  "Familj Lund",
  "Familj Dahl",
].map((name, i) => ({
  id: `demo-family-${i}`,
  name,
  ovr_ok: i % 2 === 0,
  clock_ok: i % 3 !== 0,
  speaker_ok: i % 2 === 1,
}));
export const demoData: Data = {
  families,
  matches: [
    {
      id: "demo:1",
      competition: "21495",
      source_id: "demo-1",
      starts_at: "2026-11-08T14:30:00Z",
      home_team: TEAM,
      away_team: "Exempellaget HC",
      arena: "Farsta Ishall",
      status: "scheduled",
    },
    {
      id: "demo:2",
      competition: "21495",
      source_id: "demo-2",
      starts_at: "2026-11-15T17:00:00Z",
      home_team: TEAM,
      away_team: "Demostadens IK",
      arena: "Fontanahallen",
      status: "scheduled",
      changed_at: "2026-11-05T09:00:00Z",
    },
    {
      id: "demo:3",
      competition: "22208",
      source_id: "demo-3",
      starts_at: "2026-11-22T16:30:00Z",
      home_team: TEAM,
      away_team: "Exempelstad IF",
      arena: "Farsta Ishall",
      status: "scheduled",
    },
    {
      id: "demo:4",
      competition: "22208",
      source_id: "demo-4",
      starts_at: null,
      home_team: TEAM,
      away_team: "Testköpings HC",
      arena: "Farsta Ishall",
      status: "postponed",
      needs_review: true,
    },
  ],
  assignments: ROLES.slice(0, 5)
    .map((role, i) => ({
      match_id: "demo:1",
      role,
      family_id: families[[1, 3, 0, 2, 5][i]].id,
    }))
    .concat(
      ROLES.map((role, i) => ({
        match_id: "demo:2",
        role,
        family_id: families[[0, 1, 2, 4, 3, 7][i]].id,
      })),
    ),
  instructions: [
    {
      title: "Inför matchen",
      arena: "Alla hallar",
      role: "Alla",
      body: "Detta är en demoinstruktion. Läs lagets godkända instruktioner innan ditt första pass. Kontrollera samlingstid med lagledaren.",
    },
    {
      title: "OVR · matchrapportering",
      arena: "Alla hallar",
      role: "OVR",
      body: "Ta med egen dator. Kontrollera uppkopplingen och inloggningen före match. Fullständiga hallinstruktioner kan importeras av administratören.",
    },
    {
      title: "Efter slutsignalen",
      arena: "Alla hallar",
      role: "Alla",
      body: "Samla ihop material och lämna sekretariatet i ordning. Stäm av med lagledaren innan du går.",
    },
  ],
  logs: [],
  profiles: [],
  unavailability: [],
};
