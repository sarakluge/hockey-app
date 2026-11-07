import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as cheerio from "cheerio/slim";
import { fromZonedTime } from "date-fns-tz";
import { parseSchedule } from "../src/lib/swehockey";

// Execute the exact Dashboard-deployable source with isolated server dependencies.
const source = readFileSync("supabase/functions/dispatch-sync/index.ts", "utf8").replace(
  /^import .*;\n/gm,
  "",
);
const javascript = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
const teamId = "21319175-e895-43e9-b1fe-3d422e7c0a9a";
const html = `<div id="groupStandingResultContent"><table class="tblContent"><tr>
<td>2026-09-20</td><td><div class="dateLink"><span class="lnkTooltip" title="123">14:00</span></div></td>
<td>Team Test - Other HC</td><td></td><td>Test Arena</td></tr></table></div>`;
function harness(
  options: { admin?: boolean; invalidSecond?: boolean; enabled?: boolean } = {},
) {
  let handler!: (request: Request) => Promise<Response>;
  const writes: { name: string; args: unknown }[] = [];
  let privilegedClients = 0;
  const userDb = {
    auth: { getUser: async () => ({ data: { user: { id: "user" } }, error: null }) },
    rpc: async (name: string) => ({
      data: name === "is_admin" ? options.admin !== false : null,
      error: null,
    }),
  };
  const serviceDb = {
    from(name: string) {
      const result =
        name === "teams"
          ? { home_team: "Team Test", sync_enabled: options.enabled !== false }
          : [{ competition: "21495" }, { competition: "22208" }];
      const query = {
        select: () => query,
        eq: () => query,
        single: async () => ({ data: result, error: null }),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: result, error: null }).then(resolve),
        insert: async (args: unknown) => {
          writes.push({ name, args });
          return { error: null };
        },
      };
      return query;
    },
    rpc: async (name: string, args: unknown) => {
      writes.push({ name, args });
      return { error: null };
    },
  };
  const createClient = (_url: string, key: string) => {
    if (key === "service") {
      privilegedClients++;
      return serviceDb;
    }
    return userDb;
  };
  const env: Record<string, string> = {
    SUPABASE_URL: "https://test.invalid",
    SUPABASE_ANON_KEY: "anon",
    SUPABASE_SERVICE_ROLE_KEY: "service",
  };
  new Function("Deno", "createClient", "cheerio", "fromZonedTime", "fetch", javascript)(
    {
      env: { get: (key: string) => env[key] },
      serve: (callback: typeof handler) => {
        handler = callback;
      },
    },
    createClient,
    cheerio,
    fromZonedTime,
    async (url: string) =>
      new Response(options.invalidSecond && url.endsWith("22208") ? "maintenance" : html),
  );
  const request = (method = "POST") =>
    new Request("https://test.invalid/dispatch-sync", {
      method,
      headers: { Origin: "http://127.0.0.1:5174", Authorization: "Bearer fake" },
      ...(method === "POST" ? { body: JSON.stringify({ team_id: teamId }) } : {}),
    });
  return { handler, request, writes, privilegedClients: () => privilegedClients };
}
test("direct sync authorizes before using server credentials", async () => {
  const h = harness({ admin: false });
  assert.equal((await h.handler(h.request())).status, 403);
  assert.equal(h.privilegedClients(), 0);
  assert.equal(h.writes.length, 0);
});
test("direct sync allows the development origin on port 5174", async () => {
  const h = harness();
  const response = await h.handler(h.request("OPTIONS"));
  assert.equal(
    response.headers.get("Access-Control-Allow-Origin"),
    "http://127.0.0.1:5174",
  );
  assert.equal(h.privilegedClients(), 0);
});
test("direct sync saves all competitions for the authorized team with shared parser behavior", async () => {
  const h = harness();
  const response = await h.handler(h.request());
  assert.equal(response.status, 200);
  assert.deepEqual(h.writes, [
    {
      name: "sync_matches",
      args: {
        p_team_id: teamId,
        p_matches: [
          ...parseSchedule(html, "21495", "Team Test"),
          ...parseSchedule(html, "22208", "Team Test"),
        ],
      },
    },
  ]);
});
test("a malformed competition prevents every match write and logs a team-scoped failure", async () => {
  const h = harness({ invalidSecond: true });
  assert.equal((await h.handler(h.request())).status, 502);
  assert.equal(
    h.writes.some((write) => write.name === "sync_matches"),
    false,
  );
  assert.equal(h.writes[0].name, "sync_logs");
});
test("disabled teams cannot be synced directly", async () => {
  const h = harness({ enabled: false });
  assert.equal((await h.handler(h.request())).status, 409);
  assert.equal(h.writes.length, 0);
});
