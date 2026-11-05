import { Mic, Timer, ClipboardList } from "lucide-react";
import type { HockeyApp } from "../hooks/useHockeyApp";
import MatchCard from "../components/MatchCard";

export default function MyShiftsPage({ app }: { app: HockeyApp }) {
  const matches = [...app.data.matches].sort((first, second) =>
    (first.starts_at || "9999").localeCompare(second.starts_at || "9999"),
  );
  const assignments = app.data.assignments.filter(
    (assignment) => assignment.family_id === app.ownFamily,
  );

  return (
    <div className="match-list">
      {!app.ownFamily && (
        <p className="notice">
          Administratören behöver koppla ditt konto till rätt familj.
        </p>
      )}
      {matches.map((match) => {
        const ownAssignments = assignments.filter(
          (assignment) => assignment.match_id === match.id,
        );
        if (!ownAssignments.length) return null;

        return (
          <MatchCard key={match.id} match={match} data={app.data} showStaffing={false}>
            {ownAssignments.map((assignment) => {
              const Icon =
                assignment.role === "Klockan"
                  ? Timer
                  : assignment.role === "Speaker/Musik"
                    ? Mic
                    : ClipboardList;
              return (
                <a className="my-task" href="#instruktioner" key={assignment.role}>
                  <Icon size={25} />
                  <strong>Min uppgift: {assignment.role}</strong>
                </a>
              );
            })}
          </MatchCard>
        );
      })}
      {!assignments.length && (
        <div className="empty-state">
          <ClipboardList />
          <h2>Inga tilldelade pass ännu</h2>
          <p>Dina uppgifter visas här när bemanningen är planerad.</p>
        </div>
      )}
    </div>
  );
}
