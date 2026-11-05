import { useState } from "react";
import { Mail } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function InviteUser({
  demo,
  onDone,
}: {
  demo: boolean;
  onDone: () => void;
}) {
  const [email, setEmail] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || demo) {
      setMessage("Inbjudningar skickas bara i den anslutna appen.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + import.meta.env.BASE_URL,
      },
    });
    setBusy(false);
    if (error) setMessage(error.message);
    else {
      setMessage("Engångslänk skickad. Kontot får åtkomst först efter ditt godkännande.");
      setEmail("");
      onDone();
    }
  }
  return (
    <form className="invite-form" onSubmit={invite}>
      <label htmlFor="invite-email">Bjud in förälder med engångslänk</label>
      <div className="action-row">
        <input
          id="invite-email"
          type="email"
          required
          placeholder="namn@exempel.se"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button className="button secondary" disabled={busy || demo}>
          <Mail size={16} />
          Skicka inbjudan
        </button>
      </div>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
