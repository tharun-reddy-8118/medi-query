import { useState } from "react";
import axios from "axios";
import {
  Stack, Typography, Card, CardContent, Box,
  Button, Avatar, Alert, LinearProgress, Chip,
  CircularProgress, FormControl, InputLabel,
  Select, MenuItem,
} from "@mui/material";
import { AutoGraph, Psychology, TrendingUp, TrendingDown } from "@mui/icons-material";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { API, G } from "../../constants";

const RED   = "#c52626";
const GREEN  = "#449042";

const fmtNum = (v) => {
  if (v == null) return "—";
  const n = Number(v);
  if (isNaN(n)) return String(v);
  if (Math.abs(n) >= 1e7)  return `₹${(n/1e7).toFixed(2)} Cr`;
  if (Math.abs(n) >= 1e5)  return `₹${(n/1e5).toFixed(2)} L`;
  if (Math.abs(n) >= 1000) return `${(n/1000).toFixed(1)}K`;
  return n.toLocaleString("en-IN", { maximumFractionDigits: 1 });
};

const ForecastTab = ({ file, fileId }) => {
  const [dateCol,  setDateCol]  = useState(file.date_columns?.[0] || file.columns?.[0] || "");
  const [valueCol, setValueCol] = useState("__count__");
  const [periods,  setPeriods]  = useState(30);
  const [result,   setResult]   = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  const run = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const { data } = await axios.post(`${API}/forecast`, {
        file_id: fileId, date_column: dateCol, value_column: valueCol, periods,
      });
      setResult(data);
    } catch (e) { setError(e.response?.data?.detail || "Forecast failed."); }
    finally { setLoading(false); }
  };

  // Merge historical + forecast, include uncertainty band
  const chartData = result ? [
    ...result.historical.map(d => ({
      date: d.date, actual: d.value,
      predicted: null, lower: null, upper: null,
    })),
    ...result.forecast
      .filter(d => !result.historical.find(h => h.date === d.date))
      .map(d => ({
        date: d.date, actual: null,
        predicted: d.predicted, lower: d.lower, upper: d.upper,
      })),
  ] : [];

  const trend      = result?.trend;
  const isUp       = trend?.direction === "up";
  const trendColor = isUp ? GREEN : RED;
  const trendGrad  = isUp
    ? "linear-gradient(135deg,#449042,#6ab868)"
    : "linear-gradient(135deg,#c52626,#e05555)";

  const sumItems = result ? [
    { label: "Forecast From",    val: result.summary?.forecast_from,  g: G.purple },
    { label: "Forecast To",      val: result.summary?.forecast_to,    g: G.coral  },
    { label: "Projected Total",  val: fmtNum(result.summary?.forecast_total), g: G.teal  },
    { label: "Period Average",   val: fmtNum(result.summary?.forecast_avg),   g: G.amber },
  ] : [];

  const controls = [
    {
      label: "📅 Date Column", val: dateCol, set: setDateCol,
      opts: (file.date_columns?.length ? file.date_columns : file.columns || []).map(c => ({ v: c, l: c })),
    },
    {
      label: "📊 Value Column", val: valueCol, set: setValueCol,
      opts: [
        { v: "__count__", l: "Count of Records" },
        ...(file.numeric_columns || []).map(c => ({ v: c, l: c })),
      ],
    },
    {
      label: "⏳ Horizon", val: periods, set: setPeriods,
      opts: [7, 14, 30, 60, 90, 180].map(p => ({ v: p, l: `${p} periods` })),
    },
  ];

  return (
    <Stack spacing={3} sx={{ p: { xs: 2, sm: 3, md: 4 }, width: "100%" }}>

      {/* Header */}
      <Stack className="f0">
        <Typography variant="h4" fontWeight={900}>AI Forecasting 🔮</Typography>
        <Typography color="text.secondary" mt={0.5} fontSize={14}>
          Predict future trends with Prophet — auto-detects your data frequency
        </Typography>
      </Stack>

      {/* Config */}
      <Card elevation={0} className="f1" sx={{ borderRadius: 1, border: "1.5px solid rgba(197,38,38,0.12)" }}>
        <CardContent sx={{ p: 3 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} flexWrap="wrap" alignItems={{ sm: "flex-end" }}>
            {controls.map(({ label, val, set, opts }) => (
              <FormControl key={label} size="small" sx={{ minWidth: { xs: "100%", sm: 200 } }}>
                <InputLabel sx={{ fontWeight: 700, fontSize: 13 }}>{label}</InputLabel>
                <Select value={val} label={label} onChange={e => set(e.target.value)}
                  sx={{ background: "#FFF5F5", "& fieldset": { borderColor: "rgba(197,38,38,0.2)" } }}>
                  {opts.map(({ v, l }) => (
                    <MenuItem key={v} value={v} sx={{ fontWeight: 600 }}>{l}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            ))}
            <Button variant="contained" size="large" onClick={run} disabled={loading}
              startIcon={loading ? <CircularProgress size={17} sx={{ color: "#fff" }} /> : <AutoGraph />}
              sx={{
                flexShrink: 0, height: 42, minWidth: 160,
                background: `linear-gradient(135deg,${RED},#e05555)`,
                "&:hover": { background: `linear-gradient(135deg,#a01e1e,${RED})` },
              }}>
              {loading ? "Forecasting…" : "Run Forecast"}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {error   && <Alert severity="error" sx={{ borderRadius: 1, fontWeight: 600 }}>{error}</Alert>}
      {loading && <LinearProgress sx={{ borderRadius: 1, "& .MuiLinearProgress-bar": { background: `linear-gradient(90deg,${RED},#e05555)` } }} />}

      {result && (
        <>
          {/* Trend badge */}
          <Stack direction="row" alignItems="center" spacing={2} className="f0">
            <Box sx={{
              display: "flex", alignItems: "center", gap: 1.5,
              background: `${trendColor}12`, border: `1.5px solid ${trendColor}30`,
              borderRadius: 50, px: 2.5, py: 1,
            }}>
              {isUp
                ? <TrendingUp sx={{ color: trendColor, fontSize: 22 }} />
                : <TrendingDown sx={{ color: trendColor, fontSize: 22 }} />}
              <Typography fontWeight={800} fontSize={15} sx={{ color: trendColor }}>
                {isUp ? "Upward Trend" : "Downward Trend"}
              </Typography>
              {trend?.pct_change != null && (
                <Chip label={`${trend.pct_change > 0 ? "+" : ""}${trend.pct_change}% vs history`}
                  size="small" sx={{
                    background: `${trendColor}20`, color: trendColor,
                    fontWeight: 800, fontSize: 12,
                  }} />
              )}
            </Box>
            <Typography fontSize={12} color="text.secondary">
              Hist avg: <strong>{fmtNum(trend?.hist_avg)}</strong>
              {" → "}Forecast avg: <strong>{fmtNum(trend?.forecast_avg)}</strong>
            </Typography>
          </Stack>

          {/* Chart */}
          <Card elevation={0} className="f0" sx={{ borderRadius: 1, border: "1.5px solid rgba(197,38,38,0.12)" }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
                <Typography fontWeight={800} fontSize={11} textTransform="uppercase"
                  letterSpacing={1.1} color="text.secondary">
                  📈 {result.metric} — Historical + {result.periods}-period Forecast
                </Typography>
                <Stack direction="row" spacing={2}>
                  {[
                    { color: RED,   label: "Actual" },
                    { color: GREEN, label: "Forecast" },
                    { color: `${GREEN}50`, label: "Confidence band" },
                  ].map(({ color, label }) => (
                    <Stack key={label} direction="row" alignItems="center" spacing={0.6}>
                      <Box sx={{ width: 12, height: 3, borderRadius: 2, background: color }} />
                      <Typography fontSize={11} color="text.secondary">{label}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Stack>

              <ResponsiveContainer width="100%" height={340}>
                <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <defs>
                    <linearGradient id="gActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={RED}   stopOpacity={0.22} />
                      <stop offset="95%" stopColor={RED}   stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gForecast" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={GREEN} stopOpacity={0.22} />
                      <stop offset="95%" stopColor={GREEN} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gBand" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"  stopColor={GREEN} stopOpacity={0.10} />
                      <stop offset="100%"stopColor={GREEN} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                  <XAxis dataKey="date"
                    tick={{ fill: "#aaa", fontSize: 10, fontFamily: "Nunito" }}
                    tickLine={false} axisLine={{ stroke: "#eee" }}
                    interval={Math.max(0, Math.floor(chartData.length / 10) - 1)} />
                  <YAxis
                    tick={{ fill: "#aaa", fontSize: 10, fontFamily: "Nunito" }}
                    tickLine={false} axisLine={false} width={56}
                    tickFormatter={v => {
                      const n = Number(v);
                      if (n >= 1e7) return `${(n/1e7).toFixed(1)} Cr`;
                      if (n >= 1e5) return `${(n/1e5).toFixed(1)} L`;
                      if (n >= 1000) return `${(n/1000).toFixed(0)}K`;
                      return n;
                    }} />
                  <Tooltip
                    contentStyle={{ background: "#fff", border: "1.5px solid #eee", borderRadius: 12, fontFamily: "Nunito", fontSize: 12 }}
                    formatter={(v, name) => [v != null ? fmtNum(v) : "—", name]}
                    labelStyle={{ color: "#333", fontWeight: 700, marginBottom: 4 }}
                  />
                  {/* Confidence band as shaded area between lower/upper */}
                  <Area type="monotone" dataKey="upper"  stroke="none" fill="url(#gBand)"  name="Upper bound" connectNulls={false} legendType="none" />
                  <Area type="monotone" dataKey="lower"  stroke="none" fill="#fff"          name="Lower bound" connectNulls={false} legendType="none" />
                  <Area type="monotone" dataKey="actual"    stroke={RED}   fill="url(#gActual)"   strokeWidth={2.5} dot={false} name="Actual"   connectNulls={false} />
                  <Area type="monotone" dataKey="predicted" stroke={GREEN} fill="url(#gForecast)" strokeWidth={2.5} dot={false} name="Forecast" connectNulls={false} strokeDasharray="6 3" />
                  {result.historical.length > 0 && (
                    <ReferenceLine
                      x={result.historical[result.historical.length - 1]?.date}
                      stroke="#FFB830" strokeDasharray="5 4" strokeWidth={1.5}
                      label={{ value: "Now", fill: "#FFB830", fontSize: 11, fontWeight: 700, position: "insideTopRight" }}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Summary stat cards */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} className="f1">
            {sumItems.map(({ label, val, g }) => (
              <Card key={label} elevation={0} sx={{
                flex: "1 1 140px", minWidth: 0, borderRadius: 1,
                border: "1.5px solid rgba(197,38,38,0.1)",
              }}>
                <CardContent sx={{ p: "16px 20px !important" }}>
                  <Typography fontSize={10} color="text.secondary" fontWeight={800}
                    textTransform="uppercase" letterSpacing={1} mb={0.5}>{label}</Typography>
                  <Typography fontWeight={900} fontSize={20}
                    sx={{ background: g, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    {val}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Stack>

          {/* AI analysis */}
          <Card elevation={0} className="f2" sx={{
            borderRadius: 1,
            border: `2px solid ${trendColor}20`,
            background: isUp
              ? "linear-gradient(135deg,#FFFFFF,#F2FBF2)"
              : "linear-gradient(135deg,#FFFFFF,#FFF5F5)",
          }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" spacing={1.5} alignItems="center" mb={2}>
                <Avatar sx={{ width: 36, height: 36, background: trendGrad }}>
                  <Psychology sx={{ fontSize: 20, color: "#fff" }} />
                </Avatar>
                <Stack>
                  <Typography fontWeight={800} fontSize={11} textTransform="uppercase"
                    letterSpacing={1.1} sx={{ color: trendColor }}>
                    🧠 AI Analysis &amp; Recommendations
                  </Typography>
                  <Typography fontSize={11} color="text.secondary">
                    Based on {result.historical.length} historical data points
                  </Typography>
                </Stack>
              </Stack>
              <Typography fontSize={14} lineHeight={1.9} whiteSpace="pre-wrap">
                {result.ai_explanation || "No analysis available."}
              </Typography>
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty state */}
      {!result && !loading && (
        <Card elevation={0} className="f2" sx={{
          borderRadius: 1, border: "2px dashed rgba(197,38,38,0.2)", background: "transparent",
        }}>
          <CardContent sx={{ p: 6, textAlign: "center" }}>
            <Stack spacing={2} alignItems="center">
              <Avatar sx={{ width: 68, height: 68, background: "#FFF5F5" }} className="wiggle">
                <AutoGraph sx={{ fontSize: 36, color: RED }} />
              </Avatar>
              <Typography color="text.secondary" fontSize={14} fontWeight={600}>
                Select your columns and hit <strong>Run Forecast</strong> 🪄
              </Typography>
              <Typography color="text.secondary" fontSize={12}>
                Prophet auto-detects daily / weekly / monthly frequency from your data
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
};

export default ForecastTab;