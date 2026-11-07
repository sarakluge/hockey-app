import { Mail } from "lucide-react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { HockeyApp } from "../hooks/useHockeyApp";
import { supabase } from "../lib/supabase";

export default function LoginPanel({ app }: { app: HockeyApp }) {
  return (
    <Card>
      <CardContent>
        <Stack spacing={2.5}>
          <Typography variant="h2">Välkommen till laget</Typography>
          <Typography color="text.secondary">
            Logga in med din e-post för att se matcher och dina pass.
          </Typography>
          {app.userId ? (
            <>
              <Alert severity="info">
                Ditt konto väntar på administratörens godkännande.
              </Alert>
              <Button variant="outlined" onClick={() => void app.load()}>
                Kontrollera godkännande
              </Button>
            </>
          ) : supabase ? (
            <Stack component="form" onSubmit={app.login} spacing={2}>
              <TextField
                id="email"
                label="E-postadress"
                type="email"
                required
                autoComplete="email"
                value={app.email}
                onChange={(event) => app.setEmail(event.target.value)}
                fullWidth
              />
              <Button
                type="submit"
                variant="contained"
                disabled={app.busy}
                startIcon={<Mail size={18} />}
              >
                Skicka engångslänk
              </Button>
            </Stack>
          ) : (
            <Alert severity="info">
              Supabase är inte anslutet. Du kan utforska appen med fiktiva uppgifter.
            </Alert>
          )}
          <Button onClick={app.startDemo}>Utforska demoläget</Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
