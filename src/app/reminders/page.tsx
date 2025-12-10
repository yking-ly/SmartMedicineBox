"use client";

import { useEffect, useState } from "react";
import Grid from '@mui/material/Grid';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  OutlinedInput,
  Switch,
  IconButton,
  Snackbar,
  Alert,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Close";
import { getDatabase, ref, push, onValue, update, remove } from "firebase/database";
import { firebaseApp } from "@/lib/firebase";
import { useSearchParams } from "next/navigation";

type Reminder = {
  id: string;
  time: string; // "HH:MM"
  days: string[]; // ["Mon","Tue"...]
  medicine: string;
  repeatCount?: number;
  active?: boolean;
  createdAt?: string;
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function RemindersPage() {
  const db = getDatabase(firebaseApp);
  const searchParams = useSearchParams();
  const deviceId = searchParams.get("deviceId");

  // form state
  const [time, setTime] = useState("09:00");
  const [days, setDays] = useState<string[]>(["Mon", "Wed", "Fri"]);
  const [medicine, setMedicine] = useState("");
  const [repeatCount, setRepeatCount] = useState<number>(1);

  // list + edit
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // snackbar
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity?: "success" | "error" }>({
    open: false,
    message: "",
    severity: "success",
  });

  useEffect(() => {
    if (!deviceId) return;
    const remRef = ref(db, `reminders/${deviceId}`);
    const unsubscribe = onValue(remRef, (snapshot) => {
      if (!snapshot.exists()) {
        setReminders([]);
        return;
      }
      const data = snapshot.val();
      const arr: Reminder[] = Object.entries(data).map(([id, val]: any) => ({
        id,
        time: val.time || "09:00",
        days: val.days || [],
        medicine: val.medicine || "",
        repeatCount: val.repeatCount || 1,
        active: typeof val.active === "boolean" ? val.active : true,
        createdAt: val.createdAt || "",
      }));
      // sort by time then createdAt
      arr.sort((a, b) => (a.time > b.time ? 1 : a.time < b.time ? -1 : 0));
      setReminders(arr);
    });

    return () => unsubscribe();
  }, [db, deviceId]);

  const resetForm = () => {
    setTime("09:00");
    setDays(["Mon", "Wed", "Fri"]);
    setMedicine("");
    setRepeatCount(1);
    setEditingId(null);
  };

  const showSnackbar = (message: string, severity: "success" | "error" = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCreateOrSave = async () => {
    if (!deviceId) {
      showSnackbar("No device selected.", "error");
      return;
    }
    if (!medicine.trim()) {
      showSnackbar("Please enter medicine name.", "error");
      return;
    }
    if (!time) {
      showSnackbar("Please choose a time.", "error");
      return;
    }
    if (!days || days.length === 0) {
      showSnackbar("Please select at least one day.", "error");
      return;
    }

    try {
      const remRef = ref(db, `reminders/${deviceId}`);

      // If editing
      if (editingId) {
        await update(ref(db, `reminders/${deviceId}/${editingId}`), {
          time,
          days,
          medicine: medicine.trim(),
          repeatCount,
          active: true,
        });
        showSnackbar("Reminder updated.");
        resetForm();
        return;
      }

      // create new
      await push(remRef, {
        time,
        days,
        medicine: medicine.trim(),
        repeatCount,
        active: true,
        createdAt: new Date().toISOString(),
      });

      showSnackbar("Reminder created.");
      resetForm();
    } catch (err) {
      console.error("Create reminder error", err);
      showSnackbar("Failed to save reminder.", "error");
    }
  };

  const handleEdit = (r: Reminder) => {
    setEditingId(r.id);
    setTime(r.time);
    setDays(r.days);
    setMedicine(r.medicine);
    setRepeatCount(r.repeatCount || 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    if (!deviceId) return;
    try {
      await remove(ref(db, `reminders/${deviceId}/${id}`));
      showSnackbar("Reminder deleted.");
    } catch (err) {
      console.error("Delete reminder", err);
      showSnackbar("Failed to delete reminder.", "error");
    }
  };

  const toggleActive = async (r: Reminder) => {
    if (!deviceId) return;
    try {
      await update(ref(db, `reminders/${deviceId}/${r.id}`), { active: !r.active });
    } catch (err) {
      console.error("Toggle active error", err);
      showSnackbar("Failed to update reminder.", "error");
    }
  };

  return (
    <Box sx={{ mt: 5, px: 3 }}>
      <Typography variant="h4" gutterBottom>
        Reminders
      </Typography>

      {!deviceId && (
        <Typography color="error" sx={{ mb: 2 }}>
          No device selected. Open the dashboard and select a device to create reminders.
        </Typography>
      )}

      {/* Form */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                label="Time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <FormControl fullWidth>
                <InputLabel id="days-label">Days</InputLabel>
                <Select
                  labelId="days-label"
                  multiple
                  value={days}
                  onChange={(e) => setDays(typeof e.target.value === "string" ? e.target.value.split(",") : (e.target.value as string[]))}
                  input={<OutlinedInput label="Days" />}
                  renderValue={(selected) => (selected as string[]).join(", ")}
                >
                  {DAYS.map((d) => (
                    <MenuItem key={d} value={d}>
                      <Checkbox checked={days.indexOf(d) > -1} />
                      <ListItemText primary={d} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                label="Medicine"
                placeholder="Medicine name"
                value={medicine}
                onChange={(e) => setMedicine(e.target.value)}
                fullWidth
              />
            </Grid>

            <Grid size={{ xs: 12, md: 2 }} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <TextField
                label="Repeat"
                type="number"
                inputProps={{ min: 1 }}
                value={repeatCount}
                onChange={(e) => setRepeatCount(Math.max(1, parseInt(e.target.value || "1")))}
                size="small"
              />
              <Button variant="contained" onClick={handleCreateOrSave} disabled={!deviceId}>
                {editingId ? (
                  <>
                    <SaveIcon sx={{ mr: 1 }} />
                    Save
                  </>
                ) : (
                  "Create"
                )}
              </Button>
              {editingId && (
                <Button variant="outlined" color="inherit" onClick={resetForm}>
                  <CancelIcon />
                </Button>
              )}
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Reminders list */}
      <Typography variant="h6" gutterBottom>
        Scheduled Reminders
      </Typography>

      <Grid container spacing={2}>
        {reminders.length === 0 && (
          <Grid size={{ xs: 12 }}>
            <Typography color="text.secondary">No reminders yet.</Typography>
          </Grid>
        )}

        {reminders.map((r) => (
          <Grid size={{ xs: 12, md: 6 }} key={r.id}>
            <Card>
              <CardContent sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {r.medicine}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {r.time} — {r.days.join(", ")} — repeat {r.repeatCount || 1}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {r.createdAt ? `Created: ${new Date(r.createdAt).toLocaleString()}` : ""}
                  </Typography>
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography variant="body2" sx={{ mr: 1 }}>
                    Active
                  </Typography>
                  <Switch checked={Boolean(r.active)} onChange={() => toggleActive(r)} />
                  <IconButton size="small" color="primary" onClick={() => handleEdit(r)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => handleDelete(r.id)}>
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))} severity={snackbar.severity} sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
