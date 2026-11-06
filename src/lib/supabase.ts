import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url, key) : null;

// Public deployment context. RLS still checks membership server-side.
export const configuredTeamId = import.meta.env.VITE_TEAM_ID as string | undefined;
