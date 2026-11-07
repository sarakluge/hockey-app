import { Box } from "@mui/material";
export default function HockeyMark() {
  return (
    <Box
      component="svg"
      sx={{
        width: "48px",
        height: "54px",
        "@media (max-width: 360px)": { width: "36px", height: "44px" },
      }}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M13 7 44 51H56L60 56 54 60H42L9 10M51 7 20 51H8L4 56 10 60H22L55 10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <ellipse cx="32" cy="43" rx="7" ry="3" fill="currentColor" />
    </Box>
  );
}
