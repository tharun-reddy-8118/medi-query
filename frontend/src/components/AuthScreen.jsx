import { useState, useEffect } from "react";
import axios from "axios";
import {
  Stack, Typography, Paper, Button, TextField,
  Avatar, Alert, CircularProgress, Box, Chip, Tabs, Tab,
  InputAdornment, IconButton,
} from "@mui/material";
import {
  MonitorHeart, Login, PersonAdd,
  Visibility, VisibilityOff, Email, Lock, Person,
} from "@mui/icons-material";
import BlobBg from "./BlobBg";
import { API } from "../constants";

const R = "#c52626";
const GR = "#449042";

const AuthScreen = ({ onAuth }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [brandLogo, setBrandLogo] = useState("");
  useEffect(() => {
    const loadBrand = () => {
      setBrandLogo(localStorage.getItem("brand_logo") || "/logo_a.png");
    };
    loadBrand();
    window.addEventListener("brand_update", loadBrand);
    return () => window.removeEventListener("brand_update", loadBrand);
  }, []);

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password.trim()) return setError("Email and password are required.");

    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/auth/login`, { email: email.trim(), password });

      // Store token
      localStorage.setItem("mq_token", data.token);
      localStorage.setItem("mq_user", JSON.stringify(data.user));
      onAuth(data.user);
    } catch (e) {
      setError(e.response?.data?.detail || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputSx = {
    borderRadius: 3,
    bgcolor: "#fff",
    "& fieldset": { borderColor: `${R}30` },
    "&:hover fieldset": { borderColor: `${R}60` },
    "&.Mui-focused fieldset": { borderColor: R },
  };

  return (
    <Stack alignItems="center" justifyContent="center"
      sx={{ minHeight: "100vh", background: "linear-gradient(155deg,#F4F2FF 0%,#FFF0F0 52%,#F0FBFF 100%)", p: { xs: 2, sm: 4 }, position: "relative", overflow: "hidden" }}>
      <BlobBg />

      <Stack spacing={3.5} alignItems="center"
        sx={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 440 }}>

        {/* Logo */}
        <Stack spacing={1} alignItems="center">
          <Box sx={{ background: "#fff", p: 1.5, borderRadius: 4, mb: 1, display: "inline-block", boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
            <img 
              src={brandLogo} 
              alt="Logo" 
              style={{ height: 50, objectFit: "contain" }} 
            />
          </Box>
          {/* <MonitorHeart sx={{ fontSize: 38 }} /> */}
          <Typography variant="h4" sx={{ color: R, fontWeight: 900, letterSpacing: "-0.5px", fontFamily: "Nunito" }}>
            Medi<Box component="span" sx={{ color: GR }}>Query BI</Box>
          </Typography>
          <Typography color="text.secondary" fontSize={13.5} textAlign="center">
            AI-powered hospital analytics companion 🏥
          </Typography>
        </Stack>

        {/* Auth Card */}
        <Paper elevation={0} sx={{
          width: "100%", borderRadius: "24px",
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(20px)",
          border: `1.5px solid ${R}15`,
          overflow: "hidden",
        }}>
          <Typography variant="h6" fontWeight={800} textAlign="center" sx={{ pt: 3, color: "text.primary" }}>
            Sign In to your account
          </Typography>
          <Stack spacing={2.5} sx={{ p: { xs: 3, sm: 4 } }}>

            {/* Email */}
            <TextField
              fullWidth variant="outlined" size="small"
              placeholder="Email address"
              type="email"
              value={email} onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              InputProps={{
                startAdornment: <InputAdornment position="start"><Email sx={{ fontSize: 18, color: R, opacity: 0.5 }} /></InputAdornment>,
                sx: inputSx,
              }}
            />

            {/* Password */}
            <TextField
              fullWidth variant="outlined" size="small"
              placeholder="Password"
              type={showPw ? "text" : "password"}
              value={password} onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              InputProps={{
                startAdornment: <InputAdornment position="start"><Lock sx={{ fontSize: 18, color: R, opacity: 0.5 }} /></InputAdornment>,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowPw(!showPw)} sx={{ color: "text.disabled" }}>
                      {showPw ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
                    </IconButton>
                  </InputAdornment>
                ),
                sx: inputSx,
              }}
            />

            {error && (
              <Alert severity="error" sx={{
                borderRadius: 3, fontSize: 12.5, fontWeight: 600,
                "& .MuiAlert-icon": { fontSize: 18 }
              }}>
                {error}
              </Alert>
            )}

            {/* Submit */}
            <Button
              fullWidth variant="contained" size="large"
              onClick={submit} disabled={loading}
              sx={{
                py: 1.3, fontSize: 14.5, fontWeight: 800, borderRadius: 3,
                background: `linear-gradient(135deg,${R},#e05555)`,
                boxShadow: `0 6px 20px ${R}40`,
                "&:hover": { background: `linear-gradient(135deg,#a01e1e,${R})` },
                textTransform: "none",
              }}
            >
              {loading ? <CircularProgress size={22} sx={{ color: "#fff" }} /> : "Sign In"}
            </Button>
          </Stack>
        </Paper>

        {/* Feature pills */}
        {/* <Stack direction="row" flexWrap="wrap" gap={1} justifyContent="center">
          {[
            { label: "🔒 Secure Auth", c: R },
            { label: "📊 Personal Dashboards", c: GR },
            { label: "🧠 AI-Powered", c: "#6C63FF" },
            { label: "📈 Forecasting", c: "#FFB830" },
          ].map(({ label, c }) => (
            <Chip key={label} label={label} size="small"
              sx={{
                background: `${c}10`, color: c, fontWeight: 700, fontSize: 11,
                border: `1.5px solid ${c}25`
              }} />
          ))}
        </Stack> */}
      </Stack>
    </Stack>
  );
};

export default AuthScreen;
