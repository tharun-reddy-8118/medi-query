import { createTheme } from "@mui/material";

export const getTheme = (brandColor = "#6C63FF", fontFam = "'Nunito', sans-serif") => createTheme({
  palette: {
    mode: "light",
    primary:    { main: brandColor, light: "#9B94FF", dark: "#4A42D6", contrastText: "#fff" },
    secondary:  { main: "#FF6B6B", light: "#FF9B9B", dark: "#CC4444", contrastText: "#fff" },
    success:    { main: "#00C9A7", light: "#5EEBD2", dark: "#009980" },
    warning:    { main: "#FFB830", light: "#FFD080", dark: "#CC9200" },
    background: { default: "#F4F2FF", paper: "#FFFFFF" },
    text:       { primary: "#1E1B4B", secondary: "#6B7280" },
  },
  typography: {
    fontFamily: fontFam,
    h4: { fontWeight: 800 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
    button: { fontFamily: fontFam, fontWeight: 700, textTransform: "none" },
  },
  shape: { borderRadius: 18 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 50, fontWeight: 700, fontSize: 14, padding: "9px 24px" },
        contained: {
          boxShadow: "0 6px 18px #e4c2c1",
          "&:hover": { boxShadow: "0 10px 26px #e4c2c1", transform: "translateY(-2px)" },
          transition: "all 0.2s",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 22,
          boxShadow: "0 3px 20px rgba(108,99,255,0.07)",
          border: "1.5px solid rgba(108,99,255,0.09)",
          transition: "transform 0.2s, box-shadow 0.2s",
          "&:hover": { transform: "translateY(-2px)", boxShadow: "0 10px 28px #e4c2c1" },
        },
      },
    },
    MuiChip:      { styleOverrides: { root: { fontWeight: 700, borderRadius: 50 } } },
    MuiTab:       { styleOverrides: { root: { fontWeight: 700, fontFamily: fontFam, textTransform: "none", fontSize: 14, minWidth: 110, minHeight: 60 } } },
    MuiTableCell: { styleOverrides: { head: { fontWeight: 800, fontFamily: fontFam, color: brandColor }, body: { fontFamily: fontFam } } },
    MuiSelect:    { styleOverrides: { root: { borderRadius: "14px !important", fontFamily: fontFam, fontWeight: 600 } } },
  },
});

