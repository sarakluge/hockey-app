import { Alert, Snackbar, useMediaQuery, useTheme } from "@mui/material";
import type { HockeyApp } from "../hooks/useHockeyApp";

export default function AppSnackbar({ app }: { app: HockeyApp }) {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("sm"));
  const text = app.error || app.message;

  function dismiss() {
    app.setError("");
    app.setMessage("");
  }

  return (
    <Snackbar
      key={`${app.error ? "error" : "success"}:${text}`}
      open={Boolean(text)}
      autoHideDuration={app.error ? 8000 : 5000}
      anchorOrigin={{ vertical: "bottom", horizontal: desktop ? "right" : "center" }}
      onClose={(_, reason) => {
        if (reason !== "clickaway") dismiss();
      }}
      sx={{ bottom: "calc(80px + env(safe-area-inset-bottom)) !important" }}
    >
      <Alert
        severity={app.error ? "error" : "success"}
        variant="filled"
        role={app.error ? "alert" : "status"}
        onClose={dismiss}
        sx={{ width: "100%", maxWidth: 480, boxShadow: 6 }}
      >
        {text}
      </Alert>
    </Snackbar>
  );
}
