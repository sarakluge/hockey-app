import { useId, type ReactNode } from "react";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Chip,
  Paper,
  Typography,
} from "@mui/material";
import { ChevronDown } from "lucide-react";

export default function AdminPanel({
  children,
  title,
  summary,
  attention = false,
}: {
  children: ReactNode;
  title?: string;
  summary?: string;
  attention?: boolean;
}) {
  const id = useId();
  const contentStyles = {
    "& > h2": { fontSize: "1.25rem", margin: "0 0 16px" },
    "& > h3": { fontSize: "1rem", margin: "0 0 12px" },
    "& > p": { margin: "0 0 16px", lineHeight: "1.7" },
    "& > .MuiFormControlLabel-root": {
      display: "flex",
      marginTop: "12px",
      marginBottom: "16px",
    },
  };
  if (!title)
    return (
      <Paper
        component="section"
        variant="outlined"
        sx={{ ...contentStyles, p: { xs: 2, sm: 3 }, mb: 2 }}
      >
        {children}
      </Paper>
    );
  return (
    <Accordion
      slots={{ heading: "h2" }}
      sx={{ mb: 1.5, "& > .MuiAccordion-heading": { m: 0 } }}
    >
      <AccordionSummary
        expandIcon={<ChevronDown size={20} />}
        id={`${id}-summary`}
        aria-controls={`${id}-content`}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 1,
            minWidth: 0,
          }}
        >
          <Typography component="span" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          {summary && (
            <Chip
              label={summary}
              size="small"
              variant="outlined"
              color={attention ? "warning" : "default"}
            />
          )}
        </Box>
      </AccordionSummary>
      <AccordionDetails
        sx={{ ...contentStyles, p: { xs: 2, sm: 3 }, pt: { xs: 0, sm: 0 } }}
      >
        {children}
      </AccordionDetails>
    </Accordion>
  );
}
