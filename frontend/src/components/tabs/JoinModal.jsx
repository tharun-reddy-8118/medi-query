import React, { useState, useEffect } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Select, MenuItem, Typography, Stack,
  FormControl, InputLabel, TextField, CircularProgress,
  IconButton
} from "@mui/material";
import { Close, Link as LinkIcon } from "@mui/icons-material";
import axios from "axios";
import { API } from "../../constants";

const JoinModal = ({ open, onClose, onLoad }) => {
  const [datasets, setDatasets] = useState([]);
  const [ds1, setDs1] = useState("");
  const [ds2, setDs2] = useState("");
  const [cols1, setCols1] = useState([]);
  const [cols2, setCols2] = useState([]);
  const [key1, setKey1] = useState("");
  const [key2, setKey2] = useState("");
  const [joinType, setJoinType] = useState("LEFT");
  const [alias, setAlias] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      fetchDatasets();
    } else {
      setDs1(""); setDs2(""); setKey1(""); setKey2("");
      setAlias(""); setError("");
    }
  }, [open]);

  const fetchDatasets = async () => {
    try {
      const { data } = await axios.get(`${API}/dashboards`);
      setDatasets(data.dashboards || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCols = async (fileId, isDs1) => {
    try {
      const { data } = await axios.get(`${API}/dashboards/${fileId}`);
      if (isDs1) {
        setCols1(data.columns || []);
        setKey1("");
      } else {
        setCols2(data.columns || []);
        setKey2("");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDs1Change = (v) => {
    setDs1(v);
    if (v) fetchCols(v, true);
  };

  const handleDs2Change = (v) => {
    setDs2(v);
    if (v) fetchCols(v, false);
  };

  const handleJoin = async () => {
    if (!ds1 || !ds2 || !key1 || !key2) {
      setError("Please select both datasets and their join columns.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.post(`${API}/join`, {
        file_id_1: ds1,
        file_id_2: ds2,
        join_key_1: key1,
        join_key_2: key2,
        join_type: joinType,
        alias: alias
      });
      onLoad(data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || "Failed to join datasets.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography fontWeight={800} fontSize={18} display="flex" alignItems="center" gap={1}>
            <LinkIcon color="primary" /> Join Datasets
          </Typography>
          <IconButton onClick={onClose} size="small"><Close /></IconButton>
        </Stack>
      </DialogTitle>
      
      <DialogContent dividers>
        <Stack spacing={3} py={1}>
          {error && <Typography color="error" fontSize={13} fontWeight={600}>{error}</Typography>}

          <Stack direction="row" spacing={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Dataset 1 (Base)</InputLabel>
              <Select value={ds1} label="Dataset 1 (Base)" onChange={(e) => handleDs1Change(e.target.value)}>
                {datasets.map(d => <MenuItem key={d.file_id} value={d.file_id}>{d.filename}</MenuItem>)}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Dataset 2 (To Join)</InputLabel>
              <Select value={ds2} label="Dataset 2 (To Join)" onChange={(e) => handleDs2Change(e.target.value)}>
                {datasets.map(d => <MenuItem key={d.file_id} value={d.file_id}>{d.filename}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>

          <Stack direction="row" spacing={2}>
            <FormControl fullWidth size="small" disabled={!ds1}>
              <InputLabel>Join Column 1</InputLabel>
              <Select value={key1} label="Join Column 1" onChange={(e) => setKey1(e.target.value)}>
                {cols1.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small" disabled={!ds2}>
              <InputLabel>Join Column 2</InputLabel>
              <Select value={key2} label="Join Column 2" onChange={(e) => setKey2(e.target.value)}>
                {cols2.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>

          <FormControl fullWidth size="small">
            <InputLabel>Join Type</InputLabel>
            <Select value={joinType} label="Join Type" onChange={(e) => setJoinType(e.target.value)}>
              <MenuItem value="LEFT">LEFT JOIN (Keep all from Dataset 1)</MenuItem>
              <MenuItem value="INNER">INNER JOIN (Only matching rows)</MenuItem>
              <MenuItem value="RIGHT">RIGHT JOIN (Keep all from Dataset 2)</MenuItem>
              <MenuItem value="FULL">FULL OUTER JOIN (Keep all rows)</MenuItem>
            </Select>
          </FormControl>

          <TextField 
            label="Joined Dataset Name (Optional)" 
            size="small" fullWidth 
            value={alias} onChange={(e) => setAlias(e.target.value)} 
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, background: "#f8f9fa" }}>
        <Button onClick={onClose} disabled={loading} color="inherit" sx={{ fontWeight: 700 }}>Cancel</Button>
        <Button 
          variant="contained" 
          onClick={handleJoin} 
          disabled={loading || !ds1 || !ds2 || !key1 || !key2}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <LinkIcon />}
          sx={{ borderRadius: 2, fontWeight: 700, textTransform: "none" }}>
          {loading ? "Joining..." : "Join & Load Dashboard"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default JoinModal;
