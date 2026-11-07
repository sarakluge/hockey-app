import test from "node:test";
import assert from "node:assert/strict";
import { generateSchedule } from "../src/lib/scheduling";
import { demoData } from "../src/lib/demo";
import { eligible, type Data } from "../src/lib/types";
const now = Date.parse("2026-01-01T00:00:00Z");
function fixture(): Data {
  const d = structuredClone(demoData);
  d.assignments = [];
  d.unavailability = [];
  d.replacementSearches = [];
  d.matches = Array.from({ length: 12 }, (_, i) => ({
    ...d.matches[0],
    id: `m${i}`,
    starts_at: new Date(now + (i + 1) * 7 * 86400000).toISOString(),
    status: "scheduled",
    missing_from_source: false,
  }));
  d.families = Array.from({ length: 12 }, (_, i) => ({
    id: `f${i}`,
    name: `F${i}`,
    ovr_ok: i < 2,
    clock_ok: i >= 2 && i < 4,
    speaker_ok: i >= 4 && i < 6,
  }));
  return d;
}
test("season coverage respects skills, unavailability and one family per match", () => {
  const d = fixture();
  d.unavailability = [{ match_id: "m0", family_id: "f0" }];
  const rows = generateSchedule(d, false, 0, now);
  assert.equal(rows.length, 72);
  for (const a of rows) {
    assert(
      eligible(
        d.families.find((f) => f.id === a.family_id)!,
        a.role,
      ),
    );
    assert(
      !d.unavailability.some(
        (u) => u.family_id === a.family_id && u.match_id === a.match_id,
      ),
    );
    assert.equal(
      rows.filter((b) => b.match_id === a.match_id && b.family_id === a.family_id).length,
      1,
    );
  }
  const totals = d.families.map((f) => rows.filter((a) => a.family_id === f.id).length);
  assert(Math.max(...totals) - Math.min(...totals) <= 2);
});
test("retains existing assignments; redo preserves completed, locked and replacement slots", () => {
  const d = fixture();
  d.matches[0].status = "finished";
  d.assignments = [
    { match_id: "m0", role: "OVR", family_id: "f0" },
    { match_id: "m1", role: "Klockan", family_id: "f2", locked: true },
    { match_id: "m2", role: "Matchvärd", family_id: "f9" },
  ];
  for (const a of d.assignments)
    assert(
      generateSchedule(d, false, 0, now).some(
        (b) => JSON.stringify(a) === JSON.stringify(b),
      ),
    );
  for (const a of d.assignments.slice(0, 2))
    assert(
      generateSchedule(d, true, 0, now).some(
        (b) => JSON.stringify(a) === JSON.stringify(b),
      ),
    );
});
test("reports shortages without duplicating a scarce specialist", () => {
  const d = fixture();
  d.families = d.families
    .slice(0, 1)
    .map((f) => ({ ...f, clock_ok: true, speaker_ok: true }));
  assert.equal(generateSchedule(d, false, 0, now).length, 12);
});

test("manual multiple positions remain, and generator never adds another for that family", () => {
  const d = fixture();
  d.assignments = [
    { match_id: "m0", role: "Båsdörr 1", family_id: "f0", locked: true },
    { match_id: "m0", role: "Båsdörr 2", family_id: "f0", locked: true },
  ];
  for (const redo of [false, true]) {
    const rows = generateSchedule(d, redo, 0, now);
    assert.equal(
      rows.filter((a) => a.match_id === "m0" && a.family_id === "f0").length,
      2,
    );
    assert.equal(rows.filter((a) => a.match_id === "m0").length, 6);
  }
});

test("exempt families are never automatically assigned but manual shifts remain", () => {
  const d = fixture();
  d.families[0].staffing_exempt = true;
  assert(!generateSchedule(d, false, 0, now).some((a) => a.family_id === "f0"));
  d.assignments = [{ match_id: "m0", role: "OVR", family_id: "f0", locked: true }];
  for (const redo of [false, true]) {
    const rows = generateSchedule(d, redo, 0, now).filter((a) => a.family_id === "f0");
    assert.deepEqual(rows, d.assignments);
  }
});
