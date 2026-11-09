import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import RoleInstructions from "../src/components/RoleInstructions";

test("admin's after-match instructions retain their phase when intermediate phases are empty", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { hash: "#instruktioner?role=B%C3%A5sd%C3%B6rr" } },
  });
  try {
    const markup = renderToStaticMarkup(
      createElement(RoleInstructions, {
        arenas: [],
        instructions: [
          {
            role: "Båsdörr",
            arena: "",
            title: "Båsdörr · Innan match",
            phase: "before",
            body: "Ställ ut och montera målen.",
          },
          {
            role: "Båsdörr",
            arena: "",
            title: "Båsdörr · Efter match",
            phase: "after",
            body: "Ta ut målen från rinken.",
          },
        ],
      }),
    );
    assert.equal(markup.includes("Under match"), false);
    const sections = markup.split("<section");
    const after = sections.find((section) =>
      section.includes("Ta ut målen från rinken."),
    );
    assert.ok(after);
    assert.match(after, /Efter match/);
    assert.equal(after.includes("Ställ ut och montera målen."), false);
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("all halls get separate named sections and guides render as links", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { hash: "#instruktioner?role=OVR" } },
  });
  try {
    const markup = renderToStaticMarkup(
      createElement(RoleInstructions, {
        arenas: ["Farsta", "Fontana"],
        instructions: [
          {
            role: "OVR",
            arena: "",
            title: "Guide",
            body: "",
            guide_url: "https://example.org/guide",
            guide_label: "OVR-lathund",
          },
          {
            role: "OVR",
            arena: "Farsta",
            title: "Farsta före",
            phase: "before",
            body: "Hämta dator.",
          },
          {
            role: "OVR",
            arena: "Fontana",
            title: "Fontana efter",
            phase: "after",
            body: "Lämna skrivaren.",
          },
        ],
      }),
    );
    const farsta = markup.indexOf(">Farsta</h3>");
    const fontana = markup.indexOf(">Fontana</h3>");
    assert.ok(farsta >= 0 && fontana > farsta);
    assert.match(markup.slice(farsta, fontana), /Hämta dator/);
    assert.equal(markup.slice(farsta, fontana).includes("Lämna skrivaren"), false);
    assert.match(markup.slice(fontana), /Lämna skrivaren/);
    assert.match(
      markup,
      /<a[^>]*class="MuiTypography-root[^>]*MuiLink-root[^>]*href="https:\/\/example.org\/guide"/,
    );
    assert.match(markup, /Gemensamt för alla hallar/);
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
