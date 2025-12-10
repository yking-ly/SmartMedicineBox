"use client";

import { useEffect, useState } from "react";
import { getDatabase, ref, onValue } from "firebase/database";
import { firebaseApp } from "../../lib/firebase";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";
import { useSearchParams } from "next/navigation";

export default function LogsPage() {
  const db = getDatabase(firebaseApp);
  const searchParams = useSearchParams();
  const deviceId = searchParams.get("deviceId");

  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    if (!deviceId) return;

    const logsRef = ref(db, "events/" + deviceId);
    const unsubscribe = onValue(
      logsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          // Convert object → array
          const logArray = Object.entries(data).map(([id, info]: any) => ({
            id,
            ...info,
          }));
          // Sort newest first
          logArray.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
          setLogs(logArray);
        } else {
          setLogs([]);
        }
      },
      (error: any) => {
        console.error("🔥 Error fetching logs:", error.code, error.message);
      }
    );

    return () => unsubscribe();
  }, [db, deviceId]);

  // ✅ Row color helper
  const getRowStyle = (type: string) => {
    switch (type) {
      case "Emergency":
        return { backgroundColor: "#f44336", color: "white" }; // red
      case "Medicine Taken":
        return { backgroundColor: "#4caf50", color: "white" }; // green
      default:
        return {};
    }
  };

  return (
    <Box sx={{ mt: 5, px: 3 }}>
      <Typography variant="h4" gutterBottom>
        Device Logs
      </Typography>
      <Typography variant="subtitle1" gutterBottom>
        Device ID: {deviceId}
      </Typography>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><b>Timestamp</b></TableCell>
              <TableCell><b>Event Type</b></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} align="center">
                  No logs found.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id} sx={getRowStyle(log.type)}>
                  <TableCell>{log.timestamp}</TableCell>
                  <TableCell>{log.type}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
