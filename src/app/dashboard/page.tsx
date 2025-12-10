"use client";

import { useEffect, useState } from "react";
// ⬇️ import update along with set
import { getDatabase, ref, onValue, update } from "firebase/database";
import { firebaseApp } from "../../lib/firebase";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  TextField,
  Snackbar,
  Alert,
} from "@mui/material";
import Link from "next/link";

export default function DashboardPage() {
  const db = getDatabase(firebaseApp);
  const [devices, setDevices] = useState<any>({});
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [renamingDevice, setRenamingDevice] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({
    open: false,
    message: "",
    severity: "success",
  });

  // ✅ Real-time listener for devices with error logging
  useEffect(() => {
    if (typeof window === "undefined") return;
    const devicesRef = ref(db, "devices");

    const unsubscribe = onValue(
      devicesRef,
      (snapshot) => {
        if (snapshot.exists()) {
          console.log("📡 Live devices update:", snapshot.val());
          setDevices(snapshot.val());
        } else {
          console.log("❌ No devices found.");
          setDevices({});
        }
      },
      (error: any) => {
        console.error("🔥 Firebase listener error:", error.code, error.message);
      }
    );

    return () => unsubscribe();
  }, [db]);

  const renameDevice = async (deviceId: string) => {
    if (!newName.trim()) return;
    try {
      // ⬇️ use update() instead of set()
      await update(ref(db, "devices/" + deviceId), { name: newName });

      setSnackbar({
        open: true,
        message: "Device renamed successfully ✅",
        severity: "success",
      });
    } catch (error: any) {
      console.error("Rename failed:", error.code, error.message);
      setSnackbar({
        open: true,
        message: "Failed to rename device ❌",
        severity: "error",
      });
    }
    setRenamingDevice(null);
    setNewName("");
  };

  return (
    <Box sx={{ mt: 5 }}>
      <Typography variant="h4" gutterBottom textAlign="center">
        Caregiver Dashboard
      </Typography>

      {/* Step 1: Show devices if none selected */}
      {!selectedDevice && (
        <Box>
          <Typography variant="h6" gutterBottom>
            Select a Device (Patient)
          </Typography>

          {/* ✅ Flexbox responsive cards */}
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 3,
              mt: 2,
            }}
          >
            {Object.entries(devices).map(([id, info]: any) => (
              <Card
                key={id}
                sx={{
                  width: 300,
                  "&:hover": { boxShadow: 6, transform: "translateY(-4px)" },
                  transition: "all 0.2s ease-in-out",
                }}
              >
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {info.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ID: {id}
                  </Typography>
                  <Typography variant="body2">
                    Last Seen: {info.lastSeen}
                  </Typography>

                  {/* Actions */}
                  <Box sx={{ mt: 2, display: "flex", gap: 1 }}>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => setSelectedDevice(id)}
                    >
                      Select
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setRenamingDevice(id)}
                    >
                      Rename
                    </Button>
                  </Box>

                  {/* Rename Input */}
                  {renamingDevice === id && (
                    <Box
                      sx={{
                        mt: 2,
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                      }}
                    >
                      <TextField
                        size="small"
                        label="New Name"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                      />
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => renameDevice(id)}
                      >
                        Save
                      </Button>
                      <Button
                        size="small"
                        onClick={() => setRenamingDevice(null)}
                      >
                        Cancel
                      </Button>
                    </Box>
                  )}
                </CardContent>
              </Card>
            ))}
          </Box>
        </Box>
      )}

      {/* Step 2: Show actions once a device is selected */}
      {selectedDevice && (
        <Box textAlign="center" sx={{ mt: 4 }}>
          <Typography variant="h6" gutterBottom>
            Selected Device: {devices[selectedDevice]?.name} ({selectedDevice})
          </Typography>

          <Box
            sx={{ display: "flex", justifyContent: "center", gap: 2, mt: 2, flexWrap: "wrap" }}
          >
            <Button
              variant="contained"
              color="primary"
              component={Link}
              href={`/logs?deviceId=${selectedDevice}`}
            >
              View Logs
            </Button>

            <Button
              variant="contained"
              color="secondary"
              component={Link}
              href={`/analyse?deviceId=${selectedDevice}`}
            >
              Analyse
            </Button>

            <Button
              variant="outlined"
              color="inherit"
              component={Link}
              href={`/messages?deviceId=${selectedDevice}`}
            >
              Send Message
            </Button>

            {/* NEW: Set Reminders */}
            <Button
              variant="contained"
              color="success"
              component={Link}
              href={`/reminders?deviceId=${selectedDevice}`}
            >
              Set Reminders
            </Button>
          </Box>

          <Button
            sx={{ mt: 3 }}
            variant="text"
            color="error"
            onClick={() => setSelectedDevice(null)}
          >
            ⬅ Back to Device List
          </Button>
        </Box>
      )}

      {/* Snackbar Notification */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
