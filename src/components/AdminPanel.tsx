import { Paper } from "@mui/material";
import type { ReactNode } from "react";

export default function AdminPanel({ children }: { children: ReactNode }) {
  return (
    <Paper
      component="section"
      variant="outlined"
      sx={{
        padding: "24px",
        marginBottom: "20px",
        "& h2": { fontSize: "1.25rem", margin: "0 0 16px" },
        "& h3": { fontSize: "1rem", margin: "0 0 12px" },
        "& p": { margin: "0 0 16px", lineHeight: "1.7" },
        "& > .MuiFormControlLabel-root": {
          display: "flex",
          marginTop: "12px",
          marginBottom: "16px",
        },
        "@media (max-width: 400px)": { padding: "16px" },
      }}
    >
      {children}
    </Paper>
  );
}
