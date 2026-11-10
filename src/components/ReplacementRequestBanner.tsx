import { VolunteerActivismOutlined } from "@mui/icons-material";
import { Box, Button, Typography } from "@mui/material";

import type { pendingReplacementRequests } from "../lib/replacementRequests";

type Requests = ReturnType<typeof pendingReplacementRequests>;
export default function ReplacementRequestBanner({
  requests,
  onDefer,
  onShow,
}: {
  requests: Requests;
  onDefer: () => void;
  onShow: () => void;
}) {
  if (!requests.length) return null;
  return (
    <Box
      component="section"
      aria-labelledby="replacement-banner-title"
      sx={{
        bgcolor: "#e3efff",
        color: "primary.main",
        borderBottom: "1px solid",
        borderColor: "primary.light",
      }}
    >
      <Box
        sx={{
          maxWidth: 1000,
          mx: "auto",
          px: { xs: 2, sm: 3 },
          py: 0.5,
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          columnGap: 2,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            flex: "1 1 220px",
            py: 0.5,
          }}
        >
          <VolunteerActivismOutlined sx={{ fontSize: 20 }} aria-hidden="true" />
          <Typography
            component="h2"
            id="replacement-banner-title"
            sx={{ fontSize: "0.875rem", fontWeight: 650 }}
          >
            {requests.length === 1
              ? "Du har en förfrågan om att ta över ett pass"
              : `Du har ${requests.length} förfrågningar om att ta över pass`}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, ml: "auto" }}>
          <Button
            size="small"
            href="#mina"
            onClick={onShow}
            sx={{ textDecoration: "underline", whiteSpace: "nowrap" }}
          >
            Visa {requests.length === 1 ? "förfrågan" : "förfrågningar"}
          </Button>
          <Button
            size="small"
            onClick={onDefer}
            title="Döljer påminnelsen under besöket utan att tacka nej"
            sx={{ fontWeight: 400, whiteSpace: "nowrap" }}
          >
            Påminn mig senare
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
