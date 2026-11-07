import AxeBuilder from "@axe-core/playwright";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";

const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const baseUrl = process.env.APP_URL || "http://127.0.0.1:5173";
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

try {
  await page.goto(baseUrl);
  await expect(
    page.getByRole("heading", { name: "Logga in", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Huvudmeny" })).toHaveCount(0);
  await page.getByRole("button", { name: "Utforska demoläget" }).click();
  await expect(
    page.getByRole("heading", { name: "Hemmamatcher", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(4);
  await expect(
    page.getByRole("navigation", { name: "Huvudmeny" }).getByRole("link"),
  ).toHaveCount(3);
  await expect(page.getByRole("article").first()).toContainText("Båsdörr 1");
  await page.getByRole("combobox", { name: "Tävling" }).selectOption("22208");
  await expect(page.getByRole("article")).toHaveCount(2);
  await page.getByRole("combobox", { name: "Tävling" }).selectOption("all");
  await page.screenshot({ path: "/tmp/hemmaplan-mobile.png", fullPage: true });

  await page.getByRole("link", { name: "Administration", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Matchvärd", exact: true })
    .selectOption("demo-family-7");
  await expect(
    page.getByRole("combobox", { name: "Matchvärd", exact: true }),
  ).toHaveValue("demo-family-7");

  await page.getByRole("link", { name: "Mina pass", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(
    page.getByRole("link", { name: "Min uppgift:", exact: false }).first(),
  ).toContainText("Min uppgift:");
  await page.screenshot({ path: "/tmp/hemmaplan-shifts.png", fullPage: true });

  await page.getByRole("link", { name: "Info", exact: true }).click();
  await expect(page.locator(".MuiAccordion-root")).toHaveCount(5);
  await expect(
    page.getByText("Detta är en demoinstruktion.", { exact: false }),
  ).toBeVisible();
  await page.getByText("Kontakt & övrigt", { exact: true }).click();
  await page.getByRole("button", { name: "Integritet & personuppgifter" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const dialogAccessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  assert.deepEqual(
    dialogAccessibility.violations.map((item) => ({
      id: item.id,
      nodes: item.nodes.map((node) => node.target),
    })),
    [],
    "Dialog accessibility",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Integritet & personuppgifter" }),
  ).toBeFocused();
  await page.screenshot({ path: "/tmp/hemmaplan-info.png", fullPage: true });

  for (const route of ["matcher", "mina", "instruktioner", "admin"]) {
    await page.evaluate((route) => {
      window.location.hash = route;
    }, route);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      accessibility.violations.map((item) => ({
        id: item.id,
        nodes: item.nodes.map((node) => node.target),
      })),
      [],
      `Accessibility: ${route}`,
    );
  }
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["matcher", "mina", "instruktioner", "admin"]) {
      await page.evaluate((route) => {
        window.location.hash = route;
      }, route);
      await expect(page.locator("h1")).toBeVisible();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `No horizontal overflow: ${width}px / ${route}`,
      );
    }
  }
  await page.evaluate(() => {
    window.location.hash = "matcher";
  });
  await page.screenshot({ path: "/tmp/hemmaplan-desktop.png", fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    "Browserkontroll godkänd: tre flikar, matchkort, filter, bemanning, pass, info, integritet och fyra skärmbredder.",
  );
} finally {
  await browser.close();
}
