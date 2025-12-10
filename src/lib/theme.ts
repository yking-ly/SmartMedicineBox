// lib/theme.ts
"use client";
import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#00bfa5" },   // teal
    secondary: { main: "#2979ff" }, // blue
    background: {
      default: "#0d1b2a", // deep navy
      paper: "#1b263b",   // dark blue-gray
    },
    text: {
      primary: "#e0f7fa",
      secondary: "#b2dfdb",
    },
  },
  typography: { fontFamily: "Roboto, sans-serif" },
  shape: { borderRadius: 12 },
});

export default theme;
