import { useState, useEffect } from "react";
import axios from "axios";
import {
  Stack, Typography, Paper, Grid, Button, CircularProgress,
  Box, IconButton, Chip, Alert, Card, CardContent, CardActionArea, Avatar,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField
} from "@mui/material";
import {
  Dashboard, Add, Description, Storage, AccessTime, FileUpload, DeleteOutline, Edit
} from "@mui/icons-material";
import { API } from "../constants";
import BlobBg from "./BlobBg";

const R = "#c52626";
const GR = "#449042";

const DashboardsList = ({ currentUser, onSelectDashboard, onNew }) => {
  const isAdmin = currentUser?.role === "admin";
  const [dashboards, setDashboards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameId, setRenameId] = useState("");
  const [renameVal, setRenameVal] = useState("");
  const [renameLoading, setRenameLoading] = useState(false);

  useEffect(() => {
    const fetchDashboards = async () => {
      try {
        const { data } = await axios.get(`${API}/dashboards`);
        setDashboards(data.dashboards || []);
      } catch (e) {
        setError("Failed to load your dashboards.");
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboards();
  }, []);

  const handleSelect = async (file_id) => {
    try {
      const { data } = await axios.get(`${API}/dashboards/${file_id}`);
      onSelectDashboard(data);
    } catch (e) {
      alert("Failed to load dashboard data. It may have expired.");
    }
  };

  const handleDelete = async (e, file_id) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this dashboard? This cannot be undone.")) return;
    try {
      await axios.delete(`${API}/dashboards/${file_id}`);
      setDashboards(dashboards.filter(d => d.file_id !== file_id));
    } catch (err) {
      alert("Failed to delete dashboard.");
    }
  };

  const openRename = (e, dash) => {
    e.stopPropagation();
    setRenameId(dash.file_id);
    setRenameVal(dash.filename);
    setRenameOpen(true);
  };

  const handleRename = async () => {
    if (!renameVal.trim()) return;
    setRenameLoading(true);
    try {
      const { data } = await axios.put(`${API}/dashboards/${renameId}/rename`, { filename: renameVal });
      setDashboards(dashboards.map(d => d.file_id === renameId ? { ...d, filename: data.filename } : d));
      setRenameOpen(false);
    } catch (err) {
      alert("Failed to rename dashboard.");
    } finally {
      setRenameLoading(false);
    }
  };

  const formatDate = (ds) => {
    if (!ds) return "Unknown Date";
    try {
      return new Date(ds).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric"
      });
    } catch {
      return "Unknown Date";
    }
  };

  return (
    <Stack sx={{ minHeight: "100vh", position: "relative", overflow: "hidden", p: { xs: 2, md: 6 } }}>
      <BlobBg />

      <Stack spacing={4} sx={{ position: "relative", zIndex: 1, maxWidth: 1200, width: "100%", mx: "auto" }}>

        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
          <Stack>
            <Typography variant="h4" fontWeight={900} sx={{ color: "text.primary", letterSpacing: "-0.5px" }}>
              Your Dashboards
            </Typography>
            <Typography color="text.secondary" fontSize={15}>
              Select a previously analyzed dataset to resume your work.
            </Typography>
          </Stack>

          {isAdmin && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={onNew}
              sx={{
                background: `linear-gradient(135deg, ${R}, #e05555)`,
                boxShadow: `0 8px 24px ${R}40`,
                borderRadius: 3, px: 3, py: 1.2, fontWeight: 800, textTransform: "none",
                "&:hover": { background: `linear-gradient(135deg, #a01e1e, ${R})` }
              }}
            >
              Upload New Dataset
            </Button>
          )}
        </Stack>

        {error && <Alert severity="error" sx={{ borderRadius: 3 }}>{error}</Alert>}

        {loading ? (
          <Stack alignItems="center" justifyContent="center" py={10}>
            <CircularProgress sx={{ color: R }} />
          </Stack>
        ) : (
          <Grid container spacing={3}>
            {dashboards.length === 0 ? (
              <Grid item xs={12}>
                <Paper elevation={0} sx={{
                  p: 6, textAlign: "center", borderRadius: 4,
                  border: "2px dashed #e0e0e0", background: "rgba(255,255,255,0.5)"
                }}>
                  <FileUpload sx={{ fontSize: 64, color: "#ccc", mb: 2 }} />
                  <Typography variant="h6" fontWeight={800} color="text.secondary">No Dashboards Yet</Typography>
                  <Typography color="text.disabled" mb={3}>
                    {isAdmin ? "Upload your first dataset to get started." : "You haven't been assigned any dashboards yet."}
                  </Typography>
                  {isAdmin && (
                    <Button variant="outlined" onClick={onNew} sx={{ color: R, borderColor: R, borderRadius: 2 }}>
                      Upload Data
                    </Button>
                  )}
                </Paper>
              </Grid>
            ) : (
              dashboards.map((dash) => (
                <Grid item xs={12} sm={6} md={4} key={dash.file_id}>
                  <Card
                    elevation={0}
                    sx={{
                      borderRadius: 2, border: "1.5px solid #f0f0f0", transition: "all 0.2s",
                      background: "rgba(255,255,255,0.9)", backdropFilter: "blur(20px)",
                      "&:hover": { borderColor: R }
                    }}
                  >
                    <CardActionArea onClick={() => handleSelect(dash.file_id)} sx={{ p: 3 }}>
                      <Stack spacing={2.5}>
                        <Stack direction="row" alignItems="center" spacing={2}>
                          <Avatar sx={{ background: `${R}15`, color: R, width: 48, height: 48 }}>
                            <Dashboard />
                          </Avatar>
                          <Box sx={{ overflow: "hidden", flex: 1 }}>
                            <Typography fontWeight={800} fontSize={16} noWrap title={dash.filename}>
                              {dash.filename}
                            </Typography>
                            <Typography color="text.secondary" fontSize={12} sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
                              <AccessTime sx={{ fontSize: 14 }} /> {formatDate(dash.created_at)}
                            </Typography>
                          </Box>
                          {isAdmin && (
                            <Stack direction="row" spacing={0.5}>
                              <IconButton size="small" onClick={(e) => openRename(e, dash)} sx={{ color: "text.disabled", "&:hover": { color: "#1976d2", background: "#1976d210" } }}>
                                <Edit fontSize="small" />
                              </IconButton>
                              <IconButton size="small" onClick={(e) => handleDelete(e, dash.file_id)} sx={{ color: "text.disabled", "&:hover": { color: R, background: `${R}10` } }}>
                                <DeleteOutline fontSize="small" />
                              </IconButton>
                            </Stack>
                          )}
                        </Stack>

                        <Stack direction="row" gap={1}>
                          <Chip
                            icon={<Storage sx={{ fontSize: 14 }} />}
                            label={`${(dash.rows || 0).toLocaleString()} rows`}
                            size="small"
                            sx={{ background: "#f5f5f5", fontWeight: 600, fontSize: 11 }}
                          />
                          <Chip
                            icon={<Description sx={{ fontSize: 14 }} />}
                            label={dash.mode}
                            size="small"
                            sx={{ background: "#f5f5f5", fontWeight: 600, fontSize: 11, textTransform: "capitalize" }}
                          />
                        </Stack>
                      </Stack>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))
            )}
          </Grid>
        )}
      </Stack>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onClose={() => !renameLoading && setRenameOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Rename Dashboard</DialogTitle>
        <DialogContent dividers>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Dashboard Name"
            value={renameVal}
            onChange={(e) => setRenameVal(e.target.value)}
            disabled={renameLoading}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRenameOpen(false)} color="inherit" disabled={renameLoading} sx={{ textTransform: "none", fontWeight: 700 }}>
            Cancel
          </Button>
          <Button onClick={handleRename} variant="contained" disabled={renameLoading || !renameVal.trim()} sx={{ background: R, "&:hover": { background: "#a01e1e" }, textTransform: "none", fontWeight: 700 }}>
            {renameLoading ? <CircularProgress size={20} color="inherit" /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default DashboardsList;
