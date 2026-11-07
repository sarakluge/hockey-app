import { Box } from "@mui/material";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  Typography,
} from "@mui/material";
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
              <Box
                component="section"
                sx={{
                  "& + section": {
                    paddingTop: "16px",
                    marginTop: "16px",
                    borderTop: "1px solid #dfe6ef",
                  },
                  "& h3": { fontSize: "1rem", margin: "0" },
                  "& > p:last-child": { whiteSpace: "pre-wrap" },
                }}
                key={instruction.id || index}
              >
                <h3>{instruction.title}</h3>
                <Box
                  component="p"
                  sx={{
                    color: "text.secondary",
                    fontSize: "0.8125rem",
                    "&&": { mt: "5px" },
                  }}
                >
                  {instruction.arena} · {instruction.role}
                </Box>
                <p>{instruction.body}</p>
              </Box>
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
          <Button onClick={() => setPrivacyOpen(true)}>
            Integritet & personuppgifter
          </Button>
          <Button variant="outlined" onClick={() => void app.logout()}>
            Logga ut
          </Button>
        </>
      ),
    },
  ];

  return (
    <>
      <Box sx={{ display: "grid", gap: "20px" }}>
        {sections.map(({ title, Icon, content }, index) => (
          <Accordion key={title} defaultExpanded={index === 0}>
            <AccordionSummary
              expandIcon={<ChevronDown size={22} />}
              id={`info-${index}-header`}
              aria-controls={`info-${index}-content`}
            >
              <Icon size={25} color="currentColor" />
              <Typography component="h2" variant="h2">
                {title}
              </Typography>
            </AccordionSummary>
            <AccordionDetails
              id={`info-${index}-content`}
              sx={{
                lineHeight: "1.7",
                "& p": { margin: "0 0 14px" },
                "& ul": { paddingLeft: "22px" },
                "& > button": { marginRight: "10px" },
              }}
            >
              {content}
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
      {privacyOpen && <PrivacyDialog onClose={() => setPrivacyOpen(false)} />}
    </>
  );
}
