import { useState, useEffect } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Select, MenuItem, FormControl, InputLabel, Stack, IconButton, Typography, Box } from "@mui/material";
import { DeleteOutline, AddCircleOutline } from "@mui/icons-material";

export default function ParameterModal({ open, onClose, parameters, onSave, columns = [] }) {
  const [paramsList, setParamsList] = useState(parameters || []);

  useEffect(() => {
    if (open) {
      setParamsList(parameters || []);
    }
  }, [open, parameters]);

  const handleAdd = () => {
    setParamsList([...paramsList, { name: "", type: "Date", defaultValue: "", column: "" }]);
  };

  const handleRemove = (index) => {
    setParamsList(paramsList.filter((_, i) => i !== index));
  };

  const handleChange = (index, field, val) => {
    const next = [...paramsList];
    next[index][field] = val;
    setParamsList(next);
  };

  const handleSave = () => {
    // filter out empty names
    const valid = paramsList.filter(p => p.name.trim() !== "");
    onSave(valid);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800, fontSize: 16, borderBottom: "1px solid #f0f0f0", pb: 1.5 }}>
        Manage Dashboard Parameters
      </DialogTitle>
      <DialogContent sx={{ pt: 2, display: "flex", flexDirection: "column", gap: 2, minHeight: 200 }}>
        <Typography fontSize={13} color="text.secondary" mb={1}>
          Parameters allow you to create dynamic variables (like Start Date and End Date) that can be used to filter multiple charts across the dashboard.
        </Typography>

        {paramsList.length === 0 ? (
          <Box sx={{ p: 3, textAlign: "center", background: "#f9f9f9", borderRadius: 2, border: "1px dashed #ccc" }}>
            <Typography fontSize={13} color="text.secondary">No parameters defined yet.</Typography>
          </Box>
        ) : (
          <Stack spacing={2}>
            {paramsList.map((p, i) => (
              <Stack direction="row" spacing={1} key={i} alignItems="center">
                <TextField
                  size="small"
                  label="Name (e.g. Start Date)"
                  value={p.name}
                  onChange={e => handleChange(i, "name", e.target.value)}
                  sx={{ flex: 2 }}
                />
                <FormControl size="small" sx={{ flex: 1 }}>
                  <InputLabel>Type</InputLabel>
                  <Select
                    label="Type"
                    value={p.type}
                    onChange={e => handleChange(i, "type", e.target.value)}
                  >
                    <MenuItem value="Date">Date</MenuItem>
                    <MenuItem value="Text">Text</MenuItem>
                    <MenuItem value="Number">Number</MenuItem>
                    <MenuItem value="Dataset Column">Dataset Column</MenuItem>
                  </Select>
                </FormControl>
                {p.type === "Dataset Column" ? (
                  <FormControl size="small" sx={{ flex: 1.5 }}>
                    <InputLabel>Column</InputLabel>
                    <Select
                      label="Column"
                      value={p.column || ""}
                      onChange={e => handleChange(i, "column", e.target.value)}
                    >
                      {columns.map(c => (
                        <MenuItem key={c} value={c}>{c}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : p.type === "Date" ? (
                  <input
                    type="date"
                    style={{ padding: "8px 12px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "14px", flex: 1.5 }}
                    value={p.defaultValue}
                    onChange={e => handleChange(i, "defaultValue", e.target.value)}
                  />
                ) : (
                  <TextField
                    size="small"
                    label="Default Value"
                    value={p.defaultValue}
                    onChange={e => handleChange(i, "defaultValue", e.target.value)}
                    sx={{ flex: 1.5 }}
                  />
                )}
                <IconButton color="error" onClick={() => handleRemove(i)}>
                  <DeleteOutline />
                </IconButton>
              </Stack>
            ))}
          </Stack>
        )}

        <Button
          startIcon={<AddCircleOutline />}
          variant="outlined"
          onClick={handleAdd}
          sx={{ mt: 1, alignSelf: "flex-start", borderRadius: 2, textTransform: "none", fontWeight: 700 }}
        >
          Add Parameter
        </Button>
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: "1px solid #f0f0f0" }}>
        <Button onClick={onClose} sx={{ fontWeight: 600 }}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" sx={{ background: "#6C63FF", "&:hover": { background: "#5a52d5" }, fontWeight: 700, borderRadius: 2 }}>
          Save Parameters
        </Button>
      </DialogActions>
    </Dialog>
  );
}
