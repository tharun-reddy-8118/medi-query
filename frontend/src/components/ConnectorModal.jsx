import { useState, useEffect } from "react";
import axios from "axios";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Stack, Typography, TextField, Button, Box,
  Avatar, Chip, IconButton, Tooltip, CircularProgress,
  Alert, Divider, InputAdornment, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow,
  Paper, Switch, FormControlLabel,
} from "@mui/material";
import {
  Storage, Cable, CheckCircle, Error as ErrorIcon,
  PlayArrow, TableChart, CloudDownload, Close,
  Visibility, VisibilityOff, DeleteOutline,
  KeyboardArrowDown, KeyboardArrowRight,
} from "@mui/icons-material";
import { API } from "../constants";

const R  = "#c52626";
const GR = "#449042";
const P  = "#6C63FF";

const DB_TYPES = [
  { value: "postgresql", label: "PostgreSQL", icon: "🐘", color: "#336791" },
  { value: "mysql",      label: "MySQL",      icon: "🐬", color: "#00758F" },
];

const ConnectorModal = ({ open, onClose, onLoad }) => {
  const [step, setStep]     = useState("connect"); // "connect" | "browse" | "loading"
  const [dbType, setDbType] = useState("postgresql");
  const [host, setHost]     = useState("localhost");
  const [port, setPort]     = useState(5432);
  const [database, setDatabase] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [alias, setAlias]   = useState("");
  const [showPw, setShowPw] = useState(false);

  const [testing, setTesting]     = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [tables, setTables]       = useState([]);
  const [browsing, setBrowsing]   = useState(false);
  const [loadingTable, setLoadingTable] = useState(null);
  const [expandedTable, setExpandedTable] = useState(null);
  const [error, setError] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [customSqlMode, setCustomSqlMode] = useState(false);
  const [customSql, setCustomSql] = useState("");

  // Reset when opening
  useEffect(() => {
    if (open) {
      setStep("connect");
      setTestResult(null);
      setTables([]);
      setError(null);
      setExpandedTable(null);
      setPrompt("");
    }
  }, [open]);

  // Update default port when db type changes
  useEffect(() => {
    setPort(dbType === "mysql" ? 3306 : 5432);
  }, [dbType]);

  const connPayload = {
    db_type: dbType, host, port: Number(port),
    database, username, password, alias,
  };

  const testConnection = async () => {
    setTesting(true); setTestResult(null); setError(null);
    try {
      const { data } = await axios.post(`${API}/connector/test`, connPayload);
      setTestResult(data);
    } catch (e) {
      setTestResult({ status: "error", message: e.response?.data?.detail || "Connection failed" });
    } finally { setTesting(false); }
  };

  const browseTables = async () => {
    setBrowsing(true); setError(null);
    try {
      const { data } = await axios.post(`${API}/connector/tables`, connPayload);
      setTables(data.tables || []);
      setStep("browse");
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to list tables");
    } finally { setBrowsing(false); }
  };

  const loadCustomSql = async () => {
    if (!customSql.trim()) return;
    setLoadingTable("custom_sql"); setError(null);
    try {
      const { data } = await axios.post(`${API}/connector/load`, {
        ...connPayload,
        table_name: "custom_sql",
        schema_name: "public",
        custom_sql: customSql.trim(),
        prompt: prompt.trim()
      });
      onLoad(data);
      onClose();
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to load custom SQL");
    } finally { setLoadingTable(null); }
  };

  const loadTable = async (t) => {
    setLoadingTable(t.table); setError(null);
    try {
      const { data } = await axios.post(`${API}/connector/load`, {
        ...connPayload,
        schema_name: t.schema,
        table_name: t.table,
        prompt: prompt.trim()
      });
      onLoad(data);
      onClose();
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to load table");
    } finally { setLoadingTable(null); }
  };

  const inputSx = {
    "& fieldset": { borderColor: `${P}25` },
    "&:hover fieldset": { borderColor: `${P}50` },
    "&.Mui-focused fieldset": { borderColor: P },
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}>

      {/* Header */}
      <DialogTitle sx={{
        background: `linear-gradient(135deg, #1E1B4B, #312E81)`,
        color: "#fff", py: 2.5, px: 3,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Avatar sx={{ width: 38, height: 38, background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}>
            <Cable sx={{ fontSize: 20, color: "#fff" }} />
          </Avatar>
          <Stack>
            <Typography fontWeight={900} fontSize={16}>
              {step === "browse" ? "Select Table" : "Connect Database"}
            </Typography>
            <Typography fontSize={10} color="rgba(255,255,255,0.6)">
              {step === "browse" ? `${tables.length} tables found` : "PostgreSQL · MySQL"}
            </Typography>
          </Stack>
        </Stack>
        <IconButton onClick={onClose} sx={{ color: "rgba(255,255,255,0.6)", "&:hover": { color: "#fff" } }}>
          <Close sx={{ fontSize: 20 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0, maxHeight: 520, overflowY: "auto" }}>

        {/* ── STEP 1: Connection Form ── */}
        {step === "connect" && (
          <Stack spacing={2.5} sx={{ p: 3 }}>

            {/* Database Type Selector */}
            <Box>
              <Typography fontSize={11} fontWeight={800} textTransform="uppercase" color="text.disabled"
                letterSpacing={1} mb={1}>Database Type</Typography>
              <Stack direction="row" spacing={1}>
                {DB_TYPES.map(db => (
                  <Box key={db.value}
                    onClick={() => setDbType(db.value)}
                    sx={{
                      flex: 1, p: 1.5, borderRadius: 2, cursor: "pointer",
                      border: `2px solid ${dbType === db.value ? db.color : "#eee"}`,
                      background: dbType === db.value ? `${db.color}08` : "#fafafa",
                      transition: "all 0.15s",
                      "&:hover": { borderColor: db.color, background: `${db.color}05` },
                    }}>
                    <Stack alignItems="center" spacing={0.5}>
                      <Typography fontSize={28}>{db.icon}</Typography>
                      <Typography fontSize={12} fontWeight={700}
                        color={dbType === db.value ? db.color : "text.secondary"}>
                        {db.label}
                      </Typography>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Box>

            {/* Connection Fields */}
            <Box sx={{ background: "#fafafa", borderRadius: 2, p: 2, border: "1px solid #eee" }}>
              <Typography fontSize={11} fontWeight={800} textTransform="uppercase" color="text.disabled"
                letterSpacing={1} mb={1.5}>🔌 Connection Details</Typography>

              <Stack direction="row" spacing={1.5} mb={1.5}>
                <TextField label="Host" size="small" fullWidth
                  value={host} onChange={e => setHost(e.target.value)}
                  InputProps={{ sx: inputSx }}
                  placeholder="localhost or IP" />
                <TextField label="Port" size="small" type="number"
                  value={port} onChange={e => setPort(e.target.value)}
                  InputProps={{ sx: inputSx }}
                  sx={{ width: 120 }} />
              </Stack>

              <TextField label="Database" size="small" fullWidth
                value={database} onChange={e => setDatabase(e.target.value)}
                InputProps={{ sx: inputSx }}
                placeholder="my_database" sx={{ mb: 1.5 }} />

              <Stack direction="row" spacing={1.5} mb={1.5}>
                <TextField label="Username" size="small" fullWidth
                  value={username} onChange={e => setUsername(e.target.value)}
                  InputProps={{ sx: inputSx }} />
                <TextField label="Password" size="small" fullWidth
                  type={showPw ? "text" : "password"}
                  value={password} onChange={e => setPassword(e.target.value)}
                  InputProps={{
                    sx: inputSx,
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowPw(!showPw)}>
                          {showPw ? <VisibilityOff sx={{ fontSize: 16 }} /> : <Visibility sx={{ fontSize: 16 }} />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }} />
              </Stack>

              <TextField label="Alias (optional)" size="small" fullWidth
                value={alias} onChange={e => setAlias(e.target.value)}
                InputProps={{ sx: inputSx }}
                placeholder="e.g. Production DB" />
            </Box>

            {/* Test Result */}
            {testResult && (
              <Alert
                severity={testResult.status === "success" ? "success" : "error"}
                icon={testResult.status === "success" ? <CheckCircle /> : <ErrorIcon />}
                sx={{ borderRadius: 2, fontWeight: 600, fontSize: 12.5 }}>
                {testResult.message}
              </Alert>
            )}

            {error && (
              <Alert severity="error" sx={{ borderRadius: 2, fontSize: 12.5, fontWeight: 600 }}>{error}</Alert>
            )}
          </Stack>
        )}

        {/* ── STEP 2: Table Browser ── */}
        {step === "browse" && (
          <Stack spacing={0}>
            <Box sx={{ px: 3, py: 1.5, borderBottom: "1.5px solid #f0f0f0", background: "#fafafa" }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Storage sx={{ fontSize: 16, color: P }} />
                <Typography fontSize={12} fontWeight={700} color="text.secondary">
                  {database} · {tables.length} table{tables.length !== 1 ? "s" : ""}
                </Typography>
                <Box flex={1} />
                <Button size="small" onClick={() => setStep("connect")}
                  sx={{ fontSize: 11, fontWeight: 700, color: "text.disabled" }}>
                  ← Back
                </Button>
              </Stack>
            </Box>

            <Box sx={{ px: 2, py: 1.5, background: '#fff' }}>
              <FormControlLabel 
                control={<Switch size="small" checked={customSqlMode} onChange={e => setCustomSqlMode(e.target.checked)} />} 
                label={<Typography fontSize={13} fontWeight={700}>Write Custom SQL</Typography>} 
              />
            </Box>
            <Divider />
            
            {customSqlMode ? (
              <Box sx={{ p: 2 }}>
                <TextField 
                  label="SQL Query" multiline rows={6} fullWidth 
                  value={customSql} onChange={e => setCustomSql(e.target.value)} 
                  placeholder="SELECT * FROM your_table WHERE..." 
                  sx={{ mb: 2 }} 
                />
                <Button 
                  variant="contained" fullWidth onClick={loadCustomSql} 
                  disabled={!customSql.trim() || loadingTable === 'custom_sql'} 
                  startIcon={loadingTable === 'custom_sql' ? <CircularProgress size={14} color="inherit" /> : <PlayArrow />}
                  sx={{
                    background: `linear-gradient(135deg,${P},#8A84FF)`,
                    fontWeight: 700, fontSize: 13, textTransform: "none",
                    borderRadius: 2, py: 1.5,
                  }}
                >
                  Execute & Load Dataset
                </Button>
              </Box>
            ) : (
              tables.length === 0 ? (
              <Stack alignItems="center" py={6} spacing={1.5}>
                <Storage sx={{ fontSize: 40, color: "text.disabled" }} />
                <Typography color="text.disabled" fontWeight={700}>No tables found</Typography>
              </Stack>
            ) : (
              <Stack spacing={0} sx={{ px: 1, py: 1 }}>
                {tables.map(t => (
                  <Box key={`${t.schema}.${t.table}`} sx={{
                    mx: 1, borderRadius: 2, border: "1.5px solid #f0f0f0",
                    mb: 1, overflow: "hidden",
                    "&:hover": { borderColor: `${P}40`, background: `${P}04` },
                    transition: "all 0.15s",
                  }}>
                    {/* Table Header */}
                    <Stack direction="row" alignItems="center" spacing={1.5} sx={{
                      px: 2, py: 1.5, cursor: "pointer",
                    }} onClick={() => setExpandedTable(expandedTable === t.table ? null : t.table)}>
                      {expandedTable === t.table
                        ? <KeyboardArrowDown sx={{ fontSize: 18, color: P }} />
                        : <KeyboardArrowRight sx={{ fontSize: 18, color: "text.disabled" }} />
                      }
                      <TableChart sx={{ fontSize: 16, color: P }} />
                      <Stack flex={1} spacing={0}>
                        <Typography fontSize={13} fontWeight={800}>{t.table}</Typography>
                        <Typography fontSize={10} color="text.disabled">
                          {t.schema} · {typeof t.rows === "number" ? t.rows.toLocaleString() : t.rows} rows · {t.columns?.length || "?"} cols
                        </Typography>
                      </Stack>
                      <Tooltip title="Load this table into MediQuery">
                        <Button size="small" variant="contained"
                          disabled={loadingTable === t.table}
                          onClick={(e) => { e.stopPropagation(); loadTable(t); }}
                          startIcon={loadingTable === t.table
                            ? <CircularProgress size={12} color="inherit" />
                            : <CloudDownload sx={{ fontSize: 14 }} />}
                          sx={{
                            background: `linear-gradient(135deg,${GR},#6ab868)`,
                            fontWeight: 700, fontSize: 11, textTransform: "none",
                            borderRadius: 2, px: 1.5, py: 0.5,
                            boxShadow: `0 3px 10px ${GR}35`,
                          }}>
                          {loadingTable === t.table ? "Loading…" : "Load"}
                        </Button>
                      </Tooltip>
                    </Stack>

                    {/* Expanded Column Details */}
                    {expandedTable === t.table && t.columns?.length > 0 && (
                      <Box sx={{ px: 2, pb: 1.5, borderTop: "1px solid #f0f0f0" }}>
                        <Stack direction="row" flexWrap="wrap" gap={0.5} mt={1}>
                          {t.columns.map(c => (
                            <Chip key={c.name} size="small"
                              label={`${c.name} (${c.type})`}
                              sx={{
                                fontSize: 10, fontWeight: 700, fontFamily: "monospace",
                                background: c.type.includes("int") || c.type.includes("float") || c.type.includes("numeric")
                                  ? "#E3F2FD" : c.type.includes("date") || c.type.includes("time")
                                  ? "#FFF3E0" : "#F5F5F5",
                                color: c.type.includes("int") || c.type.includes("float") || c.type.includes("numeric")
                                  ? "#1565C0" : c.type.includes("date") || c.type.includes("time")
                                  ? "#E65100" : "#555",
                                border: "1px solid transparent",
                              }} />
                          ))}
                        </Stack>
                      </Box>
                    )}
                  </Box>
                ))}
              </Stack>
            ))}

            {/* AI Prompt Input before loading */}
            {(tables.length > 0 || customSqlMode) && (
              <Box sx={{ px: 3, pt: 2, pb: 1 }}>
                <TextField
                  fullWidth
                  variant="outlined"
                  size="small"
                  placeholder="Optional: Guide AI dashboard (e.g. Focus on revenue)"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={loadingTable !== null}
                  InputProps={{
                    sx: { background: "#fff", borderRadius: 2 }
                  }}
                />
              </Box>
            )}

            {error && (
              <Alert severity="error" sx={{ mx: 2, mb: 2, mt: 1, borderRadius: 2, fontSize: 12.5 }}>{error}</Alert>
            )}
          </Stack>
        )}
      </DialogContent>

      {/* Actions */}
      {step === "connect" && (
        <DialogActions sx={{ px: 3, py: 2, borderTop: "1.5px solid #f0f0f0", gap: 1 }}>
          <Button onClick={onClose} color="inherit" sx={{ fontWeight: 600 }}>Cancel</Button>
          <Button
            onClick={testConnection}
            disabled={testing || !host || !database || !username}
            startIcon={testing ? <CircularProgress size={14} color="inherit" /> : <PlayArrow />}
            sx={{ fontWeight: 700, color: P, borderRadius: 2 }}>
            {testing ? "Testing…" : "Test Connection"}
          </Button>
          <Button
            onClick={browseTables}
            variant="contained"
            disabled={browsing || !host || !database || !username || !password}
            startIcon={browsing ? <CircularProgress size={14} color="inherit" /> : <Storage />}
            sx={{
              background: `linear-gradient(135deg,${P},#9B94FF)`,
              fontWeight: 800, borderRadius: 2, textTransform: "none",
              boxShadow: `0 4px 14px ${P}35`,
            }}>
            {browsing ? "Connecting…" : "Browse Tables"}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default ConnectorModal;
