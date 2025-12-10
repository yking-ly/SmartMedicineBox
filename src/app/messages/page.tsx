"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getDatabase,
  ref,
  push,
  onValue,
  serverTimestamp,
} from "firebase/database";
import { firebaseApp } from "../../lib/firebase";
import {
  Box,
  Typography,
  TextField,
  Button,
  Snackbar,
  Alert,
  List,
  ListItem,
  ListItemText,
  Divider,
} from "@mui/material";

export default function MessagesPage() {
  const db = getDatabase(firebaseApp);
  const searchParams = useSearchParams();
  const deviceId = searchParams.get("deviceId");

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({
    open: false,
    message: "",
    severity: "success",
  });

  // ✅ Helper: detect Today / Yesterday / Date
  const formatDateGroup = (ts: number) => {
    const date = new Date(ts);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // ✅ Helper: format time nicely
  const formatTime = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ✅ Fetch messages in realtime
  useEffect(() => {
    if (!deviceId) return;

    const messagesRef = ref(db, `messages/${deviceId}`);
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list = Object.entries(data).map(([id, info]: any) => ({
          id,
          text: info.text,
          timestamp: info.timestamp ? new Date(info.timestamp).getTime() : null,
        }));
        // Sort newest first
        list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setMessages(list);
      } else {
        setMessages([]);
      }
    });

    return () => unsubscribe();
  }, [db, deviceId]);

  // ✅ Send message
  const sendMessage = async () => {
    if (!deviceId) {
      setSnackbar({
        open: true,
        message: "No device selected ❌",
        severity: "error",
      });
      return;
    }

    if (!message.trim()) {
      setSnackbar({
        open: true,
        message: "Message cannot be empty ❌",
        severity: "error",
      });
      return;
    }

    try {
      const messagesRef = ref(db, `messages/${deviceId}`);
      await push(messagesRef, {
        text: message.trim(),
        timestamp: serverTimestamp(), // ✅ Firebase server timestamp
      });

      setSnackbar({
        open: true,
        message: "Message sent successfully ✅",
        severity: "success",
      });
      setMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      setSnackbar({
        open: true,
        message: "Failed to send message ❌",
        severity: "error",
      });
    }
  };

  // ✅ Group messages by date
  const groupedMessages: Record<string, any[]> = {};
  messages.forEach((msg) => {
    const group = msg.timestamp ? formatDateGroup(msg.timestamp) : "Unknown";
    if (!groupedMessages[group]) groupedMessages[group] = [];
    groupedMessages[group].push(msg);
  });

  return (
    <Box sx={{ mt: 5, textAlign: "center" }}>
      <Typography variant="h4" gutterBottom>
        Send Message
      </Typography>
      <Typography variant="subtitle1" gutterBottom>
        Device: {deviceId || "Not selected"}
      </Typography>

      {/* Input box */}
      <Box sx={{ mt: 3, display: "flex", justifyContent: "center", gap: 2 }}>
        <TextField
          label="Message"
          variant="outlined"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          sx={{ width: 400 }}
        />
        <Button variant="contained" color="primary" onClick={sendMessage}>
          Send
        </Button>
      </Box>

      {/* Message history */}
      <Box sx={{ mt: 5, maxWidth: 600, mx: "auto" }}>
        <Typography variant="h6" gutterBottom>
          Message History
        </Typography>

        <List>
          {Object.entries(groupedMessages).map(([dateGroup, msgs]) => (
            <div key={dateGroup}>
              {/* Date header */}
              <Typography
                variant="subtitle2"
                sx={{
                  mt: 2,
                  mb: 1,
                  fontWeight: "bold",
                  color: "gray",
                  textAlign: "center",
                }}
              >
                {dateGroup}
              </Typography>
              <Divider />

              {/* Messages under this date */}
              {msgs.map((msg) => (
                <div key={msg.id}>
                  <ListItem>
                    <ListItemText
                      primary={msg.text}
                      secondary={msg.timestamp ? formatTime(msg.timestamp) : ""}
                    />
                  </ListItem>
                  <Divider />
                </div>
              ))}
            </div>
          ))}
        </List>
      </Box>

      {/* Snackbar Notifications */}
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
