import AppSnackbar from "./components/AppSnackbar";
import { lazy, Suspense, useEffect, useState } from "react";
import { CalendarDays, UserRound, Info, RefreshCw, ArrowLeft } from "lucide-react";
import {
  AppBar,
  Alert,
  Badge,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  CircularProgress,
  Container,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import { useHockeyApp } from "./hooks/useHockeyApp";
import { formatDate } from "./lib/types";
import { pendingReplacementRequests } from "./lib/replacementRequests";
import ReplacementRequestBanner from "./components/ReplacementRequestBanner";
import HockeyMark from "./components/HockeyMark";
import AuthPage from "./pages/AuthPage";
import MatchesPage from "./pages/MatchesPage";
import MyShiftsPage from "./pages/MyShiftsPage";
import ProfilePage from "./pages/ProfilePage";
const InfoPage = lazy(() => import("./pages/InfoPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));

const tabs = [
  { id: "matcher", label: "Matcher", title: "Hemmamatcher", Icon: CalendarDays },
  { id: "mina", label: "Mina pass", title: "Mina pass", Icon: UserRound },
  { id: "instruktioner", label: "Info", title: "Info", Icon: Info },
];

function currentPage() {
  const hash = window.location.hash.slice(1).split("?")[0];
  if (hash === "bemanning") return "matcher";
  return [...tabs.map((tab) => tab.id), "admin", "profil"].includes(hash)
    ? hash
    : "matcher";
}

export default function App() {
  const app = useHockeyApp();
  const [page, setPage] = useState(currentPage);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [showReplacementInbox, setShowReplacementInbox] = useState(false);
  const [deferredRequests, setDeferredRequests] = useState<string[]>([]);
  const [requestClock, setRequestClock] = useState(Date.now);
  const pendingRequests = pendingReplacementRequests(
    app.data,
    app.ownFamily,
    requestClock,
  );
  const visibleRequests = pendingRequests.filter(
    (request) => !deferredRequests.includes(request.key),
  );
  const family = app.data.families.find((f) => f.id === app.ownFamily);
  const needsRoles =
    !app.loading && !!family && !family.ovr_ok && !family.clock_ok && !family.speaker_ok;
  const access = app.demo || app.profile?.approved;
  const title = needsRoles
    ? "Välj familjens uppgifter"
    : page === "profil"
      ? "Min profil"
      : page === "admin"
        ? "Administration"
        : tabs.find((tab) => tab.id === page)?.title;
  const latestReplacementNotice = app.data.replacementNotifications
    .filter(
      (n) =>
        n.family_id === app.ownFamily &&
        !app.data.replacementSearches.some(
          (s) => s.id === n.search_id && s.status === "searching",
        ),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const latestSync = app.data.logs
    .filter((log) => log.success)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

  useEffect(() => {
    const updatePage = () => setPage(currentPage());
    window.addEventListener("hashchange", updatePage);
    return () => window.removeEventListener("hashchange", updatePage);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setRequestClock(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setDeferredRequests([]);
  }, [access, app.ownFamily, app.team?.id]);

  useEffect(() => {
    if (page !== "mina" || !showReplacementInbox || app.loading || needsRoles) return;
    const inbox = document.getElementById("replacement-inbox");
    if (inbox) {
      inbox.scrollIntoView({ block: "start" });
      inbox.focus({ preventScroll: true });
      setShowReplacementInbox(false);
    }
  }, [page, showReplacementInbox, app.loading, needsRoles]);

  if ((!access && !needsRoles) || app.recoveringPassword) {
    return <AuthPage app={app} />;
  }

  return (
    <Box sx={{ minHeight: "100dvh", pb: "calc(96px + env(safe-area-inset-bottom))" }}>
      <AppSnackbar app={app} />
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
          {!needsRoles && (page === "admin" || page === "profil") ? (
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
          <IconButton
            aria-label="Profilmeny"
            color="inherit"
            aria-controls={menuAnchor ? "profile-menu" : undefined}
            aria-haspopup="true"
            aria-expanded={!!menuAnchor}
            onClick={(e) => setMenuAnchor(e.currentTarget)}
          >
            <UserRound />
          </IconButton>
          <Menu
            id="profile-menu"
            anchorEl={menuAnchor}
            open={!!menuAnchor}
            onClose={() => setMenuAnchor(null)}
          >
            <MenuItem component="a" href="#profil" onClick={() => setMenuAnchor(null)}>
              Min profil
            </MenuItem>
            {app.admin && !needsRoles && (
              <MenuItem component="a" href="#admin" onClick={() => setMenuAnchor(null)}>
                Administration
              </MenuItem>
            )}
            <MenuItem
              onClick={() => {
                setMenuAnchor(null);
                void app.logout();
              }}
            >
              Logga ut
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      {!app.loading && !needsRoles && (
        <ReplacementRequestBanner
          requests={visibleRequests}
          onShow={() => setShowReplacementInbox(true)}
          onDefer={() =>
            setDeferredRequests((previous) => [
              ...previous,
              ...visibleRequests.map((request) => request.key),
            ])
          }
        />
      )}
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
          {page !== "mina" && latestReplacementNotice && (
            <Alert
              severity="info"
              action={
                <Button color="inherit" href="#mina">
                  Visa
                </Button>
              }
            >
              {latestReplacementNotice.message}
            </Alert>
          )}
          {app.loading ? (
            <Stack spacing={2} role="status" sx={{ py: 6, alignItems: "center" }}>
              <CircularProgress aria-label="Hämtar laguppgifter" />
              <Typography>Hämtar ditt lag…</Typography>
            </Stack>
          ) : (
            <Suspense fallback={<CircularProgress aria-label="Hämtar sida" />}>
              {needsRoles ? (
                <ProfilePage key={app.userId} app={app} required />
              ) : (
                <>
                  {page === "profil" && <ProfilePage app={app} />}
                  {page === "matcher" && <MatchesPage app={app} />}
                  {page === "mina" && <MyShiftsPage app={app} />}
                  {page === "instruktioner" && <InfoPage app={app} />}
                  {page === "admin" && <AdminPage app={app} />}
                </>
              )}
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
      {!needsRoles && (
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
            value={page === "admin" || page === "profil" ? false : page}
            sx={{ height: 72 }}
          >
            {tabs.map(({ id, label, Icon }) => (
              <BottomNavigationAction
                key={id}
                value={id}
                href={`#${id}`}
                label={label}
                icon={
                  id === "mina" ? (
                    <Badge badgeContent={pendingRequests.length} color="error">
                      <Icon size={25} />
                    </Badge>
                  ) : (
                    <Icon size={25} />
                  )
                }
                aria-label={
                  id === "mina" && pendingRequests.length
                    ? `Mina pass, ${pendingRequests.length} obesvarade förfrågningar`
                    : label
                }
                aria-current={page === id ? "page" : undefined}
              />
            ))}
          </BottomNavigation>
        </Paper>
      )}
    </Box>
  );
}
