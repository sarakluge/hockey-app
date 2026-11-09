import { useState } from "react";
import { Box, Button, IconButton } from "@mui/material";
import { Pencil } from "lucide-react";
import SelectField from "./SelectField";
import type { Family, Profile } from "../lib/types";

export default function UserApprovalCard({
  profile,
  families,
  busy,
  userId,
  onUpdate,
}: {
  profile: Profile;
  families: Family[];
  busy: boolean;
  userId: string | null;
  onUpdate: (id: string, patch: Partial<Profile>) => Promise<boolean | undefined>;
}) {
  const [editing, setEditing] = useState(false);
  const [player, setPlayer] = useState(profile.family_id || "");
  const [role, setRole] = useState<Profile["role"] | "">(
    profile.approved ? profile.role : "",
  );
  const editable = !profile.approved || editing;
  const valid =
    families.some((family) => family.id === player) &&
    (role === "PARENT" || role === "ADMIN");
  const name = profile.parent_name || profile.email;

  async function save() {
    if (!valid) return;
    if (
      await onUpdate(profile.id, {
        family_id: player,
        role: role as Profile["role"],
        approved: true,
      })
    )
      setEditing(false);
  }

  return (
    <Box
      sx={{
        p: 2,
        mb: 1.5,
        border: "1px solid",
        borderColor: profile.approved ? "divider" : "warning.main",
        borderRadius: 2,
        bgcolor: profile.approved ? "background.paper" : "#fff8e6",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Box sx={{ overflowWrap: "anywhere", minWidth: 0 }}>
          <strong>{name}</strong>
          {profile.parent_name && (
            <Box sx={{ fontSize: "0.875rem" }}>
              <strong>E-post:</strong> {profile.email}
            </Box>
          )}
          <Box sx={{ fontSize: "0.875rem" }}>
            <strong>Spelare:</strong>{" "}
            {families.find((family) => family.id === profile.family_id)?.name || "–"}
          </Box>
          <Box sx={{ fontSize: "0.875rem" }}>
            <strong>Roll:</strong>{" "}
            {profile.role === "ADMIN" ? "Administratör" : "Förälder"}
          </Box>
          {!profile.family_id && profile.child_name && (
            <div>Angivet barn vid registrering: {profile.child_name}</div>
          )}
        </Box>
        {profile.approved && !editing && (
          <IconButton
            aria-label={`Redigera ${name}`}
            disabled={busy}
            onClick={() => {
              setPlayer(profile.family_id || "");
              setRole(profile.role);
              setEditing(true);
            }}
          >
            <Pencil size={18} />
          </IconButton>
        )}
      </Box>
      {editable && (
        <Box
          component="form"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 1.5,
            alignItems: "center",
            mt: 2,
            "& > .MuiFormControl-root": { flex: 1, minWidth: 150 },
          }}
        >
          <SelectField
            label={`Spelare för ${name}`}
            required
            value={player}
            disabled={busy}
            onChange={(event) => setPlayer(event.target.value)}
          >
            <option value="" disabled>
              Välj spelare
            </option>
            {families.map((family) => (
              <option key={family.id} value={family.id}>
                {family.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            label={`Roll för ${name}`}
            required
            value={role}
            disabled={busy || profile.id === userId}
            onChange={(event) => setRole(event.target.value as Profile["role"])}
          >
            <option value="" disabled>
              Välj roll
            </option>
            <option value="PARENT">Förälder</option>
            <option value="ADMIN">Administratör</option>
          </SelectField>
          <Button
            type="submit"
            variant="contained"
            disabled={busy || !valid || (!profile.approved && profile.id === userId)}
          >
            {profile.approved ? "Spara" : "Godkänn"}
          </Button>
          {profile.approved && (
            <>
              <Button disabled={busy} onClick={() => setEditing(false)}>
                Avbryt
              </Button>
              <Button
                color="error"
                variant="outlined"
                disabled={busy || profile.id === userId}
                onClick={async () => {
                  if (await onUpdate(profile.id, { approved: false })) {
                    setRole("");
                    setEditing(false);
                  }
                }}
              >
                Återkalla
              </Button>
            </>
          )}
        </Box>
      )}
    </Box>
  );
}
