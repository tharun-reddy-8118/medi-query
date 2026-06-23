import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Dialog, AppBar, Toolbar, Typography, IconButton, Button,
  Box, Stack, TextField, Select, MenuItem, CircularProgress,
  Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Alert
} from '@mui/material';
import { Close, MenuBook, Save, AutoFixHigh, AddBox, Functions, Code, Delete, Edit } from '@mui/icons-material';
import { API } from '../constants';

const CATEGORIES = ["Dimension", "Measure", "Date", "ID"];

export default function DictionaryModal({ open, onClose, fileId }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [definitions, setDefinitions] = useState([]);
  const [calcModalOpen, setCalcModalOpen] = useState(false);
  const [calcName, setCalcName] = useState("");
  const [calcExpr, setCalcExpr] = useState("");
  const [creatingCalc, setCreatingCalc] = useState(false);
  const [calcError, setCalcError] = useState(null);
  const [isEditingCalc, setIsEditingCalc] = useState(false);

  const loadDictionary = () => {
    setLoading(true);
    setError(null);
    axios.get(`${API}/dictionary/${fileId}`)
      .then(({ data }) => setDefinitions(data.definitions || []))
      .catch(err => setError("Failed to load dictionary: " + (err.response?.data?.detail || err.message)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (open && fileId) {
      loadDictionary();
    }
  }, [open, fileId]);

  const handleUpdate = (index, field, value) => {
    const newDefs = [...definitions];
    newDefs[index] = { ...newDefs[index], [field]: value };
    setDefinitions(newDefs);
  };

  const handleSave = () => {
    setSaving(true);
    setError(null);
    axios.post(`${API}/dictionary`, { file_id: fileId, definitions })
      .then(() => {
        onClose(); // Successfully saved, close modal
      })
      .catch(err => setError("Failed to save dictionary: " + (err.response?.data?.detail || err.message)))
      .finally(() => setSaving(false));
  };

  const handleCreateCalc = () => {
    if (!calcName.trim() || !calcExpr.trim()) {
      setCalcError("Name and Expression are required.");
      return;
    }
    setCreatingCalc(true);
    setCalcError(null);
    axios.post(`${API}/dictionary/${fileId}/calculated_field`, {
      file_id: fileId,
      col_name: calcName.trim(),
      expression: calcExpr.trim()
    })
      .then(() => {
        setCalcModalOpen(false);
        setCalcName("");
        setCalcExpr("");
        setIsEditingCalc(false);
        loadDictionary(); // Refresh list to show new column
      })
      .catch(err => setCalcError("Failed to save field: " + (err.response?.data?.detail || err.message)))
      .finally(() => setCreatingCalc(false));
  };

  const handleDeleteCalc = (colName) => {
    if (!window.confirm(`Are you sure you want to permanently delete the calculated field '${colName}'?`)) return;
    setLoading(true);
    axios.delete(`${API}/dictionary/${fileId}/calculated_field/${encodeURIComponent(colName)}`)
      .then(() => {
        loadDictionary();
      })
      .catch(err => {
        setError("Failed to delete calculated field: " + (err.response?.data?.detail || err.message));
        setLoading(false);
      });
  };

  return (
    <Dialog fullScreen open={open} onClose={onClose}>
      <AppBar sx={{ position: 'relative', background: "#1a1a2e" }} elevation={0}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={onClose}>
            <Close />
          </IconButton>
          <MenuBook sx={{ mr: 1.5, color: "#a78bfa" }} />
          <Typography sx={{ ml: 1, flex: 1, fontWeight: 800, letterSpacing: 0.5 }} variant="h6">
            Semantic Data Dictionary
          </Typography>
          <Button
            variant="outlined"
            onClick={() => {
              setCalcName("");
              setCalcExpr("");
              setIsEditingCalc(false);
              setCalcModalOpen(true);
            }}
            disabled={saving || loading}
            startIcon={<Functions />}
            sx={{ mr: 2, color: "#fff", borderColor: "rgba(255,255,255,0.5)", "&:hover": { borderColor: "#fff" } }}
          >
            Calculated Field
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || loading}
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <Save />}
            sx={{ background: "#4caf50", color: "#fff", fontWeight: 800, borderRadius: 2, "&:hover": { background: "#388e3c" } }}
          >
            {saving ? "Saving..." : "Save Dictionary"}
          </Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: { xs: 2, md: 4 }, background: "#f0f2f5", flex: 1, overflowY: "auto" }}>
        <Stack spacing={3} maxWidth={1200} mx="auto">
          
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: "1px solid #ddd", background: "linear-gradient(135deg, #fff, #f8f9fa)" }}>
            <Stack direction="row" alignItems="center" spacing={2} mb={1}>
              <AutoFixHigh sx={{ color: "#1565c0" }} />
              <Typography variant="h6" fontWeight={800} color="#1a1a2e">Train Your AI</Typography>
            </Stack>
            <Typography color="text.secondary" fontSize={14} fontWeight={600}>
              Provide business context to columns so the AI generates accurate, hallucination-free reports.
              Labels are used in charts, and Descriptions are read by the AI to understand complex business logic.
            </Typography>
          </Paper>

          {error && <Alert severity="error">{error}</Alert>}

          {loading ? (
            <Stack alignItems="center" py={10}><CircularProgress /></Stack>
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: "1px solid #e0e0e0" }}>
              <Table size="small">
                <TableHead sx={{ background: "#f5f5f5" }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800, color: "#555", width: "20%" }}>Raw Column</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: "#555", width: "25%" }}>Friendly Label</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: "#555", width: "40%" }}>Business Description</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: "#555", width: "15%" }}>Type</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {definitions.map((def, idx) => (
                    <TableRow key={def.col_name} hover sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                      <TableCell sx={{ fontWeight: 700, color: def.is_calculated ? "#8e24aa" : "#1a1a2e", fontFamily: "monospace", fontSize: 13 }}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          {def.is_calculated && <Functions fontSize="small" color="secondary" />}
                          <span>{def.col_name}</span>
                          {def.is_calculated && (
                            <Stack direction="row" spacing={0} ml={1}>
                              <IconButton size="small" sx={{ p: 0.5 }} onClick={() => {
                                setCalcName(def.col_name);
                                setCalcExpr(def.expression || "");
                                setIsEditingCalc(true);
                                setCalcModalOpen(true);
                              }}>
                                <Edit sx={{ fontSize: 16, color: "#8e24aa" }} />
                              </IconButton>
                              <IconButton size="small" sx={{ p: 0.5 }} onClick={() => handleDeleteCalc(def.col_name)}>
                                <Delete sx={{ fontSize: 16, color: "#d32f2f" }} />
                              </IconButton>
                            </Stack>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="E.g. Admission Date"
                          value={def.label}
                          onChange={(e) => handleUpdate(idx, "label", e.target.value)}
                          sx={{ background: "#fff" }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Explain what this means to the AI..."
                          value={def.description}
                          onChange={(e) => handleUpdate(idx, "description", e.target.value)}
                          sx={{ background: "#fff" }}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          size="small"
                          fullWidth
                          value={def.category}
                          onChange={(e) => handleUpdate(idx, "category", e.target.value)}
                          sx={{ background: "#fff", fontSize: 13, fontWeight: 700, 
                            color: def.category === "Measure" ? "#2e7d32" : def.category === "Dimension" ? "#1565c0" : "#d84315"
                          }}
                        >
                          {CATEGORIES.map(c => <MenuItem key={c} value={c} sx={{ fontSize: 13, fontWeight: 600 }}>{c}</MenuItem>)}
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

        </Stack>
      </Box>

      {/* Calculated Field Modal */}
      <Dialog open={calcModalOpen} onClose={() => !creatingCalc && setCalcModalOpen(false)} maxWidth="md" fullWidth>
        <AppBar position="relative" sx={{ background: "#8e24aa" }}>
          <Toolbar>
            <Functions sx={{ mr: 2 }} />
            <Typography variant="h6" sx={{ flex: 1, fontWeight: 800 }}>{isEditingCalc ? "Edit Calculated Field" : "Create Calculated Field"}</Typography>
            <IconButton color="inherit" onClick={() => setCalcModalOpen(false)} disabled={creatingCalc}><Close /></IconButton>
          </Toolbar>
        </AppBar>
        <Box p={3}>
          {calcError && <Alert severity="error" sx={{ mb: 2 }}>{calcError}</Alert>}
          <Typography variant="body2" color="text.secondary" mb={3}>
            Write a DuckDB SQL expression using existing columns. Example: <code>"Total Amount" * 0.1</code> or <code>date_diff('day', "Admission", "Discharge")</code>
          </Typography>
          <Stack spacing={3}>
            <TextField
              label="Field Name"
              placeholder="E.g. Length of Stay"
              value={calcName}
              onChange={e => setCalcName(e.target.value)}
              fullWidth
              disabled={creatingCalc || isEditingCalc}
            />
            <TextField
              label="SQL Expression"
              placeholder="E.g. date_diff('day', CAST(&quot;Admission Date&quot; AS DATE), CAST(&quot;Discharge Date&quot; AS DATE))"
              value={calcExpr}
              onChange={e => setCalcExpr(e.target.value)}
              multiline
              rows={4}
              fullWidth
              disabled={creatingCalc}
              InputProps={{
                startAdornment: <Code sx={{ color: "action.active", mr: 1, mt: -6 }} />
              }}
            />
            <Button
              variant="contained"
              size="large"
              disabled={creatingCalc || !calcName.trim() || !calcExpr.trim()}
              onClick={handleCreateCalc}
              sx={{ background: "#8e24aa", "&:hover": { background: "#6a1b9a" } }}
            >
              {creatingCalc ? "Saving..." : "Save Field"}
            </Button>
          </Stack>
        </Box>
      </Dialog>
    </Dialog>
  );
}
