import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import type { HockeyApp } from "../hooks/useHockeyApp";
import { supabase } from "../lib/supabase";
import {
  disablePush,
  enablePush,
  isPushEnabled,
  needsHomeScreen,
  pushPublicKey,
  supportsPush,
} from "../lib/pushNotifications";

export default function NotificationSettings({ app }: { app: HockeyApp }) {
  const [loaded, setLoaded] = useState(false);
  const [retry, setRetry] = useState(0);
  const [push, setPush] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    if (app.demo || !supabase || !app.userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoaded(false);
    setError("");
    setMessage("");
    void (async () => {
      try {
        const enabled = await isPushEnabled(app.userId!);
        if (active) {
          setLoaded(true);
          setPush(enabled);
        }
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : "Inställningarna kunde inte hämtas.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [app.demo, app.userId, retry]);
  async function change(action: () => Promise<void>, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ändringen kunde inte sparas.");
    } finally {
      setBusy(false);
    }
  }
  const disabled = app.demo || loading || busy || !app.userId || !loaded;
  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h2">Notiser</Typography>
          <Typography>
            Få en förfrågan när det är din familjs tur att svara, och besked när ett pass
            har fått en ersättare.
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          {message && (
            <Alert severity="success" role="status">
              {message}
            </Alert>
          )}
          {app.demo && <Alert severity="info">Notiser skickas inte i demoläget.</Alert>}
          {!loaded && !app.demo && (
            <Typography variant="body2" color="text.secondary">
              {loading
                ? "Hämtar dina notisinställningar…"
                : "Dina notisinställningar kunde inte visas."}
            </Typography>
          )}
          {!loading && !loaded && !app.demo && (
            <Button variant="outlined" onClick={() => setRetry((value) => value + 1)}>
              Försök igen
            </Button>
          )}
          <Typography variant="body2">
            Pushnotiser gäller den här enheten. Du behöver aktivera dem på varje mobil
            eller dator du använder.
          </Typography>
          {needsHomeScreen() && (
            <Alert severity="info">
              På iPhone och iPad: välj Dela → Lägg till på hemskärmen. Öppna sedan appen
              från hemskärmen och aktivera notiser här.
            </Alert>
          )}
          {!supportsPush() && !needsHomeScreen() && (
            <Alert severity="info">
              Den här webbläsaren stöder inte pushnotiser. Förfrågningar visas fortfarande
              under Mina pass när du öppnar appen.
            </Alert>
          )}
          {!pushPublicKey && (
            <Alert severity="info">Pushnotiser är inte aktiverade för appen ännu.</Alert>
          )}
          <FormControlLabel
            label="Pushnotiser på den här enheten"
            control={
              <Switch
                checked={push}
                disabled={
                  disabled || !supportsPush() || needsHomeScreen() || !pushPublicKey
                }
                onChange={(_, checked) => {
                  void change(
                    async () => {
                      if (checked) await enablePush(app.userId!);
                      else await disablePush(app.userId!);
                      setPush(checked);
                    },
                    checked
                      ? "Pushnotiser är aktiverade på den här enheten."
                      : "Pushnotiser är avstängda på den här enheten.",
                  );
                }}
              />
            }
          />
        </Stack>
      </CardContent>
    </Card>
  );
}
