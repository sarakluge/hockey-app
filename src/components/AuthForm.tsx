import { useState } from "react";
import type { FormEvent } from "react";
import { Alert, Button, CircularProgress, Stack, TextField } from "@mui/material";
import { ArrowRight } from "lucide-react";
import { supabase } from "../lib/supabase";
import { authRedirectUrl, passwordValidation } from "../lib/auth";
import type { HockeyApp } from "../hooks/useHockeyApp";
import PasswordField from "./PasswordField";

export type AuthMode = "login" | "signup" | "forgot" | "reset";
interface AuthFormProps {
  mode: AuthMode;
  app: HockeyApp;
  onModeChange: (mode: "login" | "signup" | "forgot") => void;
}

export default function AuthForm({ mode, app, onModeChange }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!supabase) {
      setError("Inloggningen är inte konfigurerad ännu. Du kan utforska demoläget.");
      return;
    }
    if (mode === "signup" || mode === "reset") {
      const validation = passwordValidation(password, confirmation);
      if (validation) {
        setError(validation);
        return;
      }
    }
    setBusy(true);
    try {
      const redirect = authRedirectUrl(window.location.origin, import.meta.env.BASE_URL);
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error)
          throw new Error(
            error.code === "email_not_confirmed"
              ? "Bekräfta din e-postadress innan du loggar in. Kontrollera din inkorg."
              : "Det gick inte att logga in. Kontrollera e-postadressen och lösenordet och försök igen.",
          );
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: redirect },
        });
        if (error)
          throw new Error(
            "Kontot kunde inte skapas. Kontrollera uppgifterna och försök igen. Lösenordet måste uppfylla lagets lösenordskrav.",
          );
        setPassword("");
        setConfirmation("");
        setMessage(
          "Kontrollera din e-post för att bekräfta kontot. Om du redan har ett konto kan du logga in eller återställa lösenordet. Lagets administratör behöver därefter godkänna din åtkomst.",
        );
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: authRedirectUrl(
            window.location.origin,
            import.meta.env.BASE_URL,
            true,
          ),
        });
        if (error)
          throw new Error(
            "Återställningen kunde inte skickas just nu. Vänta en stund och försök igen.",
          );
        setMessage(
          "Om det finns ett konto med den e-postadressen skickar vi en länk för att återställa lösenordet. Kontrollera även skräpposten.",
        );
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error)
          throw new Error(
            "Lösenordet kunde inte sparas. Kontrollera lösenordskraven eller begär en ny återställningslänk.",
          );
        setPassword("");
        setConfirmation("");
        await app.completePasswordRecovery();
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Något gick fel. Försök igen.");
    } finally {
      setBusy(false);
    }
  }

  const newPassword = mode === "signup" || mode === "reset";
  const submitLabel = {
    login: "Logga in",
    signup: "Skapa konto",
    forgot: "Skicka återställningslänk",
    reset: "Spara nytt lösenord",
  }[mode];

  return (
    <Stack component="form" onSubmit={submit} spacing={2.5} aria-label={submitLabel}>
      {error && <Alert severity="error">{error}</Alert>}
      {message && (
        <Alert severity="success" role="status">
          {message}
        </Alert>
      )}
      {!message && (
        <>
          {mode !== "reset" && (
            <TextField
              label="E-postadress"
              type="email"
              required
              fullWidth
              autoComplete="email"
              disabled={busy}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          )}
          {mode !== "forgot" && (
            <PasswordField
              label={mode === "reset" ? "Nytt lösenord" : "Lösenord"}
              value={password}
              onChange={setPassword}
              autoComplete={newPassword ? "new-password" : "current-password"}
              disabled={busy}
              helperText={
                newPassword
                  ? "Minst 8 tecken. Använd gärna en lång, unik lösenfras."
                  : undefined
              }
            />
          )}
          {newPassword && (
            <PasswordField
              label="Bekräfta lösenord"
              value={confirmation}
              onChange={setConfirmation}
              autoComplete="new-password"
              disabled={busy}
            />
          )}
          {mode === "login" && (
            <Button
              sx={{ alignSelf: "flex-end", mt: "0 !important" }}
              onClick={() => onModeChange("forgot")}
              disabled={busy}
            >
              Glömt lösenord?
            </Button>
          )}
          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={busy}
            endIcon={
              busy ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <ArrowRight size={18} />
              )
            }
          >
            {busy ? "Vänta…" : submitLabel}
          </Button>
        </>
      )}
      {(mode === "forgot" || message) && (
        <Button onClick={() => onModeChange("login")} disabled={busy}>
          Tillbaka till inloggning
        </Button>
      )}
    </Stack>
  );
}
