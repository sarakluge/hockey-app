import { Alert, Box } from "@mui/material";
import SelectField from "./SelectField";
import { DoorOpen, Monitor, Mic, Timer, Users } from "lucide-react";
import { eligible, ROLES, type Data, type Match, type Role } from "../lib/types";

const roleIcons = {
  "Båsdörr 1": DoorOpen,
  "Båsdörr 2": DoorOpen,
  OVR: Monitor,
  Klockan: Timer,
  "Speaker/Musik": Mic,
  Matchvärd: Users,
};

interface StaffingProps {
  match: Match;
  data: Data;
  busy?: boolean;
  onAssign?: (matchId: string, role: Role, familyId: string) => Promise<void>;
}

export default function Staffing({ match, data, busy, onAssign }: StaffingProps) {
  return (
    <Box sx={{ display: "grid", gap: "6px", ...(onAssign ? { my: 2.5 } : {}) }}>
      {onAssign && data.unavailability.some((item) => item.match_id === match.id) && (
        <Alert severity="warning">
          Inte tillgängliga:{" "}
          {data.families
            .filter((family) =>
              data.unavailability.some(
                (item) => item.match_id === match.id && item.family_id === family.id,
              ),
            )
            .map((family) => family.name)
            .join(", ")}
          . Befintliga pass behöver ändras manuellt.
        </Alert>
      )}
      {ROLES.map((role) => {
        const assignment = data.assignments.find(
          (item) => item.match_id === match.id && item.role === role,
        );
        const family = data.families.find((item) => item.id === assignment?.family_id);
        const Icon = roleIcons[role];

        return (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "24px minmax(90px, 1fr) minmax(0, 1.3fr)",
              alignItems: "center",
              gap: "8px",
              fontSize: "0.875rem",
              minHeight: "34px",
              "& > svg": { color: "#28537e" },
              "@media (max-width: 400px)": {
                fontSize: "0.8125rem",
                gridTemplateColumns: "20px minmax(90px, 1fr) minmax(0, 1.2fr)",
                gap: "6px",
              },
              ...(onAssign
                ? {
                    gridTemplateColumns: "24px minmax(90px, 0.6fr) minmax(0, 1.4fr)",
                    "@media (max-width: 400px)": {
                      gridTemplateColumns: "20px 1fr",
                      fontSize: "0.8125rem",
                      gap: "6px",
                      "& > .MuiFormControl-root": { gridColumn: 2 },
                    },
                  }
                : {}),
            }}
            key={role}
          >
            <Icon size={21} aria-hidden="true" />
            <Box component="span" sx={{ fontWeight: "600" }}>
              {role}
            </Box>
            {onAssign ? (
              <SelectField
                label={role}
                value={family?.id || ""}
                disabled={
                  busy ||
                  !!assignment?.locked ||
                  match.status === "finished" ||
                  (!!match.starts_at && Date.parse(match.starts_at) <= Date.now())
                }
                onChange={(event) => void onAssign(match.id, role, event.target.value)}
              >
                <option value="">Ej tillsatt</option>
                {data.families
                  .filter((item) => eligible(item, role))
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                      {data.unavailability.some(
                        (entry) =>
                          entry.match_id === match.id && entry.family_id === item.id,
                      )
                        ? " – inte tillgänglig"
                        : ""}
                    </option>
                  ))}
              </SelectField>
            ) : (
              <Box
                component="span"
                sx={{
                  background: family ? "#f3f6fa" : "#fff8e8",
                  padding: "6px 8px",
                  borderRadius: "6px",
                  textAlign: "right",
                  overflowWrap: "anywhere",
                  color: family ? "text.primary" : "#885400",
                }}
              >
                {family?.name || "Ej tillsatt"}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
