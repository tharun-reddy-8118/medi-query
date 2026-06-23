import { useState, useRef, useCallback, useEffect } from "react";
import axios from "axios";
import {
  Stack, Typography, Paper, Button, TextField, IconButton,
  Avatar, Chip, Alert, CircularProgress, Box, Tooltip,
  FormControl, Select, MenuItem, InputLabel,
} from "@mui/material";
import {
  Psychology, AutoGraph, QueryStats, Lightbulb,
  MonitorHeart, CloudUpload, Upload, WarningAmberOutlined, AutoFixHigh, DeleteOutline, Cable, Link as LinkIcon
} from "@mui/icons-material";
import BlobBg from "./BlobBg";
import ConnectorModal from "./ConnectorModal";
import JoinModal from "./tabs/JoinModal";
import { API, G } from "../constants";

const R = "#c52626";
const GR = "#449042";

const DOC_TYPES = ["pdf", "docx"];

const pills = [
  { icon: <Psychology sx={{ fontSize: 18 }} />, label: "AI-Powered Q&A", c: "#6C63FF", bg: "#EEF0FF" },
  { icon: <AutoGraph sx={{ fontSize: 18 }} />, label: "Forecasting", c: R, bg: "#FFF0F0" },
  { icon: <QueryStats sx={{ fontSize: 18 }} />, label: "Revenue Insights", c: GR, bg: "#E8F5E9" },
  { icon: <Lightbulb sx={{ fontSize: 18 }} />, label: "Trend Analysis", c: "#FFB830", bg: "#FFF8E6" },
];

const FILE_TYPES = [
  { ext: "xlsx", color: "#1D6F42", bg: "#E8F5E9" },
  { ext: "xls", color: "#1D6F42", bg: "#E8F5E9" },
  // { ext: "csv",  color: "#0277BD", bg: "#E1F5FE" },
  { ext: "docx", color: "#1565C0", bg: "#E3F2FD" },
  { ext: "pdf", color: "#B71C1C", bg: "#FFEBEE" },
];

const UploadScreen = ({ onUpload }) => {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [docWarning, setDocWarning] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [connectorOpen, setConnectorOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [sheets, setSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [brandLogo, setBrandLogo] = useState("");
  const [brandColor, setBrandColor] = useState(R);
  const inputRef = useRef();

  useEffect(() => {
    const loadBrand = () => {
      setBrandLogo(localStorage.getItem("brand_logo") || "/logo_a.png");
      setBrandColor(localStorage.getItem("brand_color") || R);
    };
    loadBrand();
    window.addEventListener("brand_update", loadBrand);
    return () => window.removeEventListener("brand_update", loadBrand);
  }, []);

  // Auto-fetch sheets when an Excel file is selected
  useEffect(() => {
    if (!selectedFile) { setSheets([]); setSelectedSheet(""); return; }
    const ext = selectedFile.name.split(".").pop().toLowerCase();
    if (!["xlsx", "xls"].includes(ext)) { setSheets([]); setSelectedSheet(""); return; }

    const fetchSheets = async () => {
      setSheetsLoading(true);
      try {
        const form = new FormData();
        form.append("file", selectedFile);
        const { data } = await axios.post(`${API}/sheets`, form);
        const s = data.sheets || [];
        setSheets(s);
        setSelectedSheet(s.length > 0 ? s[0] : "");
      } catch { setSheets([]); setSelectedSheet(""); }
      finally { setSheetsLoading(false); }
    };
    fetchSheets();
  }, [selectedFile]);

  const handleUpload = async () => {
    if (!selectedFile) return;
    const ext = selectedFile.name.split(".").pop().toLowerCase();
    setDocWarning(DOC_TYPES.includes(ext));
    setLoading(true); setError(null);
    try {
      const form = new FormData();
      form.append("file", selectedFile);
      if (prompt.trim()) form.append("prompt", prompt.trim());
      if (selectedSheet) form.append("sheet_name", selectedSheet);
      const { data } = await axios.post(`${API}/upload`, form);
      if (data.is_mqdb && data.ui_config) {
        const lk = data.layout_key || data.file_id;
        for (const [key, val] of Object.entries(data.ui_config)) {
          if (key === "layouts") {
             for (const [mode, layoutObj] of Object.entries(val)) {
                 localStorage.setItem(`layouts_${lk}_${mode}`, JSON.stringify(layoutObj));
             }
          } else {
            localStorage.setItem(`${key}_${lk}`, JSON.stringify(val));
          }
        }
      }
      onUpload(data);
    } catch (e) {
      let errMsg = "Upload failed. Is the backend running?";
      if (e.response?.data?.detail) {
        errMsg = typeof e.response.data.detail === "string" ? e.response.data.detail : JSON.stringify(e.response.data.detail);
      } else if (e.response?.status === 429) {
        errMsg = "Too Many Requests (Rate limit exceeded). Please try again in a few moments.";
      } else if (e.message) {
        errMsg = e.message;
      }
      setError(errMsg);
    } finally { setLoading(false); }
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  }, []);

  return (
    <Stack alignItems="center" justifyContent="center"
      sx={{ minHeight: "100vh", background: G.page, p: { xs: 2, sm: 4 }, position: "relative", overflow: "hidden" }}>
      <BlobBg />

      <Stack spacing={4} alignItems="center"
        sx={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 540 }}>

        {/* Logo */}
        <Stack spacing={1.5} alignItems="center">
          <Box sx={{ background: "#fff", p: 1.5, borderRadius: 4, mb: 2, display: "inline-block", boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
            <img 
              src={brandLogo} 
              alt="Logo" 
              style={{ height: 45, objectFit: "contain" }} 
            />
          </Box>
          <Typography variant="h3" sx={{ color: "#b53a33", fontWeight: 900, letterSpacing: "-0.5px", fontFamily: "Nunito" }}>
            Medi<Box component="span" sx={{ color: GR }}>Query BI</Box>
          </Typography>
          <Typography color="text.secondary" fontSize={15} textAlign="center" lineHeight={1.6}>
            Your AI-powered hospital analytics companion 🏥
          </Typography>
        </Stack>

        {/* Drop zone */}
        {/* Content based on selection state */}
        {!selectedFile ? (
          <Paper elevation={0}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            sx={{
              width: "100%", p: { xs: 3.5, sm: 5 }, textAlign: "center",
              borderRadius: "28px", cursor: "pointer",
              border: `3px dashed ${dragging ? R : R + "80"}`,
              background: dragging ? "#FFF0F0" : "rgba(255,255,255,0.85)",
              backdropFilter: "blur(16px)", transition: "all 0.25s",
              "&:hover": { borderColor: R, background: "#FFF5F5" },
            }}>

            <input ref={inputRef} type="file"
              accept=".csv,.xlsx,.xls,.docx,.pdf,.mqdb"
              style={{ display: "none" }}
              onChange={e => { if (e.target.files[0]) setSelectedFile(e.target.files[0]) }} />

            <Stack spacing={2.5} alignItems="center">
              <Avatar sx={{
                width: 76, height: 76,
                background: dragging ? "linear-gradient(135deg,#c52626,#e05555)" : "#FFF5F5",
                border: `2px solid ${R}40`,
              }}>
                <CloudUpload sx={{ fontSize: 40, color: dragging ? "#fff" : R }} />
              </Avatar>

              <Stack spacing={1} alignItems="center">
                <Typography variant="h6" fontWeight={800}>
                  Drop your file here
                </Typography>
                <Stack direction="row" gap={0.8} flexWrap="wrap" justifyContent="center">
                  {FILE_TYPES.map(({ ext, color, bg }) => (
                    <Tooltip key={ext}
                      title={DOC_TYPES.includes(ext) ? "⚠️ Document text sent to AI — avoid PHI" : ""}
                      placement="top">
                      <Box sx={{
                        px: 1.2, py: 0.3, borderRadius: 1.5, background: bg,
                        border: `1px solid ${color}40`, fontSize: 11, fontWeight: 800,
                        color, fontFamily: "Nunito", letterSpacing: 0.5,
                        cursor: DOC_TYPES.includes(ext) ? "help" : "default",
                      }}>
                        .{ext}{DOC_TYPES.includes(ext) && <Box component="span" sx={{ ml: 0.4, fontSize: 9 }}>⚠️</Box>}
                      </Box>
                    </Tooltip>
                  ))}
                </Stack>
              </Stack>

              <Button variant="contained" startIcon={<Upload />} size="large"
                sx={{
                  background: `linear-gradient(135deg,${R},#e05555)`,
                  "&:hover": { background: `linear-gradient(135deg,#a01e1e,${R})` }
                }}>
                Choose File
              </Button>
            </Stack>
          </Paper>
        ) : (
          <Paper elevation={0} sx={{
            width: "100%", p: 4, borderRadius: "28px",
            background: "rgba(255,255,255,0.85)", backdropFilter: "blur(16px)"
          }}>
            <Stack spacing={3}>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ p: 2, border: `1px solid ${R}40`, borderRadius: 3, bgcolor: "#FFF5F5" }}>
                <Avatar sx={{ bgcolor: R, color: "#fff" }}><Upload /></Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={800} noWrap>{selectedFile.name}</Typography>
                  <Typography variant="body2" color="text.secondary">{(selectedFile.size / 1024).toFixed(1)} KB</Typography>
                </Box>
                {!loading && (
                  <IconButton onClick={() => setSelectedFile(null)}>
                    <DeleteOutline color="error" />
                  </IconButton>
                )}
              </Stack>

              {/* Sheet Selector — only for multi-sheet Excel */}
              {sheetsLoading && (
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 1 }}>
                  <CircularProgress size={18} sx={{ color: R }} />
                  <Typography fontSize={13} color="text.secondary" fontWeight={600}>Detecting sheets…</Typography>
                </Stack>
              )}
              {!sheetsLoading && sheets.length > 1 && (
                <FormControl fullWidth size="small">
                  <InputLabel sx={{ fontWeight: 700, "&.Mui-focused": { color: R } }}>Select Sheet</InputLabel>
                  <Select
                    value={selectedSheet}
                    label="Select Sheet"
                    onChange={(e) => setSelectedSheet(e.target.value)}
                    disabled={loading}
                    sx={{
                      borderRadius: 3, fontWeight: 700, bgcolor: "#fff",
                      "& fieldset": { borderColor: `${R}40` },
                      "&:hover fieldset": { borderColor: R },
                      "&.Mui-focused fieldset": { borderColor: `${R} !important` },
                    }}
                  >
                    {sheets.map((s) => (
                      <MenuItem key={s} value={s} sx={{ fontWeight: 600 }}>{s}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              <TextField
                fullWidth
                variant="outlined"
                placeholder="E.g. Focus on revenue and patient admissions."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={loading}
                multiline
                rows={2}
                InputProps={{
                  startAdornment: <AutoFixHigh sx={{ color: R, mr: 1.5, opacity: 0.7, alignSelf: "flex-start", mt: 1 }} />,
                  sx: { borderRadius: 3, bgcolor: "#fff", "& fieldset": { borderColor: `${R}40` }, "&:hover fieldset": { borderColor: R }, "&.Mui-focused fieldset": { borderColor: R } }
                }}
              />

              <Button
                variant="contained"
                size="large"
                fullWidth
                disabled={loading}
                onClick={handleUpload}
                sx={{
                  py: 1.5, fontSize: 16, fontWeight: 800, borderRadius: 3,
                  background: `linear-gradient(135deg,${R},#e05555)`,
                  "&:hover": { background: `linear-gradient(135deg,#a01e1e,${R})` }
                }}
              >
                {loading ? <CircularProgress size={26} sx={{ color: "#fff" }} /> : "Analyze Dashboard"}
              </Button>
            </Stack>
          </Paper>
        )}

        {/* Doc privacy warning — shown only after selecting pdf/docx */}
        {docWarning && (
          <Alert severity="warning" icon={<WarningAmberOutlined fontSize="small" />}
            sx={{
              width: "100%", borderRadius: 4,
              background: "#FFFDE7", border: "1.5px solid #F9A82540",
              "& .MuiAlert-icon": { color: "#F57F17" },
            }}>
            <Typography fontSize={13} fontWeight={700} color="#E65100" mb={0.3}>
              Document Privacy Notice
            </Typography>
            <Typography fontSize={12} color="#5D4037" lineHeight={1.6}>
              PDF and Word files are processed by an external AI service (Groq).
              The document text is sent to answer your questions.{" "}
              <strong>Do not upload files containing sensitive patient data,
                personally identifiable information, or confidential records.</strong>
            </Typography>
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ width: "100%", borderRadius: 4, fontWeight: 600 }}>
            {error}
          </Alert>
        )}

        {/* Feature pills */}
        <Stack direction="row" flexWrap="wrap" gap={1.5} justifyContent="center">
          {pills.map(({ icon, label, c, bg }) => (
            <Chip key={label}
              icon={<Box sx={{ color: `${c} !important`, display: "flex" }}>{icon}</Box>}
              label={label}
              sx={{
                background: bg, color: c, fontWeight: 700, fontSize: 13,
                border: `1.5px solid ${c}30`, "& .MuiChip-icon": { color: c }
              }}
            />
          ))}
        </Stack>

        {/* Database Connector Divider */}
        <Stack direction="row" alignItems="center" spacing={2} sx={{ width: "100%" }}>
          <Box sx={{ flex: 1, height: "1.5px", background: `${R}18` }} />
          <Typography fontSize={11} fontWeight={700} color="text.disabled"
            textTransform="uppercase" letterSpacing={1}>or connect live</Typography>
          <Box sx={{ flex: 1, height: "1.5px", background: `${R}18` }} />
        </Stack>

        <Stack direction="row" spacing={2} sx={{ width: "100%", maxWidth: 380 }}>
          <Button
            variant="outlined"
            size="large"
            startIcon={<Cable />}
            onClick={() => setConnectorOpen(true)}
            sx={{
              flex: 1, py: 1.5, borderRadius: 3,
              borderColor: "#6C63FF40", color: "#6C63FF",
              fontWeight: 800, fontSize: 14, textTransform: "none",
              "&:hover": { borderColor: "#6C63FF", background: "#6C63FF08" },
            }}>
            Connect DB
          </Button>
          <Button
            variant="outlined"
            size="large"
            startIcon={<LinkIcon />}
            onClick={() => setJoinOpen(true)}
            sx={{
              flex: 1, py: 1.5, borderRadius: 3,
              borderColor: "#FFB83040", color: "#F57C00",
              fontWeight: 800, fontSize: 14, textTransform: "none",
              "&:hover": { borderColor: "#F57C00", background: "#F57C0008" },
            }}>
            Join Datasets
          </Button>
        </Stack>

        {/* Connector Modal */}
        <ConnectorModal
          open={connectorOpen}
          onClose={() => setConnectorOpen(false)}
          onLoad={(data) => { onUpload(data); setConnectorOpen(false); }}
        />

        {/* Join Modal */}
        <JoinModal
          open={joinOpen}
          onClose={() => setJoinOpen(false)}
          onLoad={(data) => { onUpload(data); setJoinOpen(false); }}
        />

      </Stack>
    </Stack>
  );
};

export default UploadScreen;