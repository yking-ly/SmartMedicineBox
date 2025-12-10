"use client";

import { ThemeProvider, CssBaseline, Container, Box, Typography } from "@mui/material";
import theme from "../lib/theme";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Box
            sx={{
              minHeight: "100vh",
              display: "flex",
              flexDirection: "column",
              bgcolor: "background.default",
              color: "text.primary",
            }}
          >
            {/* Header */}
            <Box
              component="header"
              sx={{
                bgcolor: "primary.main",
                py: 2,
                textAlign: "center",
              }}
            >
              <Typography variant="h5" sx={{ fontWeight: "bold", color: "white" }}>
                🏥 Smart Medicine Box - Caregiver Portal
              </Typography>
            </Box>

            {/* Main content */}
            <Container sx={{ flexGrow: 1, py: 4 }}>{children}</Container>

            {/* Footer */}
            <Box
              component="footer"
              sx={{
                textAlign: "center",
                py: 2,
                mt: "auto",
                bgcolor: "background.paper",
              }}
            >
              <Typography variant="body2" color="text.secondary">
                © {new Date().getFullYear()} Smart Medicine Box
              </Typography>
            </Box>
          </Box>
        </ThemeProvider>
      </body>
    </html>
  );
}
