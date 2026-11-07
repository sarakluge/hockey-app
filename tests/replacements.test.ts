import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const team = "20000000-0000-0000-0000-000000000001";
const otherTeam = "20000000-0000-0000-0000-000000000002";
const uuid = (n: number) => `10000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

test("replacement searches enforce ownership, eligibility, priority and atomic handover", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role',true) $$;
      grant usage on schema auth to authenticated,anon,service_role;
      grant execute on all functions in schema auth to authenticated,anon,service_role;
      alter default privileges revoke execute on functions from public;
    `);
    for (const file of [
      "001_initial.sql",
      "002_manual_import.sql",
      "003_player_registration.sql",
      "004_profile_roles.sql",
      "005_family_unavailability.sql",
      "006_shift_replacements.sql",
      "008_scheduling.sql",
      "009_manual_multiple_positions.sql",
      "010_staffing_exempt.sql",
    ]) {
      await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    }
    await db.exec(`
      insert into public.clubs(id,name) values('${uuid(90)}','Club');
      insert into public.teams(id,club_id,name,home_team) values ('${team}','${uuid(90)}','Team','Home'),('${otherTeam}','${uuid(90)}','Other','Other');
      insert into public.team_competitions values('${team}','1','serie');
      insert into public.matches(team_id,id,competition,source_id,starts_at,home_team,away_team,arena,status)
        select '${team}','1:'||n,'1',n::text,now()+interval '10 days','Home','Away','Arena','scheduled' from generate_series(1,12) n;
      insert into auth.users(id,email) select ('10000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'user'||n||'@example.invalid' from generate_series(1,8) n;
      insert into public.families(id,team_id,name,ovr_ok,clock_ok,speaker_ok)
        select id,'${team}',email,true,true,true from auth.users;
      insert into public.profiles(team_id,id,email,role,approved,family_id)
        select '${team}',id,email,case when id='${uuid(8)}' then 'ADMIN' else 'PARENT' end,true,id from auth.users;
      update public.families set ovr_ok=false where id='${uuid(5)}';
      insert into public.assignments values ('${team}','1:1','OVR','${uuid(1)}'),('${team}','1:1','Klockan','${uuid(6)}');
      insert into public.family_unavailability values ('${team}','1:1','${uuid(7)}');
      -- Totals: owner=1, low=0,0, normal=2, unqualified=0, busy=1, unavailable=0, high=6. Average=1.25.
      insert into public.assignments select '${team}','1:'||n,'OVR','${uuid(8)}' from generate_series(2,7) n;
      insert into public.assignments select '${team}','1:'||n,'Klockan','${uuid(4)}' from generate_series(2,3) n;
    `);
    async function login(n: number, role = "authenticated") {
      await db.exec("reset role");
      await db.query(
        "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",
        [uuid(n), role],
      );
      await db.exec(`set role ${role}`);
    }
    async function start(match = "1:1", role = "OVR") {
      return (
        await db.query<{ id: string }>(
          "select public.start_replacement($1,$2,$3) as id",
          [team, match, role],
        )
      ).rows[0].id;
    }
    const act = (id: string, action: string, family: string | null = null) =>
      db.query("select public.act_on_replacement($1,$2,$3)", [id, action, family]);
    const scalar = async <T>(sql: string, params: unknown[] = []) =>
      (await db.query<{ v: T }>(sql, params)).rows[0].v;
    let id = "";
    await t.test(
      "only the owning approved family or team admin can start; one live search",
      async () => {
        await login(2);
        await assert.rejects(start());
        await assert.rejects(
          db.query("select public.start_replacement($1,'1:1','OVR')", [otherTeam]),
        );
        await login(1);
        id = await start();
        await assert.rejects(start());
        assert.equal(
          await scalar(
            "select family_id as v from public.assignments where match_id='1:1' and role='OVR'",
          ),
          uuid(1),
        );
        assert.equal(
          await scalar(
            "select current_group as v from public.replacement_searches where id=$1",
            [id],
          ),
          1,
        );
      },
    );
    await t.test(
      "filters skills, busy and unavailable families; snapshot groups are visible only to admin",
      async () => {
        await login(8);
        const rows = (
          await db.query<{ family_id: string; priority_group: number; response: string }>(
            "select * from public.replacement_invitations where search_id=$1 order by family_id",
            [id],
          )
        ).rows;
        assert.deepEqual(
          rows.map((r) => r.family_id),
          [uuid(2), uuid(3), uuid(4), uuid(8)],
        );
        assert.deepEqual(
          rows.map((r) => r.priority_group),
          [1, 1, 2, 3],
        );
        assert.deepEqual(
          rows.map((r) => r.response),
          ["pending", "pending", "queued", "queued"],
        );
        await login(4);
        assert.equal(
          (await db.query("select * from public.replacement_invitations")).rows.length,
          0,
        );
        await assert.rejects(act(id, "accept"));
        await assert.rejects(act(id, "next"));
        await assert.rejects(act(id, "assign", uuid(4)));
        await assert.rejects(act(id, "cancel"));
        await assert.rejects(
          db.query("update public.replacement_searches set status='found'"),
        );
      },
    );
    await t.test(
      "all declines advance immediately, timeout reaches next group without client",
      async () => {
        await login(2);
        await act(id, "decline");
        assert.equal(
          await scalar(
            "select current_group as v from public.replacement_searches where id=$1",
            [id],
          ),
          1,
        );
        await login(3);
        await act(id, "decline");
        assert.equal(
          await scalar(
            "select current_group as v from public.replacement_searches where id=$1",
            [id],
          ),
          2,
        );
        await db.exec("reset role");
        await db.query(
          "update public.replacement_searches set deadline=now()-interval '1 second' where id=$1",
          [id],
        );
        await db.exec("select private.process_replacements()");
        assert.equal(
          await scalar(
            "select current_group as v from public.replacement_searches where id=$1",
            [id],
          ),
          3,
        );
        await login(8);
        await act(id, "accept");
        assert.equal(
          await scalar(
            "select status as v from public.replacement_searches where id=$1",
            [id],
          ),
          "found",
        );
        await assert.rejects(act(id, "accept"));
      },
    );
    await t.test(
      "handover changes statistics, closes invitations, and notifies both families",
      async () => {
        assert.equal(
          await scalar(
            "select family_id as v from public.assignments where match_id='1:1' and role='OVR'",
          ),
          uuid(8),
        );
        assert.equal(
          await scalar(
            "select count(*)::int as v from public.assignments where family_id=$1",
            [uuid(1)],
          ),
          0,
        );
        assert.equal(
          await scalar(
            "select count(*)::int as v from public.assignments where family_id=$1",
            [uuid(8)],
          ),
          7,
        );
        await db.exec("reset role");
        assert.equal(
          await scalar(
            "select count(*)::int as v from public.replacement_invitations where search_id=$1 and response in ('pending','queued')",
            [id],
          ),
          0,
        );
        for (const n of [1, 8]) {
          await login(n);
          assert.equal(
            await scalar(
              "select count(*)::int as v from public.replacement_notifications where search_id=$1 and message like '%tagit över%'",
              [id],
            ),
            1,
          );
        }
      },
    );
    await t.test(
      "new searches recalculate load; near matches shorten deadline; only one acceptance wins",
      async () => {
        await db.exec("reset role");
        await db.exec(
          `insert into public.assignments values('${team}','1:8','Matchvärd','${uuid(1)}'); update public.matches set starts_at=now()+interval '3 hours' where id='1:8';`,
        );
        await login(1);
        id = await start("1:8", "Matchvärd");
        assert.ok(
          await scalar(
            "select deadline<=now()+interval '1 hour' as v from public.replacement_searches where id=$1",
            [id],
          ),
        );
        await login(2);
        await act(id, "accept");
        await login(3);
        await assert.rejects(act(id, "accept"));
        assert.equal(
          await scalar(
            "select family_id as v from public.assignments where match_id='1:8'",
          ),
          uuid(2),
        );
      },
    );
    await t.test(
      "changed eligibility is rechecked and stale searches cannot overwrite admin staffing",
      async () => {
        await db.exec("reset role");
        await db.exec(
          `insert into public.assignments values('${team}','1:9','OVR','${uuid(1)}');`,
        );
        await login(1);
        id = await start("1:9");
        await db.exec("reset role");
        await db.exec(`update public.families set ovr_ok=false where id='${uuid(3)}'`);
        await login(3);
        await assert.rejects(act(id, "accept"));
        await login(8);
        await db.exec(
          `update public.assignments set family_id='${uuid(4)}' where match_id='1:9'`,
        );
        await db.exec("reset role");
        await db.exec("select private.process_replacements()");
        assert.equal(
          await scalar(
            "select status as v from public.replacement_searches where id=$1",
            [id],
          ),
          "exhausted",
        );
        assert.equal(
          await scalar(
            "select family_id as v from public.assignments where match_id='1:9'",
          ),
          uuid(4),
        );
      },
    );
    await t.test(
      "admin assignment and cancellation; no candidates and kickoff exhaust without changing staffing",
      async () => {
        await db.exec("reset role");
        await db.exec(
          `insert into public.assignments select '${team}','1:'||n,'Matchvärd','${uuid(1)}' from generate_series(10,12) n;`,
        );
        await login(1);
        id = await start("1:10", "Matchvärd");
        await login(8);
        await act(id, "assign", uuid(4));
        assert.equal(
          await scalar(
            "select family_id as v from public.assignments where match_id='1:10'",
          ),
          uuid(4),
        );
        await login(1);
        id = await start("1:11", "Matchvärd");
        await act(id, "cancel");
        assert.equal(
          await scalar(
            "select status as v from public.replacement_searches where id=$1",
            [id],
          ),
          "cancelled",
        );
        assert.equal(
          await scalar(
            "select family_id as v from public.assignments where match_id='1:11'",
          ),
          uuid(1),
        );
        id = await start("1:12", "Matchvärd");
        await db.exec("reset role");
        await db.exec(
          "update public.matches set starts_at=now()-interval '1 second' where id='1:12'; select private.process_replacements()",
        );
        assert.equal(
          await scalar(
            "select status as v from public.replacement_searches where id=$1",
            [id],
          ),
          "exhausted",
        );
        await login(1);
        await assert.rejects(start("1:12", "Matchvärd"));
        await db.exec("reset role");
        await db.exec(
          `update public.family_unavailability set family_id=family_id; insert into public.family_unavailability select '${team}','1:11',id from public.families where id<>'${uuid(1)}';`,
        );
        await login(1);
        id = await start("1:11", "Matchvärd");
        assert.equal(
          await scalar(
            "select status as v from public.replacement_searches where id=$1",
            [id],
          ),
          "exhausted",
        );
      },
    );
    await t.test(
      "one family cannot accept two different slots on the same match",
      async () => {
        await db.exec("reset role");
        await db.exec(`
        insert into public.matches(team_id,id,competition,source_id,starts_at,home_team,away_team,arena,status)
        values('${team}','1:13','1','13',now()+interval '10 days','Home','Away','Arena','scheduled');
        insert into public.assignments values('${team}','1:13','Matchvärd','${uuid(1)}'),('${team}','1:13','Båsdörr 1','${uuid(4)}');
      `);
        await login(8);
        const first = await start("1:13", "Matchvärd");
        const second = await start("1:13", "Båsdörr 1");
        await login(3);
        await act(first, "accept");
        await assert.rejects(act(second, "accept"));
        assert.equal(
          await scalar(
            "select count(*)::int as v from public.assignments where match_id='1:13' and family_id=$1",
            [uuid(3)],
          ),
          1,
        );
        await login(8);
        const before = await scalar<number>(
          "select current_group as v from public.replacement_searches where id=$1",
          [second],
        );
        await act(second, "next");
        const after = await scalar<number>(
          "select current_group as v from public.replacement_searches where id=$1",
          [second],
        );
        assert.ok(
          after > before ||
            (await scalar(
              "select status='exhausted' as v from public.replacement_searches where id=$1",
              [second],
            )),
        );
      },
    );
    await t.test(
      "replacement RLS still prevents writes if table grants are accidentally broadened",
      async () => {
        await db.exec("reset role");
        await db.exec(
          "grant select,insert,update,delete on public.replacement_searches,public.replacement_invitations,public.replacement_notifications to anon,authenticated",
        );
        await login(2);
        assert.equal(
          (
            await db.query(
              "update public.replacement_searches set status='found' returning id",
            )
          ).rows.length,
          0,
        );
        assert.equal(
          (
            await db.query(
              "update public.replacement_invitations set response='accepted' returning search_id",
            )
          ).rows.length,
          0,
        );
        await assert.rejects(
          db.query(
            "insert into public.replacement_notifications(team_id,search_id,family_id,message) values($1,$2,$3,'spoof')",
            [team, id, uuid(2)],
          ),
        );
        await login(2, "anon");
        assert.equal(
          (await db.query("select * from public.replacement_searches")).rows.length,
          0,
        );
        assert.equal(
          (await db.query("select * from public.replacement_invitations")).rows.length,
          0,
        );
        assert.equal(
          (await db.query("select * from public.replacement_notifications")).rows.length,
          0,
        );
        await db.exec("reset role");
        await db.exec(
          "revoke all on public.replacement_searches,public.replacement_invitations,public.replacement_notifications from anon",
        );
      },
    );
    await t.test(
      "anonymous, revoked accounts and other teams cannot act or access notifications",
      async () => {
        await login(1, "anon");
        await assert.rejects(act(id, "accept"));
        await assert.rejects(db.query("select * from public.replacement_searches"));
        await db.exec("reset role");
        await db.exec(`update public.profiles set approved=false where id='${uuid(1)}'`);
        await login(1);
        assert.equal(
          (await db.query("select * from public.replacement_searches")).rows.length,
          0,
        );
        await assert.rejects(act(id, "accept"));
        await assert.rejects(db.exec("select private.process_replacements()"));
        await login(2);
        assert.equal(
          (
            await db.query(
              "select * from public.replacement_notifications where family_id<>auth.uid()",
            )
          ).rows.length,
          0,
        );
      },
    );
  } finally {
    await db.close();
  }
});
