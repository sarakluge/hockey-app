import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { demoData } from "../lib/demo";
import type { Data, Profile, Role } from "../lib/types";
import { previewExcel, type ImportPreview } from "../lib/excel";

const EMPTY_DATA: Data = {
  matches: [],
  families: [],
  assignments: [],
  instructions: [],
  logs: [],
  profiles: [],
};

export function useHockeyApp() {
  const [demo, setDemo] = useState(!supabase);
  const [data, setData] = useState<Data>(
    supabase ? EMPTY_DATA : structuredClone(demoData),
  );
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!!supabase);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importApproved, setImportApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const admin = demo || profile?.role === "ADMIN";
  const ownFamily = demo ? "demo-family-2" : profile?.family_id;

  function notify(message: string) {
    setError("");
    setMessage(message);
  }
  async function load() {
    if (!supabase || demo) return;
    setLoading(true);
    setError("");
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError && user) throw authError;
      setUserId(user?.id || null);
      if (!user) {
        setProfile(null);
        setData(EMPTY_DATA);
        return;
      }
      const { data: p, error: pe } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (pe) throw pe;
      setProfile(p);
      if (!p.approved) {
        setData(EMPTY_DATA);
        return;
      }
      const results = await Promise.all(
        [
          "matches",
          "families",
          "assignments",
          "instructions",
          "sync_logs",
          ...(p.role === "ADMIN" ? ["profiles"] : []),
        ].map((t) => supabase!.from(t).select("*")),
      );
      for (const r of results) if (r.error) throw r.error;
      setData({
        matches: results[0].data as Data["matches"],
        families: results[1].data as Data["families"],
        assignments: results[2].data as Data["assignments"],
        instructions: results[3].data as Data["instructions"],
        logs: results[4].data as Data["logs"],
        profiles: (results[5]?.data || []) as Profile[],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Data kunde inte hämtas. Försök igen.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (demo) return;
    void load();
    const subscription = supabase?.auth.onAuthStateChange(() => {
      window.setTimeout(() => void load(), 0);
    });
    return () => subscription?.data.subscription.unsubscribe();
  }, [demo]);
  function startDemo() {
    setDemo(true);
    setData(structuredClone(demoData));
    setProfile(null);
    setLoading(false);
    notify(
      "Demoläge: alla matcher och familjer är fiktiva. Ändringar sparas bara under besöket.",
    );
  }
  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + import.meta.env.BASE_URL,
      },
    });
    setBusy(false);
    if (error) setError(error.message);
    else notify("En engångslänk har skickats till din e-post.");
  }
  async function logout() {
    await supabase?.auth.signOut();
    setProfile(null);
    setUserId(null);
    setData(EMPTY_DATA);
    setDemo(false);
  }
  async function assign(matchId: string, role: Role, familyId: string) {
    setError("");
    if (demo) {
      setData((d) => ({
        ...d,
        assignments: [
          ...d.assignments.filter((a) => a.match_id !== matchId || a.role !== role),
          ...(familyId ? [{ match_id: matchId, role, family_id: familyId }] : []),
        ],
      }));
      return;
    }
    setBusy(true);
    const result = familyId
      ? await supabase!
          .from("assignments")
          .upsert(
            { match_id: matchId, role, family_id: familyId },
            { onConflict: "match_id,role" },
          )
      : await supabase!
          .from("assignments")
          .delete()
          .eq("match_id", matchId)
          .eq("role", role);
    if (result.error) setError(result.error.message);
    else {
      notify("Bemanningen är sparad.");
      await load();
    }
    setBusy(false);
  }
  async function updateProfile(id: string, patch: Partial<Profile>) {
    if (!supabase || demo) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    if (error) setError(error.message);
    else {
      notify("Användaren är uppdaterad.");
      await load();
    }
    setBusy(false);
  }
  async function sync() {
    if (demo) {
      notify("Demoläget hämtar inga matchdata. Koppla Supabase för att aktivera synk.");
      return;
    }
    setBusy(true);
    setError("");
    const { data: result, error } = await supabase!.functions.invoke("dispatch-sync", {
      body: {},
    });
    setBusy(false);
    if (error)
      setError(
        "Synken kunde inte startas. Kontrollera Edge Function eller starta sync.yml i GitHub Actions.",
      );
    else notify(result.message);
  }
  async function readFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setPreview(null);
    setImportApproved(false);
    setError("");
    try {
      setPreview(await previewExcel(file, data.matches));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte läsa filen");
    } finally {
      setBusy(false);
    }
  }
  async function importData() {
    if (
      !preview ||
      !importApproved ||
      preview.rows.some((r) => !r.match_id || !r.confirmed)
    )
      return;
    if (demo) {
      setError(
        "Import av personuppgifter är avstängd i demoläget. Förhandsvisningen sparas inte.",
      );
      return;
    }
    setBusy(true);
    const { error } = await supabase!.rpc("import_excel", { p_data: preview });
    if (error) setError(error.message);
    else {
      setPreview(null);
      setImportApproved(false);
      notify("Importen är klar.");
      await load();
    }
    setBusy(false);
  }
  function exportData() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exported_at: new Date().toISOString(),
            ...data,
            profiles: undefined,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hemmaplan-privat-export.json";
    a.click();
    URL.revokeObjectURL(url);
    notify("Exporten innehåller personuppgifter. Förvara filen privat.");
  }

  return {
    demo,
    data,
    profile,
    userId,
    email,
    setEmail,
    message,
    setMessage,
    error,
    setError,
    loading,
    busy,
    admin,
    ownFamily,
    preview,
    setPreview,
    importApproved,
    setImportApproved,
    notify,
    load,
    startDemo,
    login,
    logout,
    assign,
    updateProfile,
    sync,
    readFile,
    importData,
    exportData,
  };
}

export type HockeyApp = ReturnType<typeof useHockeyApp>;
