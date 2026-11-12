import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { HockeyApp } from "../hooks/useHockeyApp";
import { supabase } from "../lib/supabase";
import { authRedirectUrl, passwordValidation } from "../lib/auth";
import NotificationSettings from "../components/NotificationSettings";
import PasswordField from "../components/PasswordField";

export default function ProfilePage({
  app,
  required = false,
}: {
  app: HockeyApp;
  required?: boolean;
}) {
  const family = app.data.families.find((f) => f.id === app.ownFamily);
  const [roles, setRoles] = useState<string[]>([
    ...(family?.ovr_ok ? ["OVR"] : []),
    ...(family?.clock_ok ? ["Klockan"] : []),
    ...(family?.speaker_ok ? ["Speaker/Musik"] : []),
  ]);
  const [email, setEmail] = useState(app.profile?.email || "");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function perform(action: () => Promise<void>, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Något gick fel. Försök igen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack spacing={3}>
      {error && <Alert severity="error">{error}</Alert>}
      {message && (
        <Alert severity="success" role="status">
          {message}
        </Alert>
      )}
      {!family && (
        <Alert severity="info">
          Administratören behöver koppla ditt konto till rätt spelare innan familjens val
          kan visas och ändras.
        </Alert>
      )}
      <Card>
        <CardContent>
          <Stack
            spacing={2}
            component="form"
            onSubmit={(e) => {
              e.preventDefault();
              void perform(
                () => app.saveMyDutyRoles(roles),
                "Familjens uppgifter är sparade.",
              );
            }}
          >
            <Typography variant="h2">
              {required ? "Välj familjens uppgifter" : "Familjens uppgifter"}
            </Typography>
            {app.profile?.parent_name && (
              <Typography>{app.profile.parent_name}</Typography>
            )}
            <Typography>
              Välj minst en uppgift familjen kan hjälpa till med i sekretariatet. Valen
              delas av alla föräldrar i familjen och kan ändras här senare.
            </Typography>
            <FormGroup aria-label="Uppgifter i sekretariatet">
              {["OVR", "Klockan", "Speaker/Musik"].map((role) => (
                <FormControlLabel
                  key={role}
                  label={role}
                  control={
                    <Checkbox
                      checked={roles.includes(role)}
                      disabled={
                        busy || !family || (roles.length === 1 && roles.includes(role))
                      }
                      onChange={(_, checked) =>
                        setRoles(
                          checked ? [...roles, role] : roles.filter((r) => r !== role),
                        )
                      }
                    />
                  }
                />
              ))}
            </FormGroup>
            <Typography variant="body2" color="text.secondary">
              Minst en uppgift måste alltid vara vald. För att byta, välj en ny uppgift
              innan du tar bort den gamla.
            </Typography>
            <Button
              type="submit"
              variant="contained"
              disabled={busy || !roles.length || !family}
            >
              {busy ? "Sparar…" : required ? "Spara och fortsätt" : "Spara uppgifter"}
            </Button>
          </Stack>
        </CardContent>
      </Card>
      {!required && <NotificationSettings app={app} />}
      {!required && (
        <>
          <Card>
            <CardContent>
              <Stack
                spacing={2}
                component="form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void perform(async () => {
                    const { error } = await supabase!.auth.updateUser(
                      { email: email.trim() },
                      {
                        emailRedirectTo: authRedirectUrl(
                          window.location.origin,
                          import.meta.env.BASE_URL,
                        ),
                      },
                    );
                    if (error)
                      throw new Error(
                        "E-postadressen kunde inte ändras. Kontrollera adressen och försök igen.",
                      );
                  }, "Bekräfta ändringen via länken i din e-post. Du kan behöva bekräfta både den gamla och den nya adressen.");
                }}
              >
                <Typography variant="h2">E-postadress</Typography>
                <TextField
                  label="E-postadress"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy || app.demo}
                />
                <Button
                  type="submit"
                  variant="outlined"
                  disabled={busy || app.demo || email.trim() === app.profile?.email}
                >
                  Ändra e-postadress
                </Button>
              </Stack>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Stack
                spacing={2}
                component="form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void perform(async () => {
                    const validation = passwordValidation(password, confirmation);
                    if (validation) throw new Error(validation);
                    const { error } = await supabase!.auth.updateUser({ password });
                    if (error)
                      throw new Error(
                        "Lösenordet kunde inte ändras. Du kan behöva logga in igen eller använda Glömt lösenord.",
                      );
                    setPassword("");
                    setConfirmation("");
                  }, "Ditt lösenord är ändrat.");
                }}
              >
                <Typography variant="h2">Byt lösenord</Typography>
                <PasswordField
                  label="Nytt lösenord"
                  value={password}
                  onChange={setPassword}
                  autoComplete="new-password"
                  disabled={busy || app.demo}
                  helperText="Minst 8 tecken. Använd gärna en lång, unik lösenfras."
                />
                <PasswordField
                  label="Bekräfta lösenord"
                  value={confirmation}
                  onChange={setConfirmation}
                  autoComplete="new-password"
                  disabled={busy || app.demo}
                />
                <Button type="submit" variant="outlined" disabled={busy || app.demo}>
                  Spara nytt lösenord
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </>
      )}
      {required && (
        <Button disabled={busy} onClick={() => void app.logout()}>
          Logga ut
        </Button>
      )}
    </Stack>
  );
}
