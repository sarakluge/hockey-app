import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const TEAM_A = "20000000-0000-0000-0000-000000000001";
const TEAM_B = "20000000-0000-0000-0000-000000000002";
const TEAM_C = "20000000-0000-0000-0000-000000000003";
const ADMIN_A = "10000000-0000-0000-0000-000000000001";
const ADMIN_B = "10000000-0000-0000-0000-000000000002";
const PARENT_A = "10000000-0000-0000-0000-000000000003";
const PENDING_A = "10000000-0000-0000-0000-000000000004";
const OUTSIDER = "10000000-0000-0000-0000-000000000005";
const FAMILY_A = "30000000-0000-0000-0000-000000000001";
const FAMILY_B = "30000000-0000-0000-0000-000000000002";

function match(home = "Testlag A", competition = "21495", source = "123") {
  return {
    id: `${competition}:${source}`,
    competition,
    source_id: source,
    starts_at: "2026-11-10T17:00:00Z",
    home_team: home,
    away_team: "Testmotståndare",
    arena: "Testarena",
    status: "scheduled",
  };
}

test("Empty-project migrations and team isolation without automatic grants", async (t) => {
  const db = new PGlite();
  try {
    // Deliberately NO blanket grants to API roles, before OR after migrations.
    // Also remove default function EXECUTE to emulate the strictest project setting.
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create function auth.role() returns text language sql stable as $$
        select current_setting('request.jwt.claim.role', true)
      $$;
      grant usage on schema auth to authenticated, anon, service_role;
      grant execute on all functions in schema auth to authenticated, anon, service_role;
      alter default privileges revoke execute on functions from public;
    `);
    for (const file of [
      "001_initial.sql",
      "002_manual_import.sql",
      "003_player_registration.sql",
      "004_profile_roles.sql",
      "005_family_unavailability.sql",
    ]) {
      await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    }
    await db.exec(`
      insert into public.clubs (id, name) values
        ('40000000-0000-0000-0000-000000000001', 'Testförening 1'),
        ('40000000-0000-0000-0000-000000000002', 'Testförening 2');
      insert into public.teams (id, club_id, name, home_team) values
        ('${TEAM_A}', '40000000-0000-0000-0000-000000000001', 'Lag A', 'Testlag A'),
        ('${TEAM_B}', '40000000-0000-0000-0000-000000000001', 'Lag B', 'Testlag B'),
        ('${TEAM_C}', '40000000-0000-0000-0000-000000000002', 'Lag C', 'Testlag C');
      insert into public.team_competitions (team_id, competition, kind)
        select id, '21495', 'serie' from public.teams;
      insert into public.team_competitions values ('${TEAM_A}', '22208', 'dm');
      insert into auth.users (id, email) values
        ('${ADMIN_A}', 'admin-a@example.invalid'),
        ('${ADMIN_B}', 'admin-b@example.invalid'),
        ('${PARENT_A}', 'parent-a@example.invalid'),
        ('${PENDING_A}', 'pending-a@example.invalid'),
        ('${OUTSIDER}', 'outsider@example.invalid');
      insert into public.families (id, team_id, name, ovr_ok, clock_ok, speaker_ok) values
        ('${FAMILY_A}', '${TEAM_A}', 'Testfamilj', true, true, true),
        ('${FAMILY_B}', '${TEAM_B}', 'Testfamilj', true, true, true);
      insert into public.profiles (team_id, id, email, approved, role, family_id) values
        ('${TEAM_A}', '${ADMIN_A}', 'admin-a@example.invalid', true, 'ADMIN', null),
        ('${TEAM_B}', '${ADMIN_A}', 'admin-a@example.invalid', true, 'PARENT', '${FAMILY_B}'),
        ('${TEAM_B}', '${ADMIN_B}', 'admin-b@example.invalid', true, 'ADMIN', null),
        ('${TEAM_A}', '${PARENT_A}', 'parent-a@example.invalid', true, 'PARENT', '${FAMILY_A}');
    `);

    async function login(role: string, userId = "") {
      await db.exec("reset role");
      await db.query(
        "select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', $2, false)",
        [userId, role],
      );
      await db.exec(`set role ${role}`);
    }
    const root = () => db.exec("reset role");
    const rpc = (name: string, teamId: string, payload: unknown) =>
      db.query(`select public.${name}($1::uuid, $2::jsonb)`, [
        teamId,
        JSON.stringify(payload),
      ]);
    const sync = (teamId: string, rows: unknown[]) => rpc("sync_matches", teamId, rows);
    const initialA = [match(), match("Testlag A", "22208", "456")];

    await t.test(
      "service has only explicit grants; provisioning and sync work",
      async () => {
        await login("service_role");
        assert.equal((await db.query("select * from public.teams")).rows.length, 3);
        await assert.rejects(db.query("select * from public.profiles"));
        await sync(TEAM_A, initialA);
        await sync(TEAM_B, [match("Testlag B"), match("Testlag B", "21495", "555")]);
        await sync(TEAM_C, [match("Testlag C")]);
        await db.query(
          "insert into public.sync_logs (team_id, success, message) values ($1, false, 'Testfel')",
          [TEAM_B],
        );
      },
    );

    await t.test(
      "anonymous and users without membership cannot read or write",
      async () => {
        await login("anon");
        for (const table of [
          "clubs",
          "teams",
          "team_competitions",
          "profiles",
          "families",
          "matches",
          "assignments",
          "instructions",
          "sync_logs",
          "match_changes",
          "sync_requests",
          "assignment_types",
        ]) {
          await assert.rejects(
            db.query(`select * from public.${table}`),
            `no anonymous grants: ${table}`,
          );
        }
        await assert.rejects(rpc("manual_matches", TEAM_A, initialA));
        await login("authenticated", OUTSIDER);
        assert.equal((await db.query("select * from public.families")).rows.length, 0);
        assert.equal((await db.query("select * from public.teams")).rows.length, 0);
        await assert.rejects(rpc("import_excel", TEAM_A, {}));
        await assert.rejects(
          db.query(
            "insert into public.profiles (team_id, id, email, role, approved) values ($1, $2, 'spoof', 'ADMIN', true)",
            [TEAM_A, OUTSIDER],
          ),
        );
      },
    );

    await db.exec("reset role");
    await db.query("update auth.users set raw_user_meta_data = $1::jsonb where id = $2", [
      JSON.stringify({
        parent_name: " Anna Andersson ",
        child_name: " Elsa Andersson ",
        role: "ADMIN",
        approved: true,
        family_id: FAMILY_A,
      }),
      PENDING_A,
    ]);
    await t.test(
      "access requests stay pending in one team; no self approval",
      async () => {
        await login("authenticated", PENDING_A);
        await db.query("select public.request_team_access($1)", [TEAM_A]);
        await db.query("select public.request_team_access($1)", [TEAM_A]);
        const profiles = await db.query<{ approved: boolean; role: string }>(
          "select * from public.profiles",
        );
        assert.equal(profiles.rows.length, 1);
        assert.equal(profiles.rows[0].approved, false);
        assert.equal(profiles.rows[0].role, "PARENT");
        const identity = await db.query<{
          parent_name: string;
          child_name: string;
          family_id: string | null;
        }>("select parent_name, child_name, family_id from public.profiles");
        assert.equal(identity.rows[0].parent_name, "Anna Andersson");
        assert.equal(identity.rows[0].child_name, "Elsa Andersson");
        assert.equal(identity.rows[0].family_id, null);
        await assert.rejects(
          db.query("update public.profiles set parent_name = 'Ändrat'"),
        );
        assert.equal((await db.query("select * from public.teams")).rows.length, 1);
        for (const table of [
          "families",
          "matches",
          "instructions",
          "sync_logs",
          "match_changes",
          "team_competitions",
        ]) {
          assert.equal((await db.query(`select * from public.${table}`)).rows.length, 0);
        }
        await db.query(
          "update public.profiles set approved = true, role = 'ADMIN' where id = $1",
          [PENDING_A],
        );
        assert.equal(
          (await db.query<{ approved: boolean }>("select approved from public.profiles"))
            .rows[0].approved,
          false,
        );
      },
    );

    await t.test(
      "family unavailability is shared with admins and scoped to the linked family",
      async () => {
        await login("authenticated", PARENT_A);
        const insert = () =>
          db.query(
            "insert into public.family_unavailability values ($1, $2, $3) on conflict (team_id, match_id, family_id) do update set family_id = excluded.family_id",
            [TEAM_A, "21495:123", FAMILY_A],
          );
        await insert();
        await insert();
        assert.equal(
          (await db.query("select * from public.family_unavailability")).rows.length,
          1,
        );
        await assert.rejects(
          db.query("insert into public.family_unavailability values ($1, $2, $3)", [
            TEAM_B,
            "21495:123",
            FAMILY_B,
          ]),
        );
        await login("authenticated", ADMIN_A);
        assert.equal(
          (await db.query("select * from public.family_unavailability")).rows.length,
          1,
        );
        await login("authenticated", ADMIN_B);
        assert.equal(
          (await db.query("select * from public.family_unavailability")).rows.length,
          0,
        );
        await login("authenticated", PENDING_A);
        assert.equal(
          (await db.query("select * from public.family_unavailability")).rows.length,
          0,
        );
        await assert.rejects(insert());
        await login("anon");
        await assert.rejects(db.query("select * from public.family_unavailability"));
        await login("authenticated", PARENT_A);
        await db.query("delete from public.family_unavailability where team_id = $1", [
          TEAM_A,
        ]);
        assert.equal(
          (await db.query("select * from public.family_unavailability")).rows.length,
          0,
        );
      },
    );

    await t.test(
      "family duties require a valid choice and stay scoped to the linked family",
      async () => {
        await login("anon");
        await assert.rejects(
          db.query("select public.save_my_duty_roles($1, array['OVR'])", [TEAM_A]),
        );
        await login("authenticated", PARENT_A);
        for (const roles of [null, [], ["ADMIN"], [null]]) {
          await assert.rejects(
            db.query("select public.save_my_duty_roles($1, $2::text[])", [TEAM_A, roles]),
          );
        }
        await assert.rejects(
          db.query("select public.save_my_duty_roles($1, array['OVR'])", [TEAM_B]),
        );
        await db.query("select public.save_my_duty_roles($1, array['OVR'])", [TEAM_A]);
        const family = await db.query<{ ovr_ok: boolean; clock_ok: boolean }>(
          "select * from public.families where id = $1",
          [FAMILY_A],
        );
        assert.equal(family.rows[0].ovr_ok, true);
        assert.equal(family.rows[0].clock_ok, false);
        await db.query("update public.families set clock_ok = true");
        assert.equal(
          (
            await db.query<{ clock_ok: boolean }>(
              "select clock_ok from public.families where id = $1",
              [FAMILY_A],
            )
          ).rows[0].clock_ok,
          false,
        );
        await login("authenticated", PENDING_A);
        await assert.rejects(
          db.query("select public.save_my_duty_roles($1, array['OVR'])", [TEAM_A]),
        );
        await login("authenticated", PARENT_A);
        await db.query(
          "select public.save_my_duty_roles($1, array['OVR', 'Klockan', 'Speaker/Musik'])",
          [TEAM_A],
        );
        await root();
        await db.query(
          "update auth.users set email = 'new@example.invalid' where id = $1",
          [PARENT_A],
        );
        const profile = await db.query<{ email: string }>(
          "select email from public.profiles where id = $1",
          [PARENT_A],
        );
        assert.equal(profile.rows[0].email, "new@example.invalid");
      },
    );

    await t.test(
      "parents can read only their team, even within the same club",
      async () => {
        await login("authenticated", PARENT_A);
        for (const table of [
          "families",
          "matches",
          "team_competitions",
          "sync_logs",
          "match_changes",
        ]) {
          const { rows } = await db.query<{ team_id: string }>(
            `select * from public.${table}`,
          );
          assert.ok(rows.length > 0, `seeded ${table}`);
          assert.ok(
            rows.every((row) => row.team_id === TEAM_A),
            table,
          );
        }
        assert.equal((await db.query("select * from public.teams")).rows.length, 1);
        assert.equal((await db.query("select * from public.clubs")).rows.length, 1);
        assert.equal(
          (await db.query("select * from public.assignment_types")).rows.length,
          6,
        );
        await assert.rejects(
          db.query("insert into public.families (team_id, name) values ($1, 'Intrång')", [
            TEAM_A,
          ]),
        );
        await assert.rejects(sync(TEAM_A, initialA));
        await assert.rejects(rpc("manual_matches", TEAM_A, initialA));
        await assert.rejects(db.query("select public.request_sync($1)", [TEAM_A]));
      },
    );

    await t.test(
      "roles and approvals are team scoped, not inherited from club or another team",
      async () => {
        await login("authenticated", ADMIN_A);
        assert.equal(
          (await db.query<{ ok: boolean }>("select public.is_admin($1) as ok", [TEAM_A]))
            .rows[0].ok,
          true,
        );
        assert.equal(
          (await db.query<{ ok: boolean }>("select public.is_admin($1) as ok", [TEAM_B]))
            .rows[0].ok,
          false,
        );
        await assert.rejects(rpc("manual_matches", TEAM_B, [match("Testlag B")]));
        await assert.rejects(rpc("import_excel", TEAM_B, {}));
        await assert.rejects(rpc("manual_matches", TEAM_C, [match("Testlag C")]));
        await assert.rejects(db.query("select public.request_sync($1)", [TEAM_B]));
        await db.query(
          "update public.profiles set role = 'ADMIN' where team_id = $1 and id = $2",
          [TEAM_B, ADMIN_A],
        );
        assert.equal(
          (
            await db.query<{ role: string }>(
              "select role from public.profiles where team_id = $1 and id = $2",
              [TEAM_B, ADMIN_A],
            )
          ).rows[0].role,
          "PARENT",
        );
        await assert.rejects(
          db.query("update public.profiles set id = $1 where team_id = $2 and id = $3", [
            OUTSIDER,
            TEAM_A,
            PENDING_A,
          ]),
        );
        await db.query(
          "update public.profiles set approved = true, family_id = $1 where team_id = $2 and id = $3",
          [FAMILY_A, TEAM_A, PENDING_A],
        );
        await assert.rejects(
          db.query(
            "update public.profiles set family_id = $1 where team_id = $2 and id = $3",
            [FAMILY_B, TEAM_A, PENDING_A],
          ),
        );
      },
    );

    await t.test(
      "composite foreign keys block cross-team staffing and membership families",
      async () => {
        await login("authenticated", ADMIN_A);
        await db.query(
          "insert into public.assignments (team_id, match_id, role, family_id) values ($1, '21495:123', 'OVR', $2)",
          [TEAM_A, FAMILY_A],
        );
        await assert.rejects(
          db.query(
            "insert into public.assignments (team_id, match_id, role, family_id) values ($1, '21495:123', 'Klockan', $2)",
            [TEAM_A, FAMILY_B],
          ),
        );
        await assert.rejects(
          db.query(
            "insert into public.assignments (team_id, match_id, role, family_id) values ($1, '21495:123', 'Klockan', $2)",
            [TEAM_B, FAMILY_B],
          ),
        );
        await db.query(
          "insert into public.families (team_id, name) values ($1, 'Utan behörighet')",
          [TEAM_A],
        );
        await assert.rejects(
          db.query(
            "insert into public.assignments (team_id, match_id, role, family_id) select team_id, '21495:123', 'Klockan', id from public.families where team_id = $1 and name = 'Utan behörighet'",
            [TEAM_A],
          ),
        );
        await assert.rejects(
          db.query("update public.families set team_id = $1 where id = $2", [
            TEAM_B,
            FAMILY_A,
          ]),
        );
        await root();
        await assert.rejects(
          db.query(
            "insert into public.assignments (team_id, match_id, role, family_id) values ($1, '21495:123', 'Matchvärd', $2)",
            [TEAM_A, FAMILY_B],
          ),
          "FK also protects privileged callers",
        );
      },
    );

    await t.test(
      "Excel import remains atomic and idempotent, including private instructions",
      async () => {
        await login("authenticated", ADMIN_A);
        const payload = {
          families: [
            { name: "Importerad", ovr_ok: true, clock_ok: true, speaker_ok: true },
          ],
          rows: [
            { match_id: "21495:123", assignments: [{ role: "OVR", name: "Importerad" }] },
          ],
          instructions: [
            {
              title: "Testinstruktion",
              body: "Privat testtext",
              arena: "Testarena",
              role: "OVR",
            },
          ],
        };
        await assert.rejects(rpc("import_excel", TEAM_A, payload));
        assert.equal(
          (await db.query("select * from public.families where name = 'Importerad'")).rows
            .length,
          0,
        );
        payload.rows[0].assignments[0].role = "Matchvärd";
        await rpc("import_excel", TEAM_A, payload);
        await rpc("import_excel", TEAM_A, payload);
        assert.equal(
          (
            await db.query("select * from public.assignments where team_id = $1", [
              TEAM_A,
            ])
          ).rows.length,
          2,
        );
        assert.equal(
          (await db.query("select * from public.instructions")).rows.length,
          1,
        );
        await login("authenticated", ADMIN_B);
        assert.equal(
          (await db.query("select * from public.instructions")).rows.length,
          0,
        );
        assert.equal((await db.query("select * from public.assignments")).rows.length, 0);
      },
    );

    await t.test(
      "manual updates and sync preserve staffing; same source keys are separate per team",
      async () => {
        await login("authenticated", ADMIN_A);
        await rpc("manual_matches", TEAM_A, [{ ...match(), arena: "Manuellt ändrad" }]);
        await assert.rejects(rpc("manual_matches", TEAM_A, [match("Testlag B")]));
        await assert.rejects(
          rpc("manual_matches", TEAM_A, [{ ...match(), team_id: TEAM_B }]),
        );
        await db.query("select public.request_sync($1)", [TEAM_A]);
        await assert.rejects(db.query("select public.request_sync($1)", [TEAM_A]));
        await login("authenticated", ADMIN_B);
        await db.query("select public.request_sync($1)", [TEAM_B]);
        await login("service_role");
        const moved = [
          { ...match(), starts_at: "2026-11-15T18:00:00Z", arena: "Ny arena" },
          initialA[1],
        ];
        await sync(TEAM_A, moved);
        await root();
        const count = (
          await db.query("select * from public.match_changes where team_id = $1", [
            TEAM_A,
          ])
        ).rows.length;
        await login("service_role");
        await sync(TEAM_A, moved);
        await root();
        assert.equal(
          (
            await db.query("select * from public.match_changes where team_id = $1", [
              TEAM_A,
            ])
          ).rows.length,
          count,
        );
        assert.equal(
          (
            await db.query("select * from public.assignments where team_id = $1", [
              TEAM_A,
            ])
          ).rows.length,
          2,
        );
        assert.equal(
          (
            await db.query<{ arena: string }>(
              "select arena from public.matches where team_id = $1 and id = '21495:123'",
              [TEAM_B],
            )
          ).rows[0].arena,
          "Testarena",
        );
        await login("service_role");
        await sync(TEAM_A, [match("Testlag A", "21495", "789"), initialA[1]]);
        await assert.rejects(sync(TEAM_A, []));
        await assert.rejects(sync(TEAM_A, [match()]));
        await assert.rejects(
          sync(TEAM_A, [match(), initialA[1], match("Testlag A", "999", "9")]),
        );
        await root();
        assert.equal(
          (
            await db.query<{ missing_from_source: boolean }>(
              "select missing_from_source from public.matches where team_id = $1 and id = '21495:123'",
              [TEAM_A],
            )
          ).rows[0].missing_from_source,
          true,
          "failed multi-row sync rolled back earlier updates",
        );
        assert.equal(
          (
            await db.query<{ missing_from_source: boolean }>(
              "select missing_from_source from public.matches where team_id = $1 and id = '21495:123'",
              [TEAM_B],
            )
          ).rows[0].missing_from_source,
          false,
        );
        assert.equal(
          (
            await db.query("select * from public.assignments where team_id = $1", [
              TEAM_A,
            ])
          ).rows.length,
          2,
        );
      },
    );

    await t.test(
      "revocation applies to existing sessions; deleting a family keeps the team membership",
      async () => {
        await root();
        await db.query(
          "update public.profiles set approved = false where team_id = $1 and id = $2",
          [TEAM_A, PARENT_A],
        );
        await login("authenticated", PARENT_A);
        assert.equal((await db.query("select * from public.matches")).rows.length, 0);
        await assert.rejects(rpc("manual_matches", TEAM_A, initialA));
        await root();
        await db.query(
          "update public.profiles set approved = true where team_id = $1 and id = $2",
          [TEAM_A, PARENT_A],
        );
        await db.query("delete from public.families where id = $1", [FAMILY_A]);
        const membership = await db.query<{ team_id: string; family_id: string | null }>(
          "select team_id, family_id from public.profiles where team_id = $1 and id = $2",
          [TEAM_A, PARENT_A],
        );
        assert.equal(membership.rows[0].team_id, TEAM_A);
        assert.equal(membership.rows[0].family_id, null);
        assert.equal(
          (await db.query("select * from public.families where id = $1", [FAMILY_B])).rows
            .length,
          1,
        );
      },
    );

    await t.test(
      "RLS holds even if API table privileges are accidentally broadened",
      async () => {
        await root();
        await db.exec(
          "grant select, insert, update, delete on all tables in schema public to anon, authenticated",
        );
        await login("anon");
        for (const table of [
          "clubs",
          "teams",
          "profiles",
          "matches",
          "families",
          "assignments",
          "instructions",
          "sync_logs",
          "match_changes",
          "sync_requests",
          "team_competitions",
          "assignment_types",
        ]) {
          assert.equal(
            (await db.query(`select * from public.${table}`)).rows.length,
            0,
            table,
          );
        }
        await login("authenticated", ADMIN_B);
        for (const table of [
          "families",
          "matches",
          "assignments",
          "instructions",
          "profiles",
          "sync_logs",
          "match_changes",
          "sync_requests",
          "team_competitions",
        ]) {
          const { rows } = await db.query<{ team_id: string }>(
            `select * from public.${table}`,
          );
          assert.ok(
            rows.every((row) => row.team_id === TEAM_B),
            table,
          );
        }
        await assert.rejects(
          db.query("insert into public.families (team_id, name) values ($1, 'Intrång')", [
            TEAM_A,
          ]),
        );
      },
    );
  } finally {
    await db.close();
  }
});
