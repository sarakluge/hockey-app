import {
  CalendarMonthOutlined,
  AssignmentOutlined,
  VerifiedUserOutlined,
} from "@mui/icons-material";
import AppSnackbar from "../components/AppSnackbar";
import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";

import type { HockeyApp } from "../hooks/useHockeyApp";
import { supabase } from "../lib/supabase";
import AuthForm from "../components/AuthForm";
import type { AuthMode } from "../components/AuthForm";
import HockeyMark from "../components/HockeyMark";

const headings = {
  login: ["Logga in", "Välkommen tillbaka. Här börjar nästa matchdag."],
  signup: ["Skapa ditt konto", "En egen inloggning till lagets gemensamma hemmaplan."],
  forgot: [
    "Glömt lösenord?",
    "Ange din e-postadress så hjälper vi dig att komma tillbaka.",
  ],
  reset: ["Välj ett nytt lösenord", "Spara ett nytt lösenord för ditt konto."],
};

export default function AuthPage({ app }: { app: HockeyApp }) {
  const [selectedMode, setSelectedMode] = useState<"login" | "signup" | "forgot">(
    "login",
  );
  const mode: AuthMode = app.recoveringPassword ? "reset" : selectedMode;
  const waiting = Boolean(app.profile && !app.profile.approved);
  const accountError = Boolean(app.userId && !app.profile && !app.recoveringPassword);
  const [heading, description] = headings[mode];

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr)",
        gridTemplateRows: "auto 1fr",
        "@media (min-width: 900px)": {
          gridTemplateColumns: "minmax(340px, 0.9fr) minmax(0, 1.1fr)",
          gridTemplateRows: "1fr",
        },
      }}
    >
      <Box
        component="header"
        sx={{
          color: "white",
          background: "#0b2241",
          padding: "28px 24px",
          "@media (min-width: 900px)": {
            padding: "48px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: "56px",
          },
        }}
      >
        <Stack spacing={1.5} sx={{ alignItems: "flex-start" }}>
          <HockeyMark />
          <Box>
            <Typography variant="body2" sx={{ color: "#c8d7e9" }}>
              Lagets gemensamma hemmaplan
            </Typography>
          </Box>
        </Stack>
        <Box sx={{ display: "none", "@media (min-width: 900px)": { display: "block" } }}>
          <Typography
            component="p"
            sx={{
              fontSize: { sm: "2.6rem", md: "3.3rem" },
              fontWeight: 750,
              lineHeight: 1.15,
              letterSpacing: "-0.04em",
              maxWidth: 450,
            }}
          >
            En bra matchdag
            <br />
            börjar tillsammans.
          </Typography>
          <Typography sx={{ color: "#c8d7e9", mt: 3, maxWidth: 380 }}>
            Matcher, arbetspass och allt du behöver inför din tur i sekretariatet.
          </Typography>
          <Stack spacing={2.5} sx={{ mt: 5 }}>
            {[
              { Icon: CalendarMonthOutlined, text: "Lagets hemmamatcher" },
              { Icon: AssignmentOutlined, text: "Dina pass på ett ställe" },
              { Icon: VerifiedUserOutlined, text: "Tillgång för godkända lagmedlemmar" },
            ].map(({ Icon, text }) => (
              <Stack direction="row" spacing={2} key={text} sx={{ alignItems: "center" }}>
                <Icon sx={{ fontSize: 21, color: "#99c9ff" }} />
                <Typography variant="body2">{text}</Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
        <Typography
          variant="caption"
          sx={{
            display: "none",
            "@media (min-width: 900px)": { display: "block" },
            color: "#c8d7e9",
          }}
        >
          Tillsammans för laget.
        </Typography>
      </Box>
      <Box
        component="main"
        sx={{
          display: "grid",
          placeItems: "center",
          padding: "32px 16px",
          minWidth: "0",
          "@media (min-width: 900px)": { padding: "48px" },
        }}
        id="main-content"
      >
        <Card sx={{ width: "100%", maxWidth: "480px" }}>
          <CardContent
            sx={{ p: { xs: 3, sm: 4 }, "&:last-child": { pb: { xs: 3, sm: 4 } } }}
          >
            <Stack spacing={3}>
              <Box>
                <Typography
                  variant="overline"
                  color="primary"
                  sx={{ letterSpacing: "0.14em", fontWeight: 700 }}
                >
                  VÄLKOMMEN TILL SEKET
                </Typography>
                <Typography variant="h1" sx={{ mt: 1 }}>
                  {waiting
                    ? "Inväntar godkännande"
                    : accountError
                      ? "Vi kunde inte öppna laget"
                      : heading}
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  {waiting
                    ? "Ditt konto är skapat. Lagets administratör behöver godkänna dig innan du får se lagets uppgifter."
                    : accountError
                      ? "Kontrollera anslutningen eller försök igen om en stund."
                      : description}
                </Typography>
              </Box>
              <AppSnackbar app={app} />
              {app.loading ? (
                <Stack role="status" sx={{ alignItems: "center", py: 3 }} spacing={2}>
                  <CircularProgress aria-label="Kontrollerar inloggning" />
                  <Typography color="text.secondary">
                    Kontrollerar din inloggning…
                  </Typography>
                </Stack>
              ) : waiting || accountError ? (
                <>
                  <Alert severity="info">
                    {waiting
                      ? "Ett nytt konto ger inte automatiskt åtkomst till lagets uppgifter."
                      : "Du är inloggad, men laguppgifterna kunde inte hämtas."}
                  </Alert>
                  <Button variant="contained" onClick={() => void app.load()}>
                    Kontrollera igen
                  </Button>
                  <Button onClick={() => void app.logout()}>Logga ut</Button>
                </>
              ) : app.recoveringPassword && !app.userId ? (
                <>
                  <Alert severity="warning">
                    Återställningslänken saknas, är ogiltig eller har gått ut. Begär en ny
                    länk för att fortsätta.
                  </Alert>
                  <Button
                    variant="contained"
                    onClick={() => {
                      app.cancelPasswordRecovery();
                      setSelectedMode("forgot");
                    }}
                  >
                    Begär ny återställningslänk
                  </Button>
                </>
              ) : (
                <>
                  {(mode === "login" || mode === "signup") && (
                    <Tabs
                      value={mode}
                      onChange={(_, value: "login" | "signup") => setSelectedMode(value)}
                      variant="fullWidth"
                      aria-label="Inloggning eller nytt konto"
                    >
                      <Tab value="login" label="Logga in" />
                      <Tab value="signup" label="Skapa konto" />
                    </Tabs>
                  )}
                  <AuthForm
                    key={mode}
                    mode={mode}
                    app={app}
                    onModeChange={setSelectedMode}
                  />
                  {!supabase && (
                    <>
                      <Divider />
                      <Alert severity="info">
                        Inloggningen är inte ansluten i den här lokala versionen.
                      </Alert>
                      <Button onClick={app.startDemo}>Utforska demoläget</Button>
                    </>
                  )}
                </>
              )}
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ textAlign: "center" }}
              >
                Endast godkända lagmedlemmar får tillgång till lagets uppgifter.
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
