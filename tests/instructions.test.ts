import { instructionLinks } from "../src/lib/instructions";
import { uniqueInstructionArenas } from "../src/lib/instructions";
import { instructionsForRole, instructionHref } from "../src/lib/instructions";
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeGuideUrl, instructionSaveError } from "../src/lib/instructions";

test("pasted guide links accept plain URLs and Markdown without changing URL characters", () => {
  const url = "https://example.org/Lathund_-_OVR_Lighter_och_Light_manual.pdf";
  assert.equal(normalizeGuideUrl(`  ${url} `), url);
  assert.equal(normalizeGuideUrl(`[OVR-guide](${url})`), url);
  assert.equal(normalizeGuideUrl(""), "");
  assert.equal(
    normalizeGuideUrl("[Guide](javascript:alert(1))"),
    "[Guide](javascript:alert(1))",
  );
});

test("instruction save errors distinguish missing migrations, duplicates and other errors", () => {
  for (const code of ["42703", "PGRST204"])
    assert.match(instructionSaveError({ code }), /011_instruction_guides.sql/);
  assert.match(instructionSaveError({ code: "23505" }), /samma rubrik/);
  assert.match(
    instructionSaveError({ message: "permission denied" }),
    /permission denied/,
  );
  assert.match(instructionSaveError(null), /Kontrollera anslutningen/);
});

test("shift instructions include shared routines and only the assigned role and arena", () => {
  const item = (title: string, role: string, arena: string) => ({
    title,
    role,
    arena,
    body: title,
  });
  const instructions = [
    item("Shared", "Alla", "Alla hallar"),
    item("OVR guide", "OVR", ""),
    item("Farsta", "OVR", "Farsta ishall"),
    item("Fontana", "OVR", "Fontana"),
    item("Clock", "Klockan", "Farsta ishall"),
    item("Doors", "Båsdörr", ""),
  ];
  assert.deepEqual(
    instructionsForRole(instructions, "OVR", "Farsta Ishall").map((item) => item.title),
    ["Shared", "OVR guide", "Farsta"],
  );
  assert.deepEqual(
    instructionsForRole(instructions, "Båsdörr 2", "Farsta ishall").map(
      (item) => item.title,
    ),
    ["Shared", "Doors"],
  );
  assert.equal(
    instructionsForRole(instructions, "Klocka", "Farsta ishall").at(-1)?.title,
    "Clock",
  );
  assert.equal(instructionsForRole(instructions, "OVR").length, 4);
  const params = new URLSearchParams(
    instructionHref("Speaker/Musik", "Hall & rink 1").split("?")[1],
  );
  assert.equal(params.get("role"), "Speaker/Musik");
  assert.equal(params.get("arena"), "Hall & rink 1");
});

test("hall options merge capitalization and whitespace differences", () => {
  assert.deepEqual(
    uniqueInstructionArenas([
      "Farsta Ishall",
      "Farsta ishall",
      " Farsta  ishall ",
      "Fontana",
      "Alla hallar",
      "",
    ]),
    ["Farsta Ishall", "Fontana"],
  );
});

test("instruction links preserve legacy links and allow explicit removal", () => {
  const item = {
    title: "Guide",
    arena: "",
    role: "OVR",
    body: "",
    guide_url: "https://example.org/old",
    guide_label: "Old",
  };
  assert.deepEqual(instructionLinks(item), [
    { url: "https://example.org/old", label: "Old" },
  ]);
  assert.deepEqual(instructionLinks({ ...item, links: [] }), []);
  const links = [
    { url: "https://example.org/one", label: "One" },
    { url: "https://example.org/two", label: "Two" },
  ];
  assert.deepEqual(instructionLinks({ ...item, links }), links);
});
