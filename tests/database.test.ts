import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const ADMIN = "10000000-0000-0000-0000-000000000001",
  PARENT = "10000000-0000-0000-0000-000000000002",
  PENDING = "10000000-0000-0000-0000-000000000003";
test("PostgreSQL migrations, RLS, eligibility, atomic import and idempotent sync", async () => {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.role() returns text language sql stable as $$select current_setting('request.jwt.claim.role',true)$$;grant usage on schema auth to authenticated,anon,service_role;grant execute on all functions in schema auth to authenticated,anon,service_role;`,
  );
  for (const f of ["001_initial.sql", "002_manual_import.sql"])
    await db.exec(await readFile(`supabase/migrations/${f}`, "utf8"));
  await db.exec(
    `insert into auth.users values('${ADMIN}','admin@example.invalid'),('${PARENT}','parent@example.invalid'),('${PENDING}','pending@example.invalid');update profiles set approved=true where id in ('${ADMIN}','${PARENT}');update profiles set role='ADMIN' where id='${ADMIN}';insert into families(name,ovr_ok,clock_ok,speaker_ok)values('Testfamilj',true,true,true),('Obehörig',false,false,false);grant all on all tables in schema public to service_role;grant select,insert,update,delete on all tables in schema public to anon,authenticated;`,
  );
  const login = async (role: string, id = "") => {
    await db.exec("reset role");
    await db.query(
      "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",
      [id, role],
    );
    await db.exec(`set role ${role}`);
  };
  const m = {
    id: "21495:123",
    competition: "21495",
    source_id: "123",
    starts_at: "2026-11-10T17:00:00Z",
    home_team: "Team Söderort(FOC/THH)",
    away_team: "Testmotståndare",
    arena: "Testarena",
    status: "scheduled",
  };
  const dm = { ...m, id: "22208:456", competition: "22208", source_id: "456" };
  const sync = async (rows: unknown[]) =>
    db.query("select sync_matches($1::jsonb)", [JSON.stringify(rows)]);
  await login("service_role");
  await sync([m, dm]);
  await login("anon");
  for (const table of [
    "families",
    "matches",
    "assignments",
    "instructions",
    "sync_logs",
    "match_changes",
    "profiles",
    "sync_requests",
    "assignment_types",
  ]) {
    assert.equal(
      (await db.query(`select * from ${table}`)).rows.length,
      0,
      `anonymous RLS: ${table}`,
    );
  }
  await assert.rejects(db.query("select import_excel($1::jsonb)", ["{}"]));
  await login("authenticated", PENDING);
  assert.equal((await db.query("select * from families")).rows.length, 0);
  assert.equal((await db.query("select * from matches")).rows.length, 0);
  assert.equal((await db.query("select * from profiles")).rows.length, 1);
  await db.query("update profiles set approved=true,role='ADMIN' where id=$1", [PENDING]);
  assert.equal(
    (
      await db.query<{ approved: boolean }>("select approved from profiles where id=$1", [
        PENDING,
      ])
    ).rows[0].approved,
    false,
  );
  await login("authenticated", PARENT);
  assert.equal((await db.query("select * from matches")).rows.length, 2);
  await assert.rejects(db.query("insert into families(name)values('Intrång')"));
  await assert.rejects(sync([m, dm]));
  await assert.rejects(
    db.query("select manual_matches($1::jsonb)", [JSON.stringify([m])]),
  );
  await login("authenticated", ADMIN);
  const family = (
    await db.query<{ id: string }>("select id from families where name='Testfamilj'")
  ).rows[0].id;
  const bad = (
    await db.query<{ id: string }>("select id from families where name='Obehörig'")
  ).rows[0].id;
  await db.query("insert into assignments values('21495:123','OVR',$1)", [family]);
  await assert.rejects(
    db.query("insert into assignments values('21495:123','Klockan',$1)", [bad]),
  );
  const payload = {
    families: [{ name: "Importerad", ovr_ok: true, clock_ok: true, speaker_ok: true }],
    rows: [{ match_id: m.id, assignments: [{ role: "OVR", name: "Importerad" }] }],
    instructions: [],
  };
  await assert.rejects(
    db.query("select import_excel($1::jsonb)", [JSON.stringify(payload)]),
  );
  assert.equal(
    (await db.query("select * from families where name='Importerad'")).rows.length,
    0,
    "failed import must roll back family creation",
  );
  payload.rows[0].assignments[0].role = "Matchvärd";
  await db.query("select import_excel($1::jsonb)", [JSON.stringify(payload)]);
  await db.query("select import_excel($1::jsonb)", [JSON.stringify(payload)]);
  assert.equal(
    (await db.query("select * from assignments")).rows.length,
    2,
    "repeat Excel import is idempotent",
  );
  await db.query("select manual_matches($1::jsonb)", [
    JSON.stringify([{ ...m, arena: "Manuellt verifierad arena" }]),
  ]);
  assert.equal(
    (await db.query("select * from assignments")).rows.length,
    2,
    "manual update retains assignments",
  );
  await db.query("select request_sync()");
  await assert.rejects(db.query("select request_sync()"), "dispatch rate limit");
  await login("service_role");
  await sync([{ ...m, starts_at: "2026-11-15T18:00:00Z", arena: "Ny arena" }, dm]);
  assert.equal((await db.query("select * from assignments")).rows.length, 2);
  const changes = (await db.query("select * from match_changes")).rows.length;
  await sync([{ ...m, starts_at: "2026-11-15T18:00:00Z", arena: "Ny arena" }, dm]);
  assert.equal(
    (await db.query("select * from match_changes")).rows.length,
    changes,
    "same sync produces no extra changes",
  );
  await sync([{ ...m, id: "21495:789", source_id: "789" }, dm]);
  assert.equal((await db.query("select * from assignments")).rows.length, 2);
  assert.equal(
    (
      await db.query<{ missing_from_source: boolean }>(
        "select missing_from_source from matches where id='21495:123'",
      )
    ).rows[0].missing_from_source,
    true,
  );
  await assert.rejects(sync([]));
  assert.equal((await db.query("select * from assignments")).rows.length, 2);
  await db.close();
});
