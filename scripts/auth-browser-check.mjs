import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";

// Run ONLY against a local Vite instance configured with the fake URL below.
const baseUrl = process.env.APP_URL || "http://127.0.0.1:5183";
const fakeApi = "https://auth.seket.invalid";
const teamId = "20000000-0000-0000-0000-000000000001";
const userId = "10000000-0000-0000-0000-000000000001";
const user = {
  id: userId,
  email: "parent@example.invalid",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const accessToken = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: userId, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.test-signature`;
const session = {
  access_token: accessToken,
  refresh_token: "test-refresh-token",
  expires_in: 3600,
  token_type: "bearer",
  user,
};
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const errors = [];
let loginSucceeds = false;
const requests = [];

async function newPage() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  // Never send requests to a real Supabase project, even if preview config is wrong.
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === new URL(baseUrl).origin) return route.continue();
    if (url.origin !== fakeApi) throw new Error("Unexpected external request blocked");
    const path = url.pathname;
    const body = request.postDataJSON();
    requests.push({ path, method: request.method(), body, url });
    const reply = (json, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(json),
      });
    if (path === "/auth/v1/signup") return reply({ user, session: null });
    if (path === "/auth/v1/recover") return reply({});
    if (path === "/auth/v1/token")
      return loginSucceeds
        ? reply(session)
        : reply({ code: "invalid_credentials", msg: "Invalid login credentials" }, 400);
    if (path === "/auth/v1/user" && request.method() === "PUT") return reply(user);
    if (path === "/auth/v1/user") return reply(user);
    if (path === "/auth/v1/logout") return route.fulfill({ status: 204 });
    if (path === "/rest/v1/rpc/request_team_access") {
      assert.equal(body.p_team_id, teamId);
      return reply(null);
    }
    if (path === "/rest/v1/teams")
      return reply({
        id: teamId,
        club_id: teamId,
        name: "Testlag",
        home_team: "Testlag",
        sync_enabled: false,
      });
    if (path === "/rest/v1/profiles")
      return reply({
        team_id: teamId,
        id: userId,
        email: user.email,
        role: "PARENT",
        approved: false,
        family_id: null,
      });
    throw new Error(`Unexpected fake API path: ${path}`);
  });
  return { page, context };
}

async function accessibility(page, label) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  assert.deepEqual(
    result.violations.map((item) => ({
      id: item.id,
      targets: item.nodes.map((node) => node.target),
    })),
    [],
    label,
  );
}

try {
  const { page, context } = await newPage();
  await page.goto(baseUrl);
  await expect(
    page.getByRole("heading", { name: "Logga in", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Huvudmeny" })).toHaveCount(0);
  await accessibility(page, "Login");
  await page.screenshot({ path: "/tmp/seket-login-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.getByText("Tillsammans för laget.", { exact: true })).toBeVisible();
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await page.screenshot({
    path: "/tmp/seket-login-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `Login layout: ${width}px`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("E-postadress").fill(user.email);
  await page.getByLabel(/^Lösenord/).fill("valid-test-password");
  await page.getByRole("button", { name: "Visa lösenord", exact: true }).click();
  await expect(page.getByLabel(/^Lösenord/)).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Logga in", exact: true }).click();
  await expect(
    page.getByText("Det gick inte att logga in.", { exact: false }),
  ).toBeVisible();

  await page.getByRole("tab", { name: "Skapa konto", exact: true }).click();
  await page.getByLabel(/^Ditt namn/).fill("Anna Andersson");
  await page.getByLabel(/^Barnets namn/).fill("Elsa Andersson");
  await page.getByLabel("E-postadress").fill(user.email);
  await page.getByLabel(/^Lösenord/).fill("valid-test-password");
  await page.getByLabel(/^Bekräfta lösenord/).fill("mismatched-password");
  await page.getByRole("button", { name: "Skapa konto", exact: true }).click();
  await expect(page.getByText("Lösenorden stämmer inte överens.")).toBeVisible();
  assert.equal(requests.filter((r) => r.path === "/auth/v1/signup").length, 0);
  await page.getByLabel(/^Bekräfta lösenord/).fill("valid-test-password");
  await accessibility(page, "Registration");
  await page.getByRole("button", { name: "Skapa konto", exact: true }).click();
  await expect(
    page.getByText("Kontrollera din e-post för att bekräfta kontot.", { exact: false }),
  ).toBeVisible();
  const signup = requests.find((r) => r.path === "/auth/v1/signup");
  assert.equal(signup.body.password, "valid-test-password");
  assert.equal(signup.body.data?.role, undefined);
  assert.equal(signup.body.data?.parent_name, "Anna Andersson");
  assert.equal(signup.body.data?.child_name, "Elsa Andersson");

  await page.getByRole("button", { name: "Tillbaka till inloggning" }).click();
  await page.getByRole("button", { name: "Glömt lösenord?" }).click();
  await page.getByLabel("E-postadress").fill(user.email);
  await accessibility(page, "Forgot password");
  await page.getByRole("button", { name: "Skicka återställningslänk" }).click();
  await expect(page.getByText("Om det finns ett konto", { exact: false })).toBeVisible();
  const recover = requests.find((r) => r.path === "/auth/v1/recover");
  assert.equal(
    new URL(recover.url.searchParams.get("redirect_to")).searchParams.get("auth"),
    "recovery",
  );

  await page.getByRole("button", { name: "Tillbaka till inloggning" }).click();
  loginSucceeds = true;
  await page.getByLabel("E-postadress").fill(user.email);
  await page.getByLabel(/^Lösenord/).fill("valid-test-password");
  await page.getByRole("button", { name: "Logga in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Inväntar godkännande" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Huvudmeny" })).toHaveCount(0);
  assert.equal(
    requests.filter((r) => /\/(matches|families|assignments)$/.test(r.path)).length,
    0,
  );
  await accessibility(page, "Pending approval");
  await context.close();

  const invalid = await newPage();
  await invalid.page.goto(`${baseUrl}/?auth=recovery`);
  await expect(
    invalid.page.getByRole("button", { name: "Begär ny återställningslänk" }),
  ).toBeVisible();
  await invalid.context.close();

  const recovery = await newPage();
  await recovery.page.goto(
    `${baseUrl}/?auth=recovery#access_token=${accessToken}&refresh_token=test-refresh-token&expires_in=3600&token_type=bearer&type=recovery`,
  );
  await expect(recovery.page.getByLabel(/^Nytt lösenord/)).toBeVisible();
  await expect(recovery.page.getByRole("navigation", { name: "Huvudmeny" })).toHaveCount(
    0,
  );
  await recovery.page.getByLabel(/^Nytt lösenord/).fill("new-valid-password");
  await recovery.page.getByLabel(/^Bekräfta lösenord/).fill("new-valid-password");
  await accessibility(recovery.page, "Password recovery");
  await recovery.page.getByRole("button", { name: "Spara nytt lösenord" }).click();
  await expect(
    recovery.page.getByRole("heading", { name: "Logga in", exact: true }),
  ).toBeVisible();
  await expect(
    recovery.page.getByText("Ditt lösenord är uppdaterat.", { exact: false }),
  ).toBeVisible();
  assert.equal(
    requests.find((r) => r.path === "/auth/v1/user" && r.method === "PUT").body.password,
    "new-valid-password",
  );
  assert.equal(new URL(recovery.page.url()).searchParams.has("auth"), false);
  assert.deepEqual(errors, []);
  console.log(
    "Authkontroll godkänd: lösenordsinloggning, registrering, återställning, väntande konto och tillgänglighet. Alla API-anrop simulerade lokalt.",
  );
} finally {
  await browser.close();
}
