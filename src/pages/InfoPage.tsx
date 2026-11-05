import { useState } from "react";
import { Users, FileText, CarFront, MapPin, Info, ChevronDown } from "lucide-react";
import type { HockeyApp } from "../hooks/useHockeyApp";
import PrivacyDialog from "../components/PrivacyDialog";

export default function InfoPage({ app }: { app: HockeyApp }) {
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const instructions = app.data.instructions;
  const arenas = [...new Set(app.data.matches.map((match) => match.arena))];
  const sections = [
    {
      title: "Sekretariatsrutiner",
      Icon: Users,
      content: (
        <>
          {instructions.length ? (
            instructions.map((instruction, index) => (
              <section className="guide-section" key={instruction.id || index}>
                <h3>{instruction.title}</h3>
                <p className="guide-arena">
                  {instruction.arena} · {instruction.role}
                </p>
                <p>{instruction.body}</p>
              </section>
            ))
          ) : (
            <p>Lagets administratör behöver lägga in de godkända instruktionerna.</p>
          )}
        </>
      ),
    },
    {
      title: "Lathund sekretariatet",
      Icon: FileText,
      content: (
        <>
          <p>Anteckningsmallen från Excel innehåller följande kolumner:</p>
          <ul>
            <li>Tid</li>
            <li>Spelarnummer och spelarnamn</li>
            <li>Händelse</li>
            <li>Lag</li>
          </ul>
          <p>Följ lagets godkända rutin för matchrapportering.</p>
        </>
      ),
    },
    {
      title: "Matchvärd",
      Icon: CarFront,
      content: (
        <>
          {instructions
            .filter((item) => item.role === "Matchvärd")
            .map((item, index) => (
              <p key={index}>{item.body}</p>
            ))}
          {!instructions.some((item) => item.role === "Matchvärd") && (
            <p>
              Kontakta lagledaren för matchvärdens uppgifter och samlingstid. Ingen
              särskild matchvärdsinstruktion fanns i arbetsboken.
            </p>
          )}
        </>
      ),
    },
    {
      title: "Arena",
      Icon: MapPin,
      content: (
        <>
          {arenas.length ? (
            arenas.map((arena) => <p key={arena}>{arena}</p>)
          ) : (
            <p>Arenorna visas när lagets matcher har hämtats.</p>
          )}
        </>
      ),
    },
    {
      title: "Kontakt & övrigt",
      Icon: Info,
      content: (
        <>
          <p>
            Har du frågor om ditt pass? Kontakta lagets administratör eller lagledare via
            lagets vanliga kontaktväg.
          </p>
          <button className="text-button" onClick={() => setPrivacyOpen(true)}>
            Integritet & personuppgifter
          </button>
          <button className="button secondary" onClick={() => void app.logout()}>
            Logga ut
          </button>
        </>
      ),
    },
  ];

  return (
    <>
      <div className="info-list">
        {sections.map(({ title, Icon, content }, index) => (
          <details
            className="info-card"
            key={title}
            open={index === 0 ? true : undefined}
          >
            <summary>
              <Icon size={27} />
              <h2>{title}</h2>
              <ChevronDown size={24} />
            </summary>
            <div className="info-body">{content}</div>
          </details>
        ))}
      </div>
      {privacyOpen && <PrivacyDialog onClose={() => setPrivacyOpen(false)} />}
    </>
  );
}
