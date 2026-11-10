import { LocationOnOutlined, InfoOutlined, ExpandMore } from "@mui/icons-material";
import { uniqueInstructionArenas } from "../lib/instructions";
import { Box } from "@mui/material";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  Typography,
} from "@mui/material";
import { useState } from "react";

import type { HockeyApp } from "../hooks/useHockeyApp";
import RoleInstructions from "../components/RoleInstructions";
import PrivacyDialog from "../components/PrivacyDialog";

export default function InfoPage({ app }: { app: HockeyApp }) {
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const arenas = uniqueInstructionArenas(app.data.matches.map((match) => match.arena));
  const sections = [
    {
      title: "Arena",
      Icon: LocationOnOutlined,
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
      Icon: InfoOutlined,
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
        <RoleInstructions instructions={app.data.instructions} arenas={arenas} />
        {sections.map(({ title, Icon, content }, index) => (
          <Accordion key={title} defaultExpanded={false}>
            <AccordionSummary
              expandIcon={<ExpandMore sx={{ fontSize: 22 }} />}
              id={`info-${index}-header`}
              aria-controls={`info-${index}-content`}
            >
              <Icon sx={{ fontSize: 25 }} color="inherit" />
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
