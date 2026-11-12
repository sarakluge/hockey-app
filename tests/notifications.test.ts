import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  dispatchNotifications,
  type Delivery,
} from "../supabase/functions/dispatch-notifications/handler";

const team = "20000000-0000-0000-0000-000000000001";
const uid = (n: number) => `10000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

test("external notifications respect group activation, recipients, consent, leases and stale requests", async () => {
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
      "005_family_unavailability.sql",
      "006_shift_replacements.sql",
      "008_scheduling.sql",
      "009_manual_multiple_positions.sql",
      "010_staffing_exempt.sql",
      "014_external_notifications.sql",
      "017_open_replacement_acceptance.sql",
      "018_voluntary_multiple_shifts.sql",
    ]) {
      await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    }
    await db.exec(`
      insert into public.clubs(id,name) values('${uid(90)}','Club');
      insert into public.teams(id,club_id,name,home_team) values('${team}','${uid(90)}','Team','Home');
      insert into public.team_competitions values('${team}','1','serie');
      insert into public.matches(team_id,id,competition,source_id,starts_at,home_team,away_team,arena,status)
        select '${team}','1:'||n,'1',n::text,now()+interval '10 days','Home','Away','Arena','scheduled' from generate_series(1,8) n;
      insert into auth.users(id,email) select ('10000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'user'||n||'@example.invalid' from generate_series(1,5) n;
      insert into public.families(id,team_id,name,ovr_ok) select id,'${team}',email,true from auth.users where id<>'${uid(5)}';
      insert into public.profiles(team_id,id,email,approved,family_id)
        select '${team}',id,email,id<>'${uid(4)}',case when id='${uid(5)}' then '${uid(2)}'::uuid else id end from auth.users;
      insert into public.assignments values('${team}','1:1','OVR','${uid(1)}');
      insert into public.assignments select '${team}','1:'||n,'OVR','${uid(3)}' from generate_series(2,8) n;
      insert into public.push_subscriptions(team_id,user_id,endpoint,p256dh,auth)
        values('${team}','${uid(2)}','https://web.push.apple.com/example',repeat('A',87),repeat('A',22));
    `);
    const login = async (n: number, role = "authenticated") => {
      await db.exec("reset role");
      await db.query(
        "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",
        [uid(n), role],
      );
      await db.exec(`set role ${role}`);
    };
    await login(1);
    // No ability to invoke the service dispatcher or inspect other device keys.
    await assert.rejects(
      db.query("select * from public.claim_notification_deliveries(array['email'])"),
    );
    assert.equal(
      (await db.query("select * from public.push_subscriptions")).rows.length,
      0,
    );
    await assert.rejects(
      db.query(
        `insert into public.push_subscriptions(team_id,user_id,endpoint,p256dh,auth) values('${team}','${uid(2)}','https://web.push.apple.com/forged',repeat('A',87),repeat('A',22))`,
      ),
    );
    const search = (
      await db.query<{ id: string }>(
        "select public.start_replacement($1,'1:1','OVR') id",
        [team],
      )
    ).rows[0].id;
    await db.exec("reset role");
    const rows = (
      await db.query<{ user_id: string; channel: string }>(
        "select user_id,channel from public.notification_deliveries",
      )
    ).rows;
    assert.deepEqual(
      rows.map((r) => `${r.user_id}:${r.channel}`).sort(),
      [`${uid(2)}:email`, `${uid(2)}:push`, `${uid(5)}:email`].sort(),
    );
    // The later group has no notification, unapproved parents get none, both approved co-parents do.
    await login(5);
    await db.query(
      "insert into public.notification_preferences(team_id,user_id,email_enabled) values($1,$2,false)",
      [team, uid(5)],
    );
    await login(2, "service_role");
    const claim = async () =>
      (
        await db.query<{ v: Delivery }>(
          "select public.claim_notification_deliveries(array['email','push']) v",
        )
      ).rows.map((r) => r.v);
    const claimed = await claim();
    assert.equal(claimed.length, 2);
    assert.equal(claimed[0].deadline !== null, true);
    assert.equal((await claim()).length, 0); // Active lease prevents duplicates.
    const item = claimed.find((r) => r.channel === "email")!;
    await db.query(
      "select public.finish_notification_delivery($1,$2,'retry','Provider HTTP 429')",
      [item.id, item.lease_id],
    );
    await db.exec("reset role");
    await db.query(
      "update public.notification_deliveries set available_at=now()-interval '1 minute' where id=$1",
      [item.id],
    );
    await login(2, "service_role");
    const retry = (await claim())[0];
    assert.notEqual(retry.lease_id, item.lease_id);
    await db.query("select public.finish_notification_delivery($1,$2,'sent',null)", [
      item.id,
      item.lease_id,
    ]);
    await db.exec("reset role");
    assert.equal(
      (
        await db.query<{ state: string }>(
          "select state from public.notification_deliveries where id=$1",
          [item.id],
        )
      ).rows[0].state,
      "sending",
    );
    // Cancellation invalidates an undelivered invitation when a lease expires.
    await login(1);
    await db.query("select public.act_on_replacement($1,'cancel')", [search]);
    await db.exec("reset role");
    await db.exec(
      "update public.notification_deliveries set available_at=now()-interval '1 minute' where state='sending'",
    );
    await login(2, "service_role");
    assert.equal((await claim()).length, 0);
    await db.exec("reset role");
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select count(*)::integer n from public.notification_deliveries where state<>'skipped'",
        )
      ).rows[0].n,
      0,
    );
    // Switching an existing installation to push-only keeps historical data.
    await db.exec(
      await readFile("supabase/migrations/016_push_only_notifications.sql", "utf8"),
    );
    // A completed handover only queues subscribed devices after the upgrade.
    await login(1);
    const next = (
      await db.query<{ id: string }>(
        "select public.start_replacement($1,'1:1','OVR') id",
        [team],
      )
    ).rows[0].id;
    await login(2);
    await db.query("select public.act_on_replacement($1,'accept')", [next]);
    await login(2, "service_role");
    const status = await claim();
    assert.equal(status.length, 1); // Only the replacement family has a subscribed device.
    assert.ok(status.every((item) => item.channel === "push"));
    assert.ok(status.every((r) => !r.is_request));
    const push = status.find((r) => r.channel === "push")!;
    await db.query("select public.finish_notification_delivery($1,$2,'expired',null)", [
      push.id,
      push.lease_id,
    ]);
    await db.exec("reset role");
    assert.equal(
      (await db.query("select * from public.push_subscriptions")).rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});

test("push dispatcher authenticates, retries failures and expires revoked endpoints", async () => {
  const env: Record<string, string> = {
    NOTIFICATION_DISPATCH_SECRET: "secret",
    APP_URL: "https://example.com/hockey-app/",
    VAPID_PUBLIC_KEY: "public",
    VAPID_PRIVATE_KEY: "private",
    VAPID_SUBJECT: "mailto:admin@example.com",
    // Old email credentials must not enable email deliveries.
    RESEND_API_KEY: "old-key",
    NOTIFICATION_FROM: "old@example.com",
  };
  const item: Delivery = {
    id: uid(1),
    lease_id: uid(2),
    channel: "push",
    email: "unused@example.com",
    subscription: {
      endpoint: "https://web.push.apple.com/example",
      keys: { auth: "a", p256dh: "b" },
    },
    search_id: uid(3),
    message: "Kan ni ta passet?",
    role: "OVR",
    away_team: "Away",
    starts_at: "2026-12-01T18:00:00Z",
    deadline: "2099-12-01T17:00:00Z",
    is_request: true,
  };
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  let failure: number | null = null;
  let pushes = 0;
  const deps = {
    env: (name: string) => env[name],
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      if (name === "claim_notification_deliveries")
        assert.deepEqual(args.p_channels, ["push"]);
      return {
        error: null,
        data: name === "claim_notification_deliveries" ? [item] : null,
      };
    },
    push: async (_subscription: unknown, payload: string, ttl: number) => {
      pushes++;
      const data = JSON.parse(payload);
      assert.equal(data.url, "https://example.com/hockey-app/#mina");
      assert.match(data.body, /19:00/);
      assert.equal(ttl, 3600);
      if (failure) throw { statusCode: failure };
    },
  };
  const req = () =>
    new Request("https://edge.test", {
      method: "POST",
      headers: { Authorization: "Bearer secret" },
    });
  assert.equal(
    (
      await dispatchNotifications(
        new Request("https://edge.test", { method: "POST" }),
        deps,
      )
    ).status,
    401,
  );
  assert.equal(calls.length, 0);
  assert.equal((await dispatchNotifications(req(), deps)).status, 200);
  assert.equal(pushes, 1);
  assert.equal(calls.at(-1)!.args.p_result, "sent");
  failure = 410;
  await dispatchNotifications(req(), deps);
  assert.equal(calls.at(-1)!.args.p_result, "expired");
  failure = 429;
  await dispatchNotifications(req(), deps);
  assert.equal(calls.at(-1)!.args.p_result, "retry");
  delete env.VAPID_PRIVATE_KEY;
  const before = calls.length;
  assert.equal((await dispatchNotifications(req(), deps)).status, 503);
  assert.equal(calls.length, before);
});
