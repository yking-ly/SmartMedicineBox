"use client";

import { useState } from "react";
import {
  Box,
  TextField,
  Button,
  Typography,
  Card,
  CardContent,
  CircularProgress,
} from "@mui/material";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AnalyseChat({ stats }: { stats: any }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    const newMessage: Message = { role: "user", content: input };

    // update local chat with user message
    setMessages((prev) => [...prev, newMessage]);
    setInput("");
    setLoading(true);

    try {
      // ✅ add today's date into stats
      const todayDate = new Date().toISOString().split("T")[0];

      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, newMessage], // always an array
          stats: { ...stats, todayDate }, // inject today's date
        }),
      });

      const data = await res.json();

      if (data.reply) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "⚠️ No reply from AI." },
        ]);
      }
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ Chat request failed." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          💬 AI Assistant
        </Typography>

        {/* Chat messages */}
        <Box
          sx={{
            maxHeight: 300,
            overflowY: "auto",
            border: "1px solid #ddd",
            borderRadius: 2,
            p: 2,
            mb: 2,
            bgcolor: "#fafafa",
          }}
        >
          {messages.length === 0 && (
            <Typography color="text.secondary">
              Ask a question about this patient’s logs…
            </Typography>
          )}
          {messages.map((msg, i) => (
            <Box
              key={i}
              sx={{
                mb: 1.5,
                textAlign: msg.role === "user" ? "right" : "left",
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  display: "inline-block",
                  p: 1.2,
                  borderRadius: 2,
                  bgcolor: msg.role === "user" ? "#1976d2" : "#e0e0e0",
                  color: msg.role === "user" ? "white" : "black",
                  maxWidth: "70%",
                  wordWrap: "break-word",
                }}
              >
                {msg.content}
              </Typography>
            </Box>
          ))}
          {loading && (
            <Typography variant="body2" color="text.secondary">
              ⌛ AI is typing…
            </Typography>
          )}
        </Box>

        {/* Input + send button */}
        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField
            fullWidth
            size="small"
            label="Ask something..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button variant="contained" onClick={handleSend} disabled={loading}>
            {loading ? <CircularProgress size={20} /> : "Send"}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}
