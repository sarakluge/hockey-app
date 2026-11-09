import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import InstructionText from "../src/components/InstructionText";

test("instructions render bold section titles, bullet lists and numbered steps", () => {
  const markup = renderToStaticMarkup(
    createElement(InstructionText, {
      text: "**Utvisningsbås**\n- Öppna dörren.\n- Håll koll på **tiden**.\n**Skott på mål**\n1. Räkna skott.\n2. Stäm av.",
      columns: true,
    }),
  );
  assert.match(markup, /<h4[^>]*>Utvisningsbås<\/h4>/);
  assert.match(markup, /<ul[^>]*>/);
  assert.match(markup, /<li>Håll koll på <strong>tiden<\/strong>\.<\/li>/);
  assert.match(markup, /<ol[^>]*start="1"/);
  assert.equal(markup.includes("**"), false);
});

test("instructions treat pasted HTML as text", () => {
  const markup = renderToStaticMarkup(
    createElement(InstructionText, {
      text: '<script>alert("test")</script>\n<img src=x onerror=alert(1)>',
    }),
  );
  assert.equal(markup.includes("<script>"), false);
  assert.equal(markup.includes("<img"), false);
  assert.match(markup, /&lt;script&gt;/);
});
