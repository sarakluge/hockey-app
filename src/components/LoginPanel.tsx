import { Mail, ShieldCheck } from "lucide-react";
import type { HockeyApp } from "../hooks/useHockeyApp";
import { supabase } from "../lib/supabase";

export default function LoginPanel({ app }: { app: HockeyApp }) {
  return (
    <section className="login-panel panel">
      <h2>Välkommen till laget</h2>
      <p>Logga in med din e-post för att se matcher och dina pass.</p>
      {app.userId ? (
        <>
          <p className="notice">
            <ShieldCheck />
            Ditt konto väntar på administratörens godkännande.
          </p>
          <button className="button secondary" onClick={() => void app.load()}>
            Kontrollera godkännande
          </button>
        </>
      ) : supabase ? (
        <form onSubmit={app.login}>
          <label htmlFor="email">E-postadress</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="namn@exempel.se"
            value={app.email}
            onChange={(event) => app.setEmail(event.target.value)}
          />
          <button className="button primary" disabled={app.busy}>
            <Mail size={18} />
            Skicka engångslänk
          </button>
        </form>
      ) : (
        <p>Supabase är inte anslutet. Du kan utforska appen med fiktiva uppgifter.</p>
      )}
      <button className="text-button" onClick={app.startDemo}>
        Utforska demoläget
      </button>
    </section>
  );
}
