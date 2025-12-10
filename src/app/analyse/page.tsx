"use client";

import { useEffect, useState } from "react";
import { getDatabase, ref, onValue } from "firebase/database";
import { firebaseApp } from "../../lib/firebase";
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  CircularProgress,
} from "@mui/material";
import { useSearchParams } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
} from "recharts";
import AnalyseChat from "@/components/analyse/AnalyseChat";

type RawReminder = {
  id: string;
  medicine?: string;
  time?: string | number;
  days?: any;
  enabled?: boolean;
  active?: boolean;
  // other fields ignored
};

export default function AnalysePage() {
  const db = getDatabase(firebaseApp);
  const searchParams = useSearchParams();
  const deviceId = searchParams.get("deviceId");

  const [logs, setLogs] = useState<any[]>([]);
  const [reminders, setReminders] = useState<RawReminder[]>([]);
  const [eventFilter, setEventFilter] = useState("All");
  const [timeFilter, setTimeFilter] = useState("All");
  const [summary, setSummary] = useState("");
  const [loadingSummary, setLoadingSummary] = useState(false);

  useEffect(() => {
    if (!deviceId) return;

    const logsRef = ref(db, "events/" + deviceId);
    const unsubscribe = onValue(logsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const logArray = Object.entries(data).map(([id, info]: any) => ({
          id,
          ...info,
        }));
        logArray.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
        setLogs(logArray);
      } else {
        setLogs([]);
      }
    });

    return () => unsubscribe();
  }, [db, deviceId]);

  // ---------- NEW: read reminders from RTDB ----------
  useEffect(() => {
    if (!deviceId) return;

    const remRef = ref(db, "reminders/" + deviceId);
    const unsub = onValue(remRef, (snap) => {
      if (!snap.exists()) {
        setReminders([]);
        return;
      }
      const raw = snap.val();

      // raw can be a single reminder object or children keyed by id
      const out: RawReminder[] = [];

      // If the root contains fields like "medicine" or "time", treat it as single reminder
      if (
        typeof raw === "object" &&
        (raw.hasOwnProperty("medicine") || raw.hasOwnProperty("time") || raw.hasOwnProperty("days"))
      ) {
        out.push({ id: deviceId + "_root", ...raw });
      } else if (typeof raw === "object") {
        // treat children as reminders
        Object.entries(raw).forEach(([k, v]) => {
          if (v && typeof v === "object") {
            out.push({ id: k, ...(v as any) });
          }
        });
      }

      setReminders(out);
    });

    return () => unsub();
  }, [db, deviceId]);

  // ---------- Helpers to normalize reminder day spec ----------
  // Convert various 'days' formats into boolean array: days[0]=Sun..6=Sat
  function parseReminderDays(rawDays: any): boolean[] {
    const all = [true, true, true, true, true, true, true];
    if (rawDays == null) return all;

    // If it's array of numbers or strings
    if (Array.isArray(rawDays)) {
      const out = [false, false, false, false, false, false, false];
      rawDays.forEach((d) => {
        if (typeof d === "number") {
          if (d >= 0 && d <= 6) out[d] = true;
        } else if (typeof d === "string") {
          const s = d.trim().toLowerCase();
          if (!isNaN(Number(s))) {
            const n = Number(s);
            if (n >= 0 && n <= 6) out[n] = true;
          } else {
            if (s.startsWith("sun")) out[0] = true;
            else if (s.startsWith("mon")) out[1] = true;
            else if (s.startsWith("tue")) out[2] = true;
            else if (s.startsWith("wed")) out[3] = true;
            else if (s.startsWith("thu")) out[4] = true;
            else if (s.startsWith("fri")) out[5] = true;
            else if (s.startsWith("sat")) out[6] = true;
          }
        }
      });
      return out;
    }

    // If it's a string like "Mon,Wed" or "0,1,2"
    if (typeof rawDays === "string") {
      const out = [false, false, false, false, false, false, false];
      const tokens = rawDays.split(",").map((s) => s.trim());
      tokens.forEach((token) => {
        if (token.length === 0) return;
        if (!isNaN(Number(token))) {
          const n = Number(token);
          if (n >= 0 && n <= 6) out[n] = true;
        } else {
          const s = token.toLowerCase();
          if (s.startsWith("sun")) out[0] = true;
          else if (s.startsWith("mon")) out[1] = true;
          else if (s.startsWith("tue")) out[2] = true;
          else if (s.startsWith("wed")) out[3] = true;
          else if (s.startsWith("thu")) out[4] = true;
          else if (s.startsWith("fri")) out[5] = true;
          else if (s.startsWith("sat")) out[6] = true;
        }
      });
      return out;
    }

    // If it's object like days: {0:true,1:true,...}
    if (typeof rawDays === "object") {
      const out = [false, false, false, false, false, false, false];
      Object.entries(rawDays).forEach(([k, v]) => {
        const idx = Number(k);
        if (!isNaN(idx) && idx >= 0 && idx <= 6) out[idx] = Boolean(v);
      });
      return out;
    }

    // default: all days
    return all;
  }

  // parse time string "HH:MM" or numeric 1945 (->19:45)
  function parseReminderTime(timeVal: any) {
    if (timeVal == null) return { hour: -1, minute: -1 };
    if (typeof timeVal === "string") {
      const t = timeVal.trim();
      const colon = t.indexOf(":");
      if (colon >= 0) {
        const hh = Number(t.substring(0, colon));
        const mm = Number(t.substring(colon + 1));
        if (!isNaN(hh) && !isNaN(mm)) return { hour: hh, minute: mm };
      } else if (!isNaN(Number(t))) {
        const num = Number(t);
        return { hour: Math.floor(num / 100), minute: num % 100 };
      }
    } else if (typeof timeVal === "number") {
      const num = Math.floor(timeVal);
      return { hour: Math.floor(num / 100), minute: num % 100 };
    }
    return { hour: -1, minute: -1 };
  }

  // ✅ Helper: filter by time (same as yours)
  const filterByTime = (timestamp: string) => {
    if (timeFilter === "All") return true;
    const safeTimestamp = timestamp.replace(" ", "T");
    const eventDate = new Date(safeTimestamp);
    const now = new Date();

    if (timeFilter === "Day") return eventDate.toDateString() === now.toDateString();
    if (timeFilter === "Week") {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      return eventDate >= weekAgo && eventDate <= now;
    }
    if (timeFilter === "Month") {
      return (
        eventDate.getMonth() === now.getMonth() &&
        eventDate.getFullYear() === now.getFullYear()
      );
    }
    return true;
  };

  // ✅ Apply filters
  const filteredLogs = logs.filter((log) => {
    const matchesEvent = eventFilter === "All" ? true : log.type === eventFilter;
    const matchesTime = filterByTime(log.timestamp);
    return matchesEvent && matchesTime;
  });

  // ✅ Count stats
  const medicineCount = filteredLogs.filter((log) => log.type === "Medicine Taken").length;
  const emergencyCount = filteredLogs.filter((log) => log.type === "Emergency").length;

  // map reminders into normalized internal shape
const normalizedReminders = reminders.map((r) => {
  const days = parseReminderDays((r as any).days ?? (r as any).daysOfWeek ?? (r as any).daysArray);
  const { hour, minute } = parseReminderTime((r as any).time ?? (r as any).timeStr ?? (r as any).timeFormatted);

  // compute raw candidate (prefer explicit `enabled`, fall back to `active`, otherwise undefined)
  const rawEnabled = (r as any).enabled ?? (r as any).active;

  // normalize to boolean: if explicit boolean provided use it, otherwise if present coerce, else default true
  const enabled =
    typeof rawEnabled === "boolean" ? rawEnabled : (rawEnabled !== undefined ? Boolean(rawEnabled) : true);

  return {
    id: r.id,
    medicine: (r as any).medicine || "",
    hour,
    minute,
    days,
    enabled,
  };
});

  // ✅ Group by date for chart (and insert reminders count per date)
  const dailyData: Record<
    string,
    { medicine: number; emergency: number; reminders: number }
  > = {};
  filteredLogs.forEach((log) => {
    const safeTimestamp = log.timestamp.replace(" ", "T");
    const date = safeTimestamp.split("T")[0]; // YYYY-MM-DD
    if (!dailyData[date]) dailyData[date] = { medicine: 0, emergency: 0, reminders: 0 };
    if (log.type === "Medicine Taken") dailyData[date].medicine++;
    if (log.type === "Emergency") dailyData[date].emergency++;
  });

  // For each date in chart, compute number of reminders scheduled that weekday.
  // Note: if chart has no dates (no logs), optionally show upcoming 7 days? For now we only mark existing chart dates.
  Object.keys(dailyData).forEach((dateStr) => {
    const d = new Date(dateStr + "T00:00:00"); // construct date at UTC midnight local
    const weekday = d.getDay(); // 0..6
    // Count reminders that are enabled and have days[weekday] true
    const count = normalizedReminders.reduce((acc, rem) => {
      if (!rem.enabled) return acc;
      if (!rem.days || rem.days.length !== 7) return acc;
      return acc + (rem.days[weekday] ? 1 : 0);
    }, 0);
    dailyData[dateStr].reminders = count;
  });

  const chartData = Object.entries(dailyData)
    .map(([date, counts]) => ({
      date,
      Medicine: counts.medicine,
      Emergency: counts.emergency,
      Reminders: counts.reminders,
    }))
    // sort ascending by date so the chart X axis is chronological
    .sort((a, b) => (a.date > b.date ? 1 : -1));

  // ✅ AI Summary
  async function getAISummary(stats: any) {
    try {
      setLoadingSummary(true);
      setSummary("");
      const res = await fetch("/api/ai-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stats),
      });
      const data = await res.json();
      setSummary(data.summary);
    } catch (err) {
      console.error("AI summary error", err);
      setSummary("⚠️ Failed to fetch AI summary.");
    } finally {
      setLoadingSummary(false);
    }
  }

  // ✅ Stats object (used by both AI summary + chat)
  const stats = {
    timeRange: timeFilter,
    medicineTaken: medicineCount,
    emergencies: emergencyCount,
    dailyBreakdown: Object.entries(dailyData).map(([date, counts]) => ({
      date,
      ...counts,
    })),
    reminders: normalizedReminders,
    rawLogs: filteredLogs,
  };

  // Re-run summary when logs/reminders/filters change
  useEffect(() => {
    if (logs.length > 0 || reminders.length > 0) {
      getAISummary(stats);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, reminders, eventFilter, timeFilter]);

  return (
    <Box sx={{ mt: 5, px: 3 }}>
      <Typography variant="h4" gutterBottom>
        Analyse Logs
      </Typography>
      <Typography variant="subtitle1" gutterBottom>
        Device ID: {deviceId}
      </Typography>

      {/* Filters */}
      <Box sx={{ display: "flex", gap: 3, mt: 2 }}>
        <FormControl>
          <InputLabel>Event Type</InputLabel>
          <Select
            value={eventFilter}
            label="Event Type"
            onChange={(e) => setEventFilter(e.target.value)}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="All">All</MenuItem>
            <MenuItem value="Medicine Taken">Medicine Taken</MenuItem>
            <MenuItem value="Emergency">Emergency</MenuItem>
          </Select>
        </FormControl>

        <FormControl>
          <InputLabel>Time Range</InputLabel>
          <Select
            value={timeFilter}
            label="Time Range"
            onChange={(e) => setTimeFilter(e.target.value)}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="All">All</MenuItem>
            <MenuItem value="Day">Today</MenuItem>
            <MenuItem value="Week">This Week</MenuItem>
            <MenuItem value="Month">This Month</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Summary Cards */}
      <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 3, mt: 3 }}>
        <Card sx={{ flex: 1, bgcolor: "#4caf50", color: "white" }}>
          <CardContent>
            <Typography variant="h6">Medicine Taken</Typography>
            <Typography variant="h4">{medicineCount}</Typography>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1, bgcolor: "#f44336", color: "white" }}>
          <CardContent>
            <Typography variant="h6">Emergencies</Typography>
            <Typography variant="h4">{emergencyCount}</Typography>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1, bgcolor: "#2196f3", color: "white" }}>
          <CardContent>
            <Typography variant="h6">Scheduled Reminders</Typography>
            <Typography variant="h4">{normalizedReminders.filter((r) => r.enabled).length}</Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Chart */}
      <Box sx={{ mt: 5, height: 420 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="Medicine" fill="#4caf50" />
            <Bar dataKey="Emergency" fill="#f44336" />
            {/* Reminders as a line to compare scheduled reminders vs actual events */}
            <Line type="monotone" dataKey="Reminders" stroke="#2196f3" strokeWidth={2} dot={{ r: 4 }} />
          </BarChart>
        </ResponsiveContainer>
      </Box>

      {/* AI Summary */}
      <Box sx={{ mt: 5 }}>
        <Card sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            AI Summary
          </Typography>
          {loadingSummary ? <CircularProgress size={24} /> : <Typography>{summary}</Typography>}
        </Card>
      </Box>

      {/* AI Chat Assistant */}
      <Box sx={{ mt: 5 }}>
        <AnalyseChat stats={stats} />
      </Box>
    </Box>
  );
}
