import test from "node:test";
import assert from "node:assert/strict";
import { parseSchedule } from "../src/lib/swehockey";
import { distribution, eligible, TEAM } from "../src/lib/types";
import { demoData } from "../src/lib/demo";
const html = (
  date = "2026-10-25",
  time = "18:00",
  id = "15888004",
  home = TEAM,
  result = "",
) =>
  `<div id="groupStandingResultContent"><table class="tblContent"><tr><td>${date}</td><td class="mobile">${date}<br/>${time}</td><td><div class="dateLink"><span class="lnkTooltip" title="${id}">${time}</span></div></td><td>${home} &nbsp;-&nbsp; Exempel HC</td><td>${result}</td><td></td><td>Farsta Ishall</td></tr></table></div>`;
test("stable competition and match number, never date or result event id", () => {
  const a = parseSchedule(html(), "21495")[0];
  const b = parseSchedule(html("2026-11-01"), "21495")[0];
  assert.equal(a.id, b.id);
  assert.notEqual(a.starts_at, b.starts_at);
  assert.notEqual(a.id, parseSchedule(html(), "22208")[0].id);
});
test("Stockholm daylight saving and winter times", () => {
  assert.equal(
    parseSchedule(html("2026-09-20", "14:00"), "21495")[0].starts_at,
    "2026-09-20T12:00:00.000Z",
  );
  assert.equal(parseSchedule(html(), "21495")[0].starts_at, "2026-10-25T17:00:00.000Z");
});
test("placeholder 00:01 requires review and has no made-up start time", () => {
  const m = parseSchedule(html("2026-11-12", "00:01"), "21495")[0];
  assert.equal(m.starts_at, null);
  assert.equal(m.needs_review, true);
  assert.equal(m.status, "postponed");
});
test("unrecognized and empty pages fail closed", () => {
  assert.throws(() => parseSchedule("<html>maintenance</html>", "21495"));
  assert.throws(() => parseSchedule(html("2026-09-20", "14:00", "", "Other"), "21495"));
});
test("away matches not imported, finished status recognized", () => {
  assert.throws(() =>
    parseSchedule(html(undefined, undefined, undefined, "Other"), "21495"),
  );
  assert.equal(
    parseSchedule(html(undefined, undefined, undefined, TEAM, "3 - 2"), "21495")[0]
      .status,
    "finished",
  );
});
test("fairness counts every slot with no invented weighting", () => {
  const a = demoData.assignments;
  const d = distribution(demoData.families, a);
  assert.equal(
    d.reduce((s, f) => s + f.total, 0),
    a.length,
  );
  assert.ok(!eligible({ ...demoData.families[0], ovr_ok: false }, "OVR"));
});
import { buildPreview } from "../src/lib/excel";
test("Excel preview preserves slot counts, capability flags and uncertain mappings", () => {
  const schedule = [
    ["Matchdatum", "Arena", "Gästande lag"],
    [
      new Date("2026-11-10T18:00:00Z"),
      "Testarena",
      "Exempel HC",
      "Familj A",
      "Familj A",
      "Familj B",
    ],
    ["Väntar på ny tid", "Testarena", "Okänt lag"],
  ];
  const players = [
    ["Spelare"],
    ["Familj A", 0, 0, 0, 0, 0, 0, "Nej", "Ja ", "Ja"],
    ["Familj B", 0, 0, 0, 0, 0, 0, "Ja", "Nej", "Nej"],
  ];
  const guide = [[], [], [], ["Testarena", "Ta med dator."]];
  const m = parseSchedule(html("2026-11-10", "18:00"), "21495")[0];
  const p = buildPreview(schedule, players, guide, [m]);
  assert.equal(p.rows[0].match_id, m.id);
  assert.equal(p.rows[0].confirmed, false);
  assert.equal(p.rows[1].match_id, "");
  assert.equal(p.rows[0].assignments.length, 3);
  assert.equal(p.families[0].clock_ok, true);
  assert.equal(p.instructions[0].body, "Ta med dator.");
  assert.ok(p.warnings.some((w) => w.includes("flera uppgifter")));
});
