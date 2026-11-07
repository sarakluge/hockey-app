import { lazy, Suspense, useEffect, useState } from "react";
import {
  CalendarDays,
  UserRound,
  Info,
  Settings,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";
import {
  AppBar,
  Alert,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  CircularProgress,
  Container,
  IconButton,
  Paper,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import { useHockeyApp } from "./hooks/useHockeyApp";
import { formatDate } from "./lib/types";
import HockeyMark from "./components/HockeyMark";
import LoginPanel from "./components/LoginPanel";
import MatchesPage from "./pages/MatchesPage";
import MyShiftsPage from "./pages/MyShiftsPage";
const InfoPage = lazy(() => import("./pages/InfoPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));

const tabs = [
  { id: "matcher", label: "Matcher", title: "Hemmamatcher", Icon: CalendarDays },
  { id: "mina", label: "Mina pass", title: "Mina pass", Icon: UserRound },
  { id: "instruktioner", label: "Info", title: "Info", Icon: Info },
];

function currentPage() {
  const hash = window.location.hash.slice(1);
  if (hash === "bemanning") return "matcher";
  return [...tabs.map((tab) => tab.id), "admin"].includes(hash) ? hash : "matcher";
}

export default function App() {
  const app = useHockeyApp();
  const [page, setPage] = useState(currentPage);
  const access = app.demo || app.profile?.approved;
  const title =
    page === "admin" ? "Administration" : tabs.find((tab) => tab.id === page)?.title;
  const latestSync = app.data.logs
    .filter((log) => log.success)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

  useEffect(() => {
    const updatePage = () => setPage(currentPage());
    window.addEventListener("hashchange", updatePage);
    return () => window.removeEventListener("hashchange", updatePage);
  }, []);

  return (
    <Box sx={{ minHeight: "100dvh", pb: "calc(96px + env(safe-area-inset-bottom))" }}>
      <Button href="#main-content" className="skip-link" variant="contained">
        Hoppa till innehåll
      </Button>
      <AppBar
        position="static"
        elevation={0}
        sx={{ bgcolor: "#0b2241", pt: "env(safe-area-inset-top)" }}
      >
        <Toolbar
          sx={{
            width: "100%",
            maxWidth: 1000,
            mx: "auto",
            minHeight: { xs: 112, sm: 128 },
            gap: 2,
          }}
        >
          {page === "admin" ? (
            <IconButton href="#matcher" aria-label="Till matcher" color="inherit">
              <ArrowLeft />
            </IconButton>
          ) : (
            <HockeyMark />
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ opacity: 0.85 }}>
              {app.team?.name || "U16F"} · {app.team?.home_team || "Team Söderort"}
            </Typography>
            <Typography variant="h1" sx={{ fontSize: { xs: "1.6rem", sm: "2rem" } }}>
              {title}
            </Typography>
          </Box>
          {access && app.admin && page !== "admin" && (
            <IconButton href="#admin" aria-label="Administration" color="inherit">
              <Settings />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>
      <Container
        component="main"
        id="main-content"
        tabIndex={-1}
        maxWidth={page === "admin" ? "md" : "sm"}
        sx={{ pt: 3 }}
      >
        <Stack spacing={2.5}>
          {app.demo && (
            <Alert severity="info" variant="outlined">
              Demo · Fiktiva matcher och familjer
            </Alert>
          )}
          {(app.message || app.error) && (
            <Alert
              severity={app.error ? "error" : "success"}
              role={app.error ? "alert" : "status"}
              onClose={() => {
                app.setError("");
                app.setMessage("");
              }}
            >
              {app.error || app.message}
            </Alert>
          )}
          {app.loading ? (
            <Stack spacing={2} role="status" sx={{ py: 6, alignItems: "center" }}>
              <CircularProgress aria-label="Hämtar laguppgifter" />
              <Typography>Hämtar ditt lag…</Typography>
            </Stack>
          ) : !access ? (
            <LoginPanel app={app} />
          ) : (
            <Suspense fallback={<CircularProgress aria-label="Hämtar sida" />}>
              {page === "matcher" && <MatchesPage app={app} />}
              {page === "mina" && <MyShiftsPage app={app} />}
              {page === "instruktioner" && <InfoPage app={app} />}
              {page === "admin" && <AdminPage app={app} />}
            </Suspense>
          )}
        </Stack>
        <Box component="footer" sx={{ textAlign: "center", py: 4 }}>
          <Typography variant="caption" color="text.secondary">
            {app.demo
              ? "Demodata · ingen automatisk synk"
              : latestSync
                ? `Senast uppdaterad ${formatDate(latestSync.created_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                : "Ingen lyckad synk ännu"}
          </Typography>
          {access && (
            <Box>
              <Button
                startIcon={<RefreshCw size={16} />}
                disabled={app.busy || app.loading}
                onClick={() =>
                  app.demo
                    ? app.notify("Demoläget visar fiktiva uppgifter.")
                    : void app.load()
                }
              >
                Uppdatera vy
              </Button>
            </Box>
          )}
        </Box>
      </Container>
      <Paper
        component="nav"
        aria-label="Huvudmeny"
        square
        elevation={3}
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: (theme) => theme.zIndex.appBar,
          pb: "env(safe-area-inset-bottom)",
        }}
      >
        <BottomNavigation
          showLabels
          value={page === "admin" ? false : page}
          sx={{ height: 72 }}
        >
          {tabs.map(({ id, label, Icon }) => (
            <BottomNavigationAction
              key={id}
              value={id}
              href={`#${id}`}
              label={label}
              icon={<Icon size={25} />}
              aria-current={page === id ? "page" : undefined}
            />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  );
}
