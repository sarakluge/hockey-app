import { Box } from "@mui/material";
import { Button, TextField } from "@mui/material";
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
    <Box component="form" sx={{ margin: "20px 0" }} onSubmit={invite}>
      <Box
        sx={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          alignItems: "center",
          "& > .MuiFormControl-root": { flex: 1, minWidth: "170px" },
        }}
      >
        <TextField
          label="Bjud in förälder med engångslänk"
          id="invite-email"
          type="email"
          required
          placeholder="namn@exempel.se"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" variant="outlined" disabled={busy || demo}>
          <Mail size={16} />
          Skicka inbjudan
        </Button>
      </Box>
      {message && <p role="status">{message}</p>}
    </Box>
  );
}
