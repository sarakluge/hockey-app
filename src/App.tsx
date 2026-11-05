import { useEffect, useState } from "react";
import {
  CalendarDays,
  UserRound,
  Info,
  Settings,
  RefreshCw,
  ArrowLeft,
  X,
} from "lucide-react";
import { useHockeyApp } from "./hooks/useHockeyApp";
import { formatDate } from "./lib/types";
import HockeyMark from "./components/HockeyMark";
import LoginPanel from "./components/LoginPanel";
import MatchesPage from "./pages/MatchesPage";
import MyShiftsPage from "./pages/MyShiftsPage";
import InfoPage from "./pages/InfoPage";
import AdminPage from "./pages/AdminPage";

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
    .sort((first, second) => second.created_at.localeCompare(first.created_at))[0];

  useEffect(() => {
    const updatePage = () => setPage(currentPage());
    window.addEventListener("hashchange", updatePage);
    return () => window.removeEventListener("hashchange", updatePage);
  }, []);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          {page === "admin" ? (
            <a href="#matcher" className="header-back" aria-label="Till matcher">
              <ArrowLeft />
            </a>
          ) : (
            <HockeyMark />
          )}
          <div className="header-title">
            <p>
              U16F <span>· Team Söderort</span>
            </p>
            <h1>{title}</h1>
          </div>
          {access && app.admin && page !== "admin" && (
            <a className="header-action" href="#admin" aria-label="Administration">
              <Settings size={27} />
            </a>
          )}
        </div>
      </header>
      <main className={page === "admin" ? "main-content wide" : "main-content"}>
        {app.demo && <p className="demo-note">Demo · Fiktiva matcher och familjer</p>}
        {(app.message || app.error) && (
          <div
            role={app.error ? "alert" : "status"}
            className={`notice ${app.error ? "error" : ""}`}
          >
            <span>{app.error || app.message}</span>
            <button
              className="icon-button"
              aria-label="Stäng meddelande"
              onClick={() => {
                app.setError("");
                app.setMessage("");
              }}
            >
              <X size={18} />
            </button>
          </div>
        )}
        {app.loading ? (
          <p className="empty-state">Hämtar ditt lag…</p>
        ) : !access ? (
          <LoginPanel app={app} />
        ) : (
          <>
            {page === "matcher" && <MatchesPage app={app} />}
            {page === "mina" && <MyShiftsPage app={app} />}
            {page === "instruktioner" && <InfoPage app={app} />}
            {page === "admin" && <AdminPage app={app} />}
          </>
        )}
        <footer className="sync-status">
          {app.demo
            ? "Demodata · ingen automatisk synk"
            : latestSync
              ? `Senast uppdaterad ${formatDate(latestSync.created_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
              : "Ingen lyckad synk ännu"}
          {access && (
            <button
              className="text-button sync-refresh"
              aria-label="Uppdatera vy"
              disabled={app.busy || app.loading}
              onClick={() =>
                app.demo
                  ? app.notify("Demoläget visar fiktiva uppgifter.")
                  : void app.load()
              }
            >
              <RefreshCw size={16} />
            </button>
          )}
        </footer>
      </main>
      <nav className="bottom-nav" aria-label="Huvudmeny">
        {tabs.map(({ id, label, Icon }) => (
          <a
            key={id}
            href={`#${id}`}
            className={page === id ? "active" : ""}
            aria-current={page === id ? "page" : undefined}
          >
            <Icon size={27} />
            <span>{label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
