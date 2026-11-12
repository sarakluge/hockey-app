import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import webpush from "npm:web-push@3.6.7";
import { dispatchNotifications } from "./handler.ts";

Deno.serve((req: Request) =>
  dispatchNotifications(req, {
    env: (name) => Deno.env.get(name),
    rpc: async (name, args) => {
      const db = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        {
          auth: { persistSession: false, autoRefreshToken: false },
        },
      );
      return await db.rpc(name, args);
    },
    push: (subscription, payload, ttl) =>
      webpush.sendNotification(subscription, payload, {
        TTL: ttl,
        timeout: 12000,
        vapidDetails: {
          subject: Deno.env.get("VAPID_SUBJECT")!,
          publicKey: Deno.env.get("VAPID_PUBLIC_KEY")!,
          privateKey: Deno.env.get("VAPID_PRIVATE_KEY")!,
        },
      }),
  }),
);
