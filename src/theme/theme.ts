import { createTheme } from "@mui/material/styles";
import { svSE } from "@mui/material/locale";

export const theme = createTheme(
  {
    palette: {
      primary: { main: "#0065cc", dark: "#004b99" },
      secondary: { main: "#5941b6" },
      background: { default: "#f5f7fb", paper: "#ffffff" },
      text: { primary: "#10223e", secondary: "#58677b" },
      warning: { main: "#8a5700" },
      success: { main: "#26714c" },
      divider: "#dfe6ef",
    },
    typography: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      h1: { fontSize: "1.8rem", fontWeight: 750, letterSpacing: "-0.04em" },
      h2: { fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.02em" },
      h3: { fontSize: "1rem", fontWeight: 700 },
      button: { textTransform: "none", fontWeight: 650 },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ":root": { fontSynthesis: "none" },
          html: { scrollbarGutter: "stable" },
          "a, button": { WebkitTapHighlightColor: "transparent" },
          ":focus-visible": { outline: "3px solid #0065cc", outlineOffset: 3 },
          "@media (prefers-reduced-motion: reduce)": {
            "*, *::before, *::after": {
              animationDuration: "0.01ms !important",
              transitionDuration: "0.01ms !important",
            },
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { minHeight: 44, gap: 8 } },
      },
      MuiIconButton: { styleOverrides: { root: { minWidth: 44, minHeight: 44 } } },
      MuiCard: {
        defaultProps: { variant: "outlined" },
        styleOverrides: { root: { borderRadius: 16 } },
      },
      MuiTextField: { defaultProps: { size: "small", variant: "outlined" } },
      MuiOutlinedInput: {
        styleOverrides: { root: { backgroundColor: "#fff", minHeight: 44 } },
      },
      MuiFormControlLabel: {
        styleOverrides: {
          root: { alignItems: "flex-start", marginLeft: -9 },
          label: { paddingTop: 9, fontSize: "0.875rem" },
        },
      },
      MuiAccordion: {
        defaultProps: { disableGutters: true, elevation: 0 },
        styleOverrides: {
          root: {
            border: "1px solid #dfe6ef",
            borderRadius: "12px !important",
            overflow: "hidden",
            "&::before": { display: "none" },
          },
        },
      },
      MuiAccordionSummary: {
        styleOverrides: {
          root: { minHeight: 64 },
          content: { alignItems: "center", gap: 12 },
        },
      },
      MuiTableCell: {
        styleOverrides: { head: { fontWeight: 700, background: "#f4f7fb" } },
      },
      MuiBottomNavigationAction: {
        styleOverrides: {
          root: { minHeight: 64, gap: 4 },
          label: { fontSize: "0.875rem", "&.Mui-selected": { fontSize: "0.875rem" } },
        },
      },
    },
  },
  svSE,
);
