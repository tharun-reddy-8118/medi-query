import React, { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Select, MenuItem, Typography, Stack,
  FormControl, InputLabel, TextField, CircularProgress,
  IconButton
} from "@mui/material";
import { Close, Schedule as ScheduleIcon } from "@mui/icons-material";
import axios from "axios";
import { API } from "../../constants";

const ScheduleModal = ({ open, onClose, fileId }) => {
  const [email, setEmail] = useState("");
  const [frequency, setFrequency] = useState("daily");
  const [time, setTime] = useState("08:00");
  const [day, setDay] = useState("mon");
  const [format, setFormat] = useState("KPI Summary");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSchedule = async () => {
    if (!email) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!time && frequency !== "minute") {
      setError("Please select a time.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await axios.post(`${API}/schedule`, {
        file_id: fileId,
        email: email,
        frequency: frequency,
        time: time,
        day: day,
        format: format
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || "Failed to schedule report.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography fontWeight={800} fontSize={18} display="flex" alignItems="center" gap={1}>
            <ScheduleIcon color="primary" /> Schedule Report
          </Typography>
          <IconButton onClick={onClose} size="small"><Close /></IconButton>
        </Stack>
      </DialogTitle>
      
      <DialogContent dividers>
        <Stack spacing={3} py={1}>
          <Typography fontSize={14} color="text.secondary">
            Configure automated delivery of your dashboard insights.
          </Typography>
          
          {error && <Typography color="error" fontSize={13} fontWeight={600}>{error}</Typography>}
          {success && <Typography color="success.main" fontSize={13} fontWeight={600}>Successfully Scheduled!</Typography>}

          <TextField 
            label="Recipient Email" 
            size="small" fullWidth 
            type="email"
            value={email} onChange={(e) => setEmail(e.target.value)} 
          />

          <Stack direction="row" spacing={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Format</InputLabel>
              <Select value={format} label="Format" onChange={(e) => setFormat(e.target.value)}>
                <MenuItem value="KPI Summary">KPI Text Summary</MenuItem>
                <MenuItem value="Dashboard PDF">Dashboard PDF</MenuItem>
                <MenuItem value="CSV Data">CSV Raw Data</MenuItem>
                <MenuItem value="Excel">Excel Spreadsheet</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Frequency</InputLabel>
              <Select value={frequency} label="Frequency" onChange={(e) => setFrequency(e.target.value)}>
                <MenuItem value="minute">Every Minute (Testing)</MenuItem>
                <MenuItem value="daily">Daily</MenuItem>
                <MenuItem value="weekly">Weekly</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          {frequency !== "minute" && (
            <Stack direction="row" spacing={2}>
              {frequency === "weekly" && (
                <FormControl fullWidth size="small">
                  <InputLabel>Day of Week</InputLabel>
                  <Select value={day} label="Day of Week" onChange={(e) => setDay(e.target.value)}>
                    <MenuItem value="mon">Monday</MenuItem>
                    <MenuItem value="tue">Tuesday</MenuItem>
                    <MenuItem value="wed">Wednesday</MenuItem>
                    <MenuItem value="thu">Thursday</MenuItem>
                    <MenuItem value="fri">Friday</MenuItem>
                    <MenuItem value="sat">Saturday</MenuItem>
                    <MenuItem value="sun">Sunday</MenuItem>
                  </Select>
                </FormControl>
              )}
              <TextField 
                label="Time of Day" 
                size="small" fullWidth 
                type="time"
                value={time} onChange={(e) => setTime(e.target.value)} 
                InputLabelProps={{ shrink: true }}
                inputProps={{ step: 300 }}
              />
            </Stack>
          )}

        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, background: "#f8f9fa" }}>
        <Button onClick={onClose} disabled={loading} color="inherit" sx={{ fontWeight: 700 }}>Cancel</Button>
        <Button 
          variant="contained" 
          onClick={handleSchedule} 
          disabled={loading || !email || success}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <ScheduleIcon />}
          sx={{ borderRadius: 2, fontWeight: 700, textTransform: "none" }}>
          {loading ? "Scheduling..." : success ? "Scheduled!" : "Create Schedule"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ScheduleModal;
