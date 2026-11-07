import { useEffect, useRef, useState } from "react";
import { supabase, configuredTeamId } from "../lib/supabase";
import { demoData, replacementPreviewData } from "../lib/demo";
import type { Assignment, Data, Profile, Role, Team, Competition } from "../lib/types";
import { isPasswordRecoveryUrl, clearPasswordRecoveryUrl } from "../lib/auth";

const EMPTY_DATA: Data = {
  matches: [],
  families: [],
  assignments: [],
  instructions: [],
  logs: [],
  profiles: [],
  unavailability: [],
  replacementSearches: [],
  replacementInvitations: [],
  replacementNotifications: [],
};

export function useHockeyApp() {
  const [replacementPreview] = useState(
    () =>
      import.meta.env.DEV &&
      new URLSearchParams(window.location.search).get("preview") === "replacement",
  );
  const [demo, setDemo] = useState(replacementPreview);
  const recoveryRef = useRef(isPasswordRecoveryUrl(window.location.href));
  const [recoveringPassword, setRecoveringPassword] = useState(recoveryRef.current);
  const [data, setData] = useState<Data>(() =>
    replacementPreview ? replacementPreviewData() : EMPTY_DATA,
  );
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
  const hasLoadedData = useRef(false);
  const [loading, setLoading] = useState(!replacementPreview && !!supabase);
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
    // Refresh existing data without unmounting pages and losing match/filter state.
    setLoading(!hasLoadedData.current);
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
        hasLoadedData.current = false;
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
        hasLoadedData.current = false;
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
          "family_unavailability",
          "replacement_searches",
          "replacement_invitations",
          "replacement_notifications",
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
        unavailability: results[5].data as Data["unavailability"],
        replacementSearches: results[6].data as Data["replacementSearches"],
        replacementInvitations: results[7].data as Data["replacementInvitations"],
        replacementNotifications: results[8].data as Data["replacementNotifications"],
        profiles: (results[9]?.data || []) as Profile[],
      });
      hasLoadedData.current = true;
    } catch (e) {
      if (version !== loadVersion.current) return;
      hasLoadedData.current = false;
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
        hasLoadedData.current = false;
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
  useEffect(() => {
    if (demo || !profile?.approved || recoveringPassword) return;
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [demo, profile?.approved, recoveringPassword]);

  async function replacementAction(
    action: string,
    input: { matchId?: string; role?: Role; searchId?: string; familyId?: string },
  ) {
    if (busy) return;
    if (demo) {
      notify(
        "Ersättarsökning kräver en ansluten databas. Demoläget skickar inga förfrågningar.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result =
        action === "start"
          ? await supabase!.rpc("start_replacement", {
              p_team_id: configuredTeamId,
              p_match_id: input.matchId,
              p_role: input.role,
            })
          : await supabase!.rpc("act_on_replacement", {
              p_search_id: input.searchId,
              p_action: action,
              p_family_id: input.familyId || null,
            });
      if (result.error) throw result.error;
      await load();
      notify(
        action === "accept" || action === "assign"
          ? "Passet har tagits över. Schemat är uppdaterat."
          : "Ersättarsökningen är uppdaterad.",
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : (error as { message?: string }).message ||
              "Ändringen kunde inte sparas. Uppdatera och försök igen.",
      );
    } finally {
      setBusy(false);
    }
  }

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
    hasLoadedData.current = false;
    setProfile(null);
    setUserId(null);
    setTeam(null);
    setData(EMPTY_DATA);
    setDemo(false);
    return true;
  }
  async function publishSchedule(expected: Assignment[], proposal: Assignment[]) {
    if (!admin || busy) return false;
    setBusy(true);
    setError("");
    const normalize = (rows: Assignment[]) =>
      rows.map(({ match_id, role, family_id, locked }) => ({
        match_id,
        role,
        family_id,
        locked: !!locked,
      }));
    try {
      if (!demo) {
        const { error } = await supabase!.rpc("publish_schedule", {
          p_team_id: configuredTeamId,
          p_expected: normalize(expected),
          p_proposal: normalize(proposal),
        });
        if (error) throw error;
      }
      setData((d) => ({ ...d, assignments: proposal }));
      notify("Schemat är publicerat.");
      return true;
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Publiceringen misslyckades. Uppdatera och skapa ett nytt förslag.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function assign(matchId: string, role: Role, familyId: string) {
    const current = data.assignments.find(
      (a) => a.match_id === matchId && a.role === role,
    );
    const match = data.matches.find((m) => m.id === matchId);
    if (
      current?.locked ||
      match?.status === "finished" ||
      (match?.starts_at && Date.parse(match.starts_at) <= Date.now())
    )
      return;
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
    const version = loadVersion.current;
    setBusy(true);
    try {
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
      if (version !== loadVersion.current) return;
      if (result.error) throw result.error;
      // Keep the list mounted so scroll, filters and focus survive saving.
      setData((d) => ({
        ...d,
        assignments: [
          ...d.assignments.filter((a) => a.match_id !== matchId || a.role !== role),
          ...(familyId ? [{ match_id: matchId, role, family_id: familyId }] : []),
        ],
      }));
      notify("Bemanningen är sparad.");
    } catch {
      if (version === loadVersion.current)
        setError("Bemanningen kunde inte sparas. Försök igen.");
    } finally {
      setBusy(false);
    }
  }

  async function setUnavailable(matchId: string, unavailable: boolean) {
    if (!ownFamily || busy) return;
    const familyId = ownFamily;
    const version = loadVersion.current;
    setBusy(true);
    setError("");
    try {
      if (!demo) {
        const result = unavailable
          ? await supabase!
              .from("family_unavailability")
              .upsert(
                { team_id: configuredTeamId, match_id: matchId, family_id: familyId },
                { onConflict: "team_id,match_id,family_id" },
              )
          : await supabase!
              .from("family_unavailability")
              .delete()
              .eq("team_id", configuredTeamId)
              .eq("match_id", matchId)
              .eq("family_id", familyId);
        if (result.error) throw result.error;
      }
      if (version !== loadVersion.current) return;
      setData((d) => ({
        ...d,
        unavailability: [
          ...d.unavailability.filter(
            (item) => item.match_id !== matchId || item.family_id !== familyId,
          ),
          ...(unavailable ? [{ match_id: matchId, family_id: familyId }] : []),
        ],
      }));
      notify("Familjens tillgänglighet är sparad.");
    } catch {
      if (version === loadVersion.current)
        setError("Tillgängligheten kunde inte sparas. Försök igen.");
    } finally {
      setBusy(false);
    }
  }

  async function addPlayers(input: string) {
    const names = [
      ...new Set(
        input
          .split(/\r?\n/)
          .map((name) => name.trim())
          .filter(Boolean),
      ),
    ];
    if (!names.length || names.some((name) => name.length > 120)) {
      setError("Ange ett spelarnamn per rad, högst 120 tecken per namn.");
      return false;
    }
    const newNames = names.filter((name) => !data.families.some((f) => f.name === name));
    if (!newNames.length) {
      notify("Spelarna finns redan i listan.");
      return true;
    }
    setBusy(true);
    setError("");
    try {
      if (demo) {
        setData((d) => ({
          ...d,
          families: [
            ...d.families,
            ...newNames.map((name) => ({
              id: crypto.randomUUID(),
              name,
              ovr_ok: false,
              clock_ok: false,
              speaker_ok: false,
            })),
          ],
        }));
      } else {
        const { error } = await supabase!.from("families").upsert(
          newNames.map((name) => ({ team_id: configuredTeamId, name })),
          { onConflict: "team_id,name", ignoreDuplicates: true },
        );
        if (error) throw error;
        await load();
      }
      notify("Spelarlistan är sparad.");
      return true;
    } catch {
      setError("Spelarna kunde inte sparas. Försök igen.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function updatePlayer(
    id: string,
    patch: Partial<
      Pick<
        Data["families"][number],
        "ovr_ok" | "clock_ok" | "speaker_ok" | "staffing_exempt"
      >
    >,
  ) {
    if (demo) {
      setData((d) => ({
        ...d,
        families: d.families.map((f) => (f.id === id ? { ...f, ...patch } : f)),
      }));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase!
        .from("families")
        .update(patch)
        .eq("team_id", configuredTeamId)
        .eq("id", id);
      if (error) throw error;
      await load();
      notify("Behörigheten är sparad.");
    } catch {
      setError("Behörigheten kunde inte sparas.");
    } finally {
      setBusy(false);
    }
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
  async function saveMyDutyRoles(roles: string[]) {
    if (!roles.length) throw new Error("Välj minst en uppgift.");
    if (demo) {
      setData((d) => ({
        ...d,
        families: d.families.map((f) =>
          f.id === ownFamily
            ? {
                ...f,
                ovr_ok: roles.includes("OVR"),
                clock_ok: roles.includes("Klockan"),
                speaker_ok: roles.includes("Speaker/Musik"),
              }
            : f,
        ),
      }));
      return;
    }
    const { error } = await supabase!.rpc("save_my_duty_roles", {
      p_team_id: configuredTeamId,
      p_roles: roles,
    });
    if (error) throw new Error("Uppgifterna kunde inte sparas. Försök igen.");
    await load();
  }

  async function sync() {
    if (demo) {
      notify("Demoläget hämtar inga matchdata. Koppla Supabase för att aktivera synk.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { data: sessionData, error: sessionError } =
        await supabase!.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) {
        setError(
          "Din inloggning saknas eller har gått ut. Logga in igen för att hämta matcher.",
        );
        return;
      }
      const { data: result, error } = await supabase!.functions.invoke("dispatch-sync", {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        body: { team_id: configuredTeamId },
      });
      if (error) {
        if (error.context instanceof Response) {
          const details = await error.context.json().catch(() => null);
          if (typeof details?.message === "string") {
            setError(details.message);
            return;
          }
        }
        throw error;
      }
      await load();
      notify(result?.message || "Matcherna är uppdaterade. Bemanningen finns kvar.");
    } catch {
      setError(
        "Matchhämtningen kunde inte startas. Försök igen senare. Kontakta appansvarig om problemet kvarstår. Befintliga matcher och bemanning finns kvar.",
      );
    } finally {
      setBusy(false);
    }
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
    notify,
    load,
    startDemo,
    logout,
    assign,
    publishSchedule,
    setUnavailable,
    replacementAction,
    addPlayers,
    updatePlayer,
    updateProfile,
    saveMyDutyRoles,
    sync,
    exportData,
  };
}

export type HockeyApp = ReturnType<typeof useHockeyApp>;
