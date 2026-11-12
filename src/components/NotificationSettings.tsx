import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import { Close, HelpOutlined } from "@mui/icons-material";
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
  const [helpOpen, setHelpOpen] = useState(false);
  const guideUrl = `${import.meta.env.BASE_URL}guides/notifications.png`;
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
          <Stack
            direction="row"
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Typography variant="h2">Notiser</Typography>
            <Tooltip title="Så aktiverar du notiser">
              <IconButton
                aria-label="Hjälp med notiser"
                onClick={() => setHelpOpen(true)}
              >
                <HelpOutlined />
              </IconButton>
            </Tooltip>
          </Stack>
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
      <Dialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        maxWidth="lg"
        fullWidth
        aria-labelledby="notification-help-title"
      >
        <DialogTitle id="notification-help-title" sx={{ pr: 7 }}>
          Få notiser från Seket
          <IconButton
            aria-label="Stäng notishjälpen"
            onClick={() => setHelpOpen(false)}
            sx={{ position: "absolute", right: 8, top: 8 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: { xs: 1, sm: 2 } }}>
          <Stack spacing={2}>
            <Typography variant="body2">
              Lägg till Seket på hemskärmen, öppna appen därifrån och aktivera pushnotiser
              under Min profil. På iPhone och iPad använder du Dela-menyn i Safari, på
              Android menyn med tre prickar i Chrome.
            </Typography>
            <Box
              component="img"
              src={guideUrl}
              alt="Bildguide för iPhone, iPad och Android: öppna webbläsarens meny, välj Lägg till på hemskärmen och aktivera Pushnotiser på den här enheten i Seket."
              sx={{ display: "block", width: "100%", height: "auto", borderRadius: 2 }}
            />
            <Typography variant="body2">
              På datorn kan du aktivera notiser direkt i webbläsaren. Tillåt även notiser
              för webbläsaren i datorns inställningar. Inställningen gäller varje enhet
              separat.
            </Typography>
            {needsHomeScreen() && (
              <Typography variant="body2">
                Öppna Seket från hemskärmen för att aktivera notiser på den här enheten.
              </Typography>
            )}
            {!supportsPush() && !needsHomeScreen() && (
              <Typography variant="body2">
                Den här webbläsaren stöder inte pushnotiser. Förfrågningar finns
                fortfarande under Mina pass.
              </Typography>
            )}
            {!pushPublicKey && (
              <Typography variant="body2">
                Pushnotiser är inte aktiverade för appen ännu.
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button href={guideUrl} target="_blank" rel="noopener noreferrer">
            Öppna bilden i full storlek
          </Button>
          <Button onClick={() => setHelpOpen(false)}>Stäng</Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
