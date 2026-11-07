import { useEffect, useRef, useState } from "react";
import { supabase, configuredTeamId } from "../lib/supabase";
import { demoData } from "../lib/demo";
import type { Data, Profile, Role, Team, Competition } from "../lib/types";
import { type ImportPreview } from "../lib/excel";
import { isPasswordRecoveryUrl, clearPasswordRecoveryUrl } from "../lib/auth";

const EMPTY_DATA: Data = {
  matches: [],
  families: [],
  assignments: [],
  instructions: [],
  logs: [],
  profiles: [],
};

export function useHockeyApp() {
  const [demo, setDemo] = useState(false);
  const recoveryRef = useRef(isPasswordRecoveryUrl(window.location.href));
  const [recoveringPassword, setRecoveringPassword] = useState(recoveryRef.current);
  const [data, setData] = useState<Data>(EMPTY_DATA);
  const [team, setTeam] = useState<Team | null>(null);
  const [competitions, setCompetitions] = useState<Competition[]>([
    { competition: "21495", kind: "serie" },
    { competition: "22208", kind: "dm" },
  ]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const loadVersion = useRef(0);
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
    const version = ++loadVersion.current;
    setLoading(true);
    setError("");
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (version !== loadVersion.current) return;
      if (authError && user) throw authError;
      setUserId(user?.id || null);
      if (!user) {
        setProfile(null);
        setData(EMPTY_DATA);
        return;
      }
      if (recoveryRef.current) {
        setProfile(null);
        setData(EMPTY_DATA);
        return;
      }
      if (!configuredTeamId)
        throw new Error("VITE_TEAM_ID måste anges för det valda laget.");
      const { error: accessError } = await supabase.rpc("request_team_access", {
        p_team_id: configuredTeamId,
      });
      if (version !== loadVersion.current) return;
      if (accessError) throw accessError;
      const { data: selectedTeam, error: teamError } = await supabase
        .from("teams")
        .select("*")
        .eq("id", configuredTeamId)
        .single();
      if (version !== loadVersion.current) return;
      if (teamError) throw teamError;
      setTeam(selectedTeam);
      const { data: p, error: pe } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .eq("team_id", configuredTeamId)
        .single();
      if (version !== loadVersion.current) return;
      if (pe) throw pe;
      setProfile(p);
      if (!p.approved) {
        setData(EMPTY_DATA);
        return;
      }
      const { data: teamCompetitions, error: competitionError } = await supabase
        .from("team_competitions")
        .select("competition, kind")
        .eq("team_id", configuredTeamId);
      if (version !== loadVersion.current) return;
      if (competitionError) throw competitionError;
      setCompetitions(teamCompetitions || []);
      const results = await Promise.all(
        [
          "matches",
          "families",
          "assignments",
          "instructions",
          "sync_logs",
          ...(p.role === "ADMIN" ? ["profiles"] : []),
        ].map((t) => supabase!.from(t).select("*").eq("team_id", configuredTeamId)),
      );
      if (version !== loadVersion.current) return;
      for (const r of results) if (r.error) throw r.error;
      setData({
        matches: (results[0].data as Data["matches"]).map((match) => ({
          ...match,
          kind: teamCompetitions?.find((item) => item.competition === match.competition)
            ?.kind,
        })),
        families: results[1].data as Data["families"],
        assignments: results[2].data as Data["assignments"],
        instructions: results[3].data as Data["instructions"],
        logs: results[4].data as Data["logs"],
        profiles: (results[5]?.data || []) as Profile[],
      });
    } catch (e) {
      if (version !== loadVersion.current) return;
      setProfile(null);
      setData(EMPTY_DATA);
      setError(e instanceof Error ? e.message : "Data kunde inte hämtas. Försök igen.");
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }

  useEffect(() => {
    if (demo) return;
    void load();
    const subscription = supabase?.auth.onAuthStateChange((event) => {
      loadVersion.current += 1;
      if (event === "SIGNED_OUT") {
        setProfile(null);
        setUserId(null);
        setData(EMPTY_DATA);
      }
      if (event === "PASSWORD_RECOVERY") {
        recoveryRef.current = true;
        setRecoveringPassword(true);
      }
      window.setTimeout(() => void load(), 0);
    });
    return () => {
      loadVersion.current += 1;
      subscription?.data.subscription.unsubscribe();
    };
  }, [demo]);
  function startDemo() {
    loadVersion.current += 1;
    setDemo(true);
    setTeam(null);
    setCompetitions([
      { competition: "21495", kind: "serie" },
      { competition: "22208", kind: "dm" },
    ]);
    setData(structuredClone(demoData));
    setProfile(null);
    setLoading(false);
    notify(
      "Demoläge: alla matcher och familjer är fiktiva. Ändringar sparas bara under besöket.",
    );
  }
  function cancelPasswordRecovery() {
    recoveryRef.current = false;
    setRecoveringPassword(false);
    clearPasswordRecoveryUrl();
  }

  async function completePasswordRecovery() {
    const signedOut = await logout();
    if (!signedOut)
      throw new Error(
        "Lösenordet är uppdaterat men utloggningen misslyckades. Försök logga ut igen.",
      );
    notify("Ditt lösenord är uppdaterat. Logga in med det nya lösenordet.");
  }
  async function logout() {
    loadVersion.current += 1;
    const result = await supabase?.auth.signOut({ scope: "local" });
    if (result?.error) {
      setError("Det gick inte att logga ut. Kontrollera anslutningen och försök igen.");
      return false;
    }
    cancelPasswordRecovery();
    setProfile(null);
    setUserId(null);
    setTeam(null);
    setData(EMPTY_DATA);
    setDemo(false);
    return true;
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
            { team_id: configuredTeamId, match_id: matchId, role, family_id: familyId },
            { onConflict: "team_id,match_id,role" },
          )
      : await supabase!
          .from("assignments")
          .delete()
          .eq("team_id", configuredTeamId)
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
    const { error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("team_id", configuredTeamId)
      .eq("id", id);
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
      body: { team_id: configuredTeamId },
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
      const { previewExcel } = await import("../lib/excel");
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
    const { error } = await supabase!.rpc("import_excel", {
      p_team_id: configuredTeamId,
      p_data: preview,
    });
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
    recoveringPassword,
    cancelPasswordRecovery,
    completePasswordRecovery,
    team,
    competitions,
    data,
    profile,
    userId,
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
