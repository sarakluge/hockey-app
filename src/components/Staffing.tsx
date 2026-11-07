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
    <div className="staffing-list">
      {ROLES.map((role) => {
        const assignment = data.assignments.find(
          (item) => item.match_id === match.id && item.role === role,
        );
        const family = data.families.find((item) => item.id === assignment?.family_id);
        const Icon = roleIcons[role];

        return (
          <div className={`staffing-row ${family ? "" : "vacant"}`} key={role}>
            <Icon size={21} aria-hidden="true" />
            <span className="staffing-role">{role}</span>
            {onAssign ? (
              <SelectField
                label={role}
                value={family?.id || ""}
                disabled={busy}
                onChange={(event) => void onAssign(match.id, role, event.target.value)}
              >
                <option value="">Ej tillsatt</option>
                {data.families
                  .filter((item) => eligible(item, role))
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </SelectField>
            ) : (
              <span className="staffing-name">{family?.name || "Ej tillsatt"}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
