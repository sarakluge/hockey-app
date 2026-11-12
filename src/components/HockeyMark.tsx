import { Box } from "@mui/material";

export default function HockeyMark() {
  return (
    <Box component="picture" sx={{ display: "block", flexShrink: 0 }}>
      <source
        media="(min-width: 900px)"
        srcSet={`${import.meta.env.BASE_URL}branding/seket-uppercase.svg`}
      />
      <Box
        component="img"
        src={`${import.meta.env.BASE_URL}branding/seket-symbol.svg`}
        alt="Seket"
        sx={{
          display: "block",
          width: { xs: 40, md: 160 },
          height: "auto",
          flexShrink: 0,
        }}
      />
    </Box>
  );
}
