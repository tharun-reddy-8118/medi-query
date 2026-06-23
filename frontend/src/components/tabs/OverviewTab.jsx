import { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import DrilldownDrawer from "./DrilldownDrawer";
import {
  Stack, Typography, Card, CardContent, Chip, Tooltip,
  Button, Avatar, CircularProgress, LinearProgress,
  Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Box, FormControl, Select, MenuItem, Menu,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton,
  Snackbar, Alert, Switch, FormControlLabel, Checkbox, Slider, ListItemText, InputLabel, Drawer, Divider, Accordion, AccordionSummary, AccordionDetails, Grid, CardActionArea, Tabs, Tab
} from "@mui/material";
import {
  FilterAlt, Fullscreen, FullscreenExit, Bolt, TrendingUp, Lightbulb, Psychology, ShowChart,
  DonutLarge, BarChart as BarIcon, AutoGraph, TableChart,
  Numbers, Download, Settings, DeleteOutline, FormatListNumbered,
  Palette, FormatAlignLeft, FormatAlignCenter, FormatAlignRight,
  RecordVoiceOver, ContentCopy, VolumeUp, Close, MenuBook, Add, PlaylistAdd, Schedule,
  AttachMoney, People, LocalHospital, Favorite, Event, Star, CheckCircle, Warning, Info, Storefront, LocalShipping, Image as ImageIcon, Save, Edit, AccessTime, ExpandMore, GridOn, ChatBubbleOutline, TextFields, ArrowBack, FormatColorFill, Assessment, ColorLens, SpaceBar, Search, KeyboardBackspace, ChevronLeft, Language
} from "@mui/icons-material";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Area, AreaChart, Legend, LabelList,
} from "recharts";
import { motion } from "framer-motion";
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { ResponsiveGridLayout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { API } from "../../constants";
import DictionaryModal from "../DictionaryModal";
import ParameterModal from "./ParameterModal";
import FloatingChat from "../FloatingChat";

const R = "#c52626";
const GR = "#449042";
const T = { red: R, blue: "#1565C0", teal: "#00897B", amber: "#F57C00", violet: "#6A1B9A", green: GR };

const KPI_ICONS = [
  { name: "None", icon: null },
  { name: "TrendingUp", icon: TrendingUp },
  { name: "ShowChart", icon: ShowChart },
  { name: "DonutLarge", icon: DonutLarge },
  { name: "BarIcon", icon: BarIcon },
  { name: "AutoGraph", icon: AutoGraph },
  { name: "TableChart", icon: TableChart },
  { name: "Numbers", icon: Numbers },
  { name: "AttachMoney", icon: AttachMoney },
  { name: "People", icon: People },
  { name: "LocalHospital", icon: LocalHospital },
  { name: "Favorite", icon: Favorite },
  { name: "Event", icon: Event },
  { name: "Star", icon: Star },
  { name: "CheckCircle", icon: CheckCircle },
  { name: "Warning", icon: Warning },
  { name: "Info", icon: Info },
  { name: "Storefront", icon: Storefront },
  { name: "LocalShipping", icon: LocalShipping },
  { name: "Bolt", icon: Bolt },
  { name: "Lightbulb", icon: Lightbulb },
  { name: "Psychology", icon: Psychology },
];

// ── Tableau-Inspired Color Palettes ───────────────────────────────────────────
const PALETTES = {
  "DashForge": ["#c52626", "#449042", "#1565C0", "#F57C00", "#6A1B9A", "#00897B", "#a01e1e", "#2d6b2b"],
  "Tableau 10": ["#4E79A7", "#F28E2B", "#E15759", "#76B7B2", "#59A14F", "#EDC948", "#B07AA1", "#FF9DA7"],
  "Jewel Bright": ["#EB1E2C", "#FD6F30", "#F9A729", "#2D9D78", "#459CDE", "#9B59B6", "#E74C9A", "#267278"],
  "Winter": ["#2B5F8A", "#6D9DC5", "#B0D4F1", "#4A90A4", "#7C5295", "#C4A8D8", "#3E7A5E", "#8BC4A9"],
  "Sunset": ["#FCDE9C", "#FBB65B", "#FA8D3D", "#E85F2F", "#D43D2F", "#AC2339", "#7C1D3A", "#522029"],
  "Color Blind": ["#1170AA", "#FC7D0B", "#A3ACB9", "#57606C", "#5FA2CE", "#C85200", "#7B848F", "#D4D4D4"],
};
const PALETTE_NAMES = Object.keys(PALETTES);

const lighten = (hex, amt = 40) => {
  let c = hex.replace("#", "");
  let r = Math.min(255, parseInt(c.substring(0, 2), 16) + amt);
  let g = Math.min(255, parseInt(c.substring(2, 4), 16) + amt);
  let b = Math.min(255, parseInt(c.substring(4, 6), 16) + amt);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
};

const buildSlots = (colors) => colors.map(c => ({
  grad: `linear-gradient(135deg,${c},${lighten(c, 50)})`,
  accent: c,
  border: c + "20",
}));

// Default fallbacks
const SLOTS = buildSlots(PALETTES["DashForge"]);
const PIE_COLORS = PALETTES["DashForge"];

// Label alignment options
const LABEL_ALIGNS = [
  { value: "horizontal", label: "Horizontal", icon: <FormatAlignLeft sx={{ fontSize: 16 }} /> },
  { value: "angled", label: "45° Angled", icon: <FormatAlignCenter sx={{ fontSize: 16, transform: "rotate(-45deg)" }} /> },
  { value: "vertical", label: "Vertical", icon: <FormatAlignRight sx={{ fontSize: 16, transform: "rotate(-90deg)" }} /> },
];

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtAxis = (v, mode = "auto") => {
  const n = Number(v);
  if (isNaN(n)) return String(v).slice(0, 9);
  if (mode === "raw") return n.toLocaleString("en-IN", { maximumFractionDigits: 1 });
  if (mode === "percent") return `${(n * 100).toFixed(1)}%`;
  if (mode === "thousands") return `${(n / 1000).toFixed(1)}K`;
  if (mode === "lakhs") return `${(n / 1e5).toFixed(1)} L`;
  if (mode === "crores") return `${(n / 1e7).toFixed(1)} Cr`;
  if (mode === "duration_hhmmss") {
    const s = Math.round(Math.abs(n));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    const sign = n < 0 ? "-" : "";
    return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  if (mode === "duration_dhms") {
    const s = Math.round(Math.abs(n));
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sign = n < 0 ? "-" : "";
    return `${sign}${d}d ${h}h ${m}m`;
  }
  if (Math.abs(n) >= 1e7) return `${(n / 1e7).toFixed(1)} Cr`;
  if (Math.abs(n) >= 1e5) return `${(n / 1e5).toFixed(1)} L`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return n % 1 === 0 ? String(n) : n.toFixed(1);
};

// ── KPI Number Format Options ─────────────────────────────────────────────────
const NUMBER_FORMATS = [
  { value: "auto", label: "Auto" },
  { value: "raw", label: "Raw Number" },
  { value: "percent", label: "Percentage (%)" },
  { value: "thousands", label: "Thousands (K)" },
  { value: "lakhs", label: "Lakhs (L)" },
  { value: "crores", label: "Crores (Cr)" },
  { value: "duration_hhmmss", label: "Duration (HH:MM:SS)" },
  { value: "duration_dhms", label: "Duration (Days, Hrs, Mins)" },
];

// ── Typography Font Options ──────────────────────────────────────────────────
const FONT_FAMILIES = [
  { value: "", label: "Default Theme Font" },
  { value: "'Inter', sans-serif", label: "Inter (Modern Sans)" },
  { value: "'Roboto', sans-serif", label: "Roboto" },
  { value: "'Montserrat', sans-serif", label: "Montserrat (Clean & Bold)" },
  { value: "'Playfair Display', serif", label: "Playfair Display (Elegant Serif)" },
  { value: "'JetBrains Mono', monospace", label: "JetBrains Mono (Sleek Mono)" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "system-ui, sans-serif", label: "System UI" }
];

const fmtKpiVal = (raw, mode = "auto") => {
  if (raw == null || isNaN(Number(raw))) return raw; // fallback to pre-formatted
  const n = Number(raw);
  switch (mode) {
    case "raw": return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
    case "percent": return `${(n * 100).toFixed(1)}%`;
    case "thousands": return `${(n / 1_000).toFixed(2)}K`;
    case "lakhs": return `\u20b9${(n / 1_00_000).toFixed(2)} L`;
    case "crores": return `\u20b9${(n / 1_00_00_000).toFixed(2)} Cr`;
    case "duration_hhmmss": {
      const s = Math.round(Math.abs(n));
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const secs = s % 60;
      const sign = n < 0 ? "-" : "";
      return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    case "duration_dhms": {
      const s = Math.round(Math.abs(n));
      const d = Math.floor(s / 86400);
      const h = Math.floor((s % 86400) / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sign = n < 0 ? "-" : "";
      return `${sign}${d}d ${h}h ${m}m`;
    }
    case "auto":
    default: {
      if (Math.abs(n) >= 1e7) return `\u20b9${(n / 1e7).toFixed(2)} Cr`;
      if (Math.abs(n) >= 1e5) return `\u20b9${(n / 1e5).toFixed(2)} L`;
      if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}K`;
      return n % 1 === 0 ? n.toLocaleString("en-IN") : n.toFixed(1);
    }
  }
};

// ── Custom Tooltip ────────────────────────────────────────────────────────────
const Tip = ({ active, payload, label, accent, numFmt, secNumFmt }) => {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{
      background: "#fff", borderRadius: 2.5, px: 1.8, py: 1.2,
      border: `1.5px solid ${accent}30`, boxShadow: `0 8px 24px ${accent}20`
    }}>
      {label !== undefined && (
        <Typography fontSize={11} color="text.secondary" mb={0.3}>
          {String(label).slice(0, 24)}
        </Typography>
      )}
      <Typography fontSize={14} fontWeight={800} sx={{ color: accent }}>
        {fmtKpiVal(payload[0]?.value, numFmt)}
        {payload[0]?.payload?._label_ext !== undefined && payload[0]?.payload?._label_ext !== null && (
          <Typography fontSize={12} fontWeight={700} color="text.secondary" sx={{ ml: 1, display: 'inline' }}>
            ({fmtKpiVal(payload[0].payload._label_ext, secNumFmt || "auto")})
          </Typography>
        )}
      </Typography>
    </Box>
  );
};

// ── KPI Card ──────────────────────────────────────────────────────────────────
// ── Conditional Formatting Evaluator ─────────────────────────────────────────
const evaluateConditions = (row, formats) => {
  if (!formats || formats.length === 0) return { textColor: null, bgColor: null, rowBgColor: null, barColor: null, dataBar: null };
  let result = { textColor: null, bgColor: null, rowBgColor: null, barColor: null, dataBar: null };

  for (const rule of formats) {
    const val = row[rule.col];
    if (val === undefined || val === null) continue;

    if (rule.type === "simple") {
      const numVal = Number(val);
      const ruleNum = Number(rule.val);
      const isNum = !isNaN(numVal) && !isNaN(ruleNum) && rule.val !== "";
      
      let pass = false;
      switch (rule.op) {
        case "=": pass = isNum ? numVal === ruleNum : String(val) === String(rule.val); break;
        case "!=": pass = isNum ? numVal !== ruleNum : String(val) !== String(rule.val); break;
        case ">": pass = isNum ? numVal > ruleNum : false; break;
        case "<": pass = isNum ? numVal < ruleNum : false; break;
        case ">=": pass = isNum ? numVal >= ruleNum : false; break;
        case "<=": pass = isNum ? numVal <= ruleNum : false; break;
        case "contains": pass = String(val).toLowerCase().includes(String(rule.val).toLowerCase()); break;
        case "between":
          if (isNum && !isNaN(Number(rule.val2))) {
            pass = numVal >= ruleNum && numVal <= Number(rule.val2);
          }
          break;
      }
      
      if (pass) {
        if (rule.target === "text") result.textColor = rule.color;
        else if (rule.target === "bg") result.bgColor = rule.color;
        else if (rule.target === "row") result.rowBgColor = rule.color;
      }
    } else if (rule.type === "gradient") {
      const numVal = Number(val);
      const minV = Number(rule.minVal);
      const maxV = Number(rule.maxVal);
      if (!isNaN(numVal) && !isNaN(minV) && !isNaN(maxV) && maxV > minV) {
        // Simple linear interpolation
        const pct = Math.max(0, Math.min(1, (numVal - minV) / (maxV - minV)));
        
        // Hex to RGB parser
        const hex2rgb = (hex) => {
          const v = parseInt(hex.replace("#",""), 16);
          return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
        };
        const c1 = hex2rgb(rule.minColor || "#ffffff");
        const c2 = hex2rgb(rule.maxColor || "#ff0000");
        const r = Math.round(c1[0] + (c2[0] - c1[0]) * pct);
        const g = Math.round(c1[1] + (c2[1] - c1[1]) * pct);
        const b = Math.round(c1[2] + (c2[2] - c1[2]) * pct);
        result.bgColor = `rgb(${r},${g},${b})`;
      }
    } else if (rule.type === "databar") {
      const numVal = Number(val);
      if (!isNaN(numVal)) {
        result.dataBar = { color: rule.color || "#4cd137", val: numVal };
      }
    }
  }
  return result;
};

const KpiCard = ({ kpi, idx, onEdit, onDelete, slots, isAdmin, onKpiClick }) => {
  const s = (slots || SLOTS)[idx % (slots || SLOTS).length];
  const accentColor = kpi._accentColor || s.accent;
  const bgColor = kpi._bgColor || "#FFFDF5";
  const textAlign = kpi._textAlign || "center";
  const valueFontSize = kpi._valueFontSize || 32;
  const subtitle = kpi._subtitle || "";
  const showStats = kpi._showStats !== false;
  const labelColor = kpi._labelColor || "#333";
  const valueColor = kpi._valueColor || accentColor;
  const numFmt = kpi._numberFormat || "auto";
  const hasPadding = kpi._hasPadding !== false;
  const roundedCorners = kpi._roundedCorners !== false;
  const hasBorder = kpi._hasBorder !== false;
  const borderColor = kpi._borderColor || "#eee";

  // Use raw values if available, otherwise fall back to pre-formatted
  const displayAvg = kpi._raw_avg != null ? fmtKpiVal(kpi._raw_avg, numFmt) : kpi.avg;
  const displayTotal = kpi._raw_total != null ? fmtKpiVal(kpi._raw_total, numFmt) : kpi.total;
  const displayMin = kpi._raw_min != null ? fmtKpiVal(kpi._raw_min, numFmt) : kpi.min;
  const displayMax = kpi._raw_max != null ? fmtKpiVal(kpi._raw_max, numFmt) : kpi.max;

  const borderTop = kpi._borderTop !== false;
  const borderRight = kpi._borderRight !== false;
  const borderBottom = kpi._borderBottom !== false;
  const borderLeft = kpi._borderLeft !== false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      style={{ height: "100%", display: "flex" }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <Card className={isAdmin ? "drag-handle" : "disabled-handle"} elevation={0} sx={{
      flex: 1, minWidth: 0, borderRadius: roundedCorners ? 2 : 0, overflow: "hidden",
      cursor: isAdmin ? "grab" : ((kpi._onClickAction || kpi.onClickAction) === "navigate" ? "pointer" : "default"),
      "&:active": { cursor: isAdmin ? "grabbing" : ((kpi._onClickAction || kpi.onClickAction) === "navigate" ? "pointer" : "default") },
      borderTop: borderTop ? `1.5px solid ${accentColor}` : "none",
      borderRight: borderRight ? `1.5px solid ${borderColor}` : "none",
      borderBottom: borderBottom ? `1.5px solid ${borderColor}` : "none",
      borderLeft: borderLeft ? `1.5px solid ${borderColor}` : "none",
      background: bgColor,
      position: "relative",
      fontFamily: kpi._fontFamily || "inherit",
      "& *": kpi._fontFamily ? { fontFamily: `${kpi._fontFamily} !important` } : {},
      boxShadow: "none !important",
      transform: "none !important",
      transition: "none !important",
      "&:hover": {
        boxShadow: (kpi._onClickAction || kpi.onClickAction) === "navigate" ? "0 4px 12px rgba(0,0,0,0.1) !important" : "none !important",
        transform: (kpi._onClickAction || kpi.onClickAction) === "navigate" ? "translateY(-2px) !important" : "none !important"
      }
    }} 
    onMouseDownCapture={(e) => {
      e.currentTarget.setAttribute('data-down-x', e.clientX);
      e.currentTarget.setAttribute('data-down-y', e.clientY);
    }}
    onMouseUpCapture={(e) => {
      const downX = parseFloat(e.currentTarget.getAttribute('data-down-x'));
      const downY = parseFloat(e.currentTarget.getAttribute('data-down-y'));
      if (!isNaN(downX) && !isNaN(downY)) {
        const dx = Math.abs(e.clientX - downX);
        const dy = Math.abs(e.clientY - downY);
        if (dx < 5 && dy < 5) {
          if (onKpiClick) onKpiClick(kpi);
        }
      }
    }}>
      {/* Edit / Delete buttons */}
      {isAdmin && (
        <Stack direction="row" sx={{ position: "absolute", top: 6, right: 6, opacity: 0.4, "&:hover": { opacity: 1 }, transition: "opacity 0.15s" }}>
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEdit(kpi); }} sx={{ width: 22, height: 22 }}>
            <Settings sx={{ fontSize: 14 }} />
          </IconButton>
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDelete(kpi); }} sx={{ width: 22, height: 22, "&:hover": { color: "#ff5252" } }}>
            <DeleteOutline sx={{ fontSize: 14 }} />
          </IconButton>
        </Stack>
      )}

      <CardContent sx={{
        p: hasPadding ? 2 : 0, pb: hasPadding ? "16px !important" : "0 !important", textAlign,
        display: "flex", flexDirection: "column",
        justifyContent: showStats ? "flex-start" : "center",
        alignItems: textAlign === "center" ? "center" : textAlign === "right" ? "flex-end" : "flex-start",
        height: "100%", boxSizing: "border-box",
      }}>
        {/* Label and Icon */}
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5, justifyContent: textAlign === "center" ? "center" : textAlign === "right" ? "flex-end" : "flex-start" }}>
          {kpi._icon && kpi._icon !== "None" && (
            <Avatar sx={{ width: 24, height: 24, background: `${accentColor}15`, color: accentColor }}>
              {(() => {
                const IconComp = KPI_ICONS.find(i => i.name === kpi._icon)?.icon;
                return IconComp ? <IconComp sx={{ fontSize: 14 }} /> : null;
              })()}
            </Avatar>
          )}
          <Typography
            fontSize={kpi._fontSize ? `${kpi._fontSize}px` : 13}
            fontWeight={kpi._fontWeight === "bold" ? "900" : "800"}
            fontStyle={kpi._fontStyle || "normal"}
            color={labelColor}
            sx={{ letterSpacing: 0.2 }}
          >
            {kpi.label}
          </Typography>
        </Stack>

        {/* Main Value */}
        <Typography
          fontSize={valueFontSize}
          fontWeight={kpi._bodyFontWeight === "bold" ? 900 : 700}
          color={valueColor}
          sx={{
            lineHeight: 1.1, mb: 0.5,
            fontFamily: kpi._bodyFontFamily || "inherit",
            fontStyle: kpi._bodyFontStyle || "normal"
          }}
        >
          {displayAvg}
        </Typography>

        {/* Subtitle */}
        {subtitle && (
          <Typography
            fontSize={kpi._bodyFontSize ? `${kpi._bodyFontSize}px` : 11}
            fontWeight={kpi._bodyFontWeight || "normal"}
            fontStyle={kpi._bodyFontStyle || "normal"}
            color="text.disabled"
            mt={0.5}
            sx={{ fontFamily: kpi._bodyFontFamily || "inherit" }}
          >
            {subtitle}
          </Typography>
        )}

        {/* Stats Row */}
        {showStats && (
          <Stack
            direction="row" spacing={2} justifyContent={textAlign} mt={1.5}
            sx={{
              pt: 1.2, borderTop: "1px solid #f0f0f0",
              fontFamily: kpi._bodyFontFamily || "inherit"
            }}
          >
            {[
              [kpi.total_label || "Total", displayTotal],
              ["Min", displayMin],
              ["Max", displayMax],
            ].map(([lbl, val]) => (
              <Stack key={lbl} alignItems={textAlign === "center" ? "center" : textAlign === "right" ? "flex-end" : "flex-start"}>
                <Typography
                  fontSize={kpi._bodyFontSize ? `${kpi._bodyFontSize + 1}px` : 12}
                  fontWeight={kpi._bodyFontWeight === "bold" ? 800 : 700}
                  fontStyle={kpi._bodyFontStyle || "normal"}
                  color="text.primary"
                >
                  {val}
                </Typography>
                <Typography
                  fontSize={kpi._bodyFontSize ? `${kpi._bodyFontSize - 2}px` : 9}
                  fontWeight={kpi._bodyFontWeight || "normal"}
                  fontStyle={kpi._bodyFontStyle || "normal"}
                  color="text.disabled"
                  textTransform="uppercase"
                  letterSpacing={0.5}
                >
                  {lbl}
                </Typography>
              </Stack>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
    </motion.div>
  );
};

// ── Chart Card ────────────────────────────────────────────────────────────────
export const ChartCard = ({ chart, idx, onEdit, onDelete, slots, pieColors, labelAlign = "horizontal", isAdmin, isDateCol, trendLoadingId, onTrendClick, onChartClick }) => {
  const _slots = slots || SLOTS;
  const _pieColors = pieColors || PIE_COLORS;
  const baseSlot = _slots[idx % _slots.length];
  
  const overrideColor = chart._colorOverride;
  const s = overrideColor
    ? { grad: `linear-gradient(135deg,${overrideColor},${lighten(overrideColor, 50)})`, accent: overrideColor, border: overrideColor + "20" }
    : baseSlot;
    
  const headerColor = chart._headerColor;
  const headerBg = headerColor
    ? `linear-gradient(135deg,${headerColor},${lighten(headerColor, 40)})`
    : (chart._bgColor ? chart._bgColor : s.grad);
  const titleColor = chart._textColor || (chart._bgColor ? "#333" : "#fff");
  const showLabels = chart._showLabels || false;
  const sortOrder = chart._sortOrder || "";
  const showGrid = chart._showGrid !== false;
  const titleAlign = chart._titleAlign || "left";
  const hidePill = chart._hidePill || false;
  const hasPadding = chart._hasPadding !== false;
  const roundedCorners = chart._roundedCorners !== false;
  // const hasBorder = chart._hasBorder !== false;
  const borderColor = chart._borderColor || s.border;
  
  const { type, title, data: rawData, xKey, yKey } = chart;
  const sortKey = yKey;
  let data = sortOrder && sortKey
    ? [...rawData].sort((a, b) => sortOrder === "asc"
      ? (Number(a[sortKey]) || 0) - (Number(b[sortKey]) || 0)
      : (Number(b[sortKey]) || 0) - (Number(a[sortKey]) || 0))
    : rawData;

  if (chart.config?.time_grouping === "hour") {
    const dataMap = {};
    data.forEach(d => { dataMap[d.label] = d; });
    const filledData = [];
    for (let i = 0; i < 24; i++) {
      const hourStr = i.toString().padStart(2, '0') + ":00";
      if (dataMap[hourStr]) filledData.push(dataMap[hourStr]);
      else filledData.push({ label: hourStr, [yKey]: 0, _label_ext: null });
    }
    data = filledData;
  }

  const effectiveAlign = chart._labelAlign || labelAlign;
  const labelAngle = effectiveAlign === "angled" ? 45 : effectiveAlign === "vertical" ? 90 : 0;
  const bodySize = chart._bodyFontSize || 10;
  const bodyFamily = chart._bodyFontFamily || "inherit";

  const getBarLabelText = (row, val) => {
    const mode = chart._pieLabelMode || "value";
    let primaryText = "";

    if (mode === "label") {
      primaryText = String(row?.[xKey] ?? "");
    } else if (mode === "both") {
      const total = data.reduce((acc, r) => acc + (Number(r[yKey]) || 0), 0);
      const pct = total > 0 ? ((Number(val) || 0) / total * 100).toFixed(0) + "%" : "0%";
      primaryText = `${String(row?.[xKey] ?? "")} (${pct})`;
    } else if (mode === "percent") {
      const total = data.reduce((acc, r) => acc + (Number(r[yKey]) || 0), 0);
      primaryText = total > 0 ? ((Number(val) || 0) / total * 100).toFixed(0) + "%" : "0%";
    } else {
      primaryText = fmtAxis(val, chart._numberFormat);
    }

    if (row && row._label_ext !== undefined && row._label_ext !== null) {
      const formattedExt = fmtKpiVal(row._label_ext, chart._secondaryNumberFormat || "auto");
      primaryText += ` (${formattedExt})`;
    }
    return primaryText;
  };

  // --- ECharts Options Builder ---
  const buildEChartsOption = () => {
    // Collect all unique series groups if "group_val" is present, otherwise single series
    const hasGroups = data.some(d => d.group_val !== undefined);
    let seriesGroups = ["Default"];
    if (hasGroups) {
      const uniqueGroups = new Set(data.map(d => d.group_val || "Unknown"));
      seriesGroups = Array.from(uniqueGroups);
    }

    const uniqueX = Array.from(new Set(data.map(d => d[xKey])));
    
    // Grouped data map: group_val -> { xLabel: yValue }
    const groupedData = {};
    seriesGroups.forEach(g => groupedData[g] = {});
    data.forEach(d => {
      const g = d.group_val || "Default";
      groupedData[g][d[xKey]] = d[yKey];
    });

    // Formatting for Tooltips
    const valueFormatter = (val) => fmtAxis(val, chart._numberFormat);
    const axisLabelProps = {
      fontSize: bodySize,
      fontFamily: bodyFamily,
      color: "#aaa",
      hideOverlap: true,
    };

    const isHbar = type === "hbar";
    const isPie = type === "pie";
    const isTree = type === "treemap";
    const isRadar = type === "radar";
    // const isProgress = type === "progress";

    const baseOption = {
      animationDuration: 500,
      tooltip: {
        show: chart._showTooltip !== false,
        trigger: isPie || isTree || isRadar ? 'item' : 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: chart._tooltipBgColor || 'rgba(255, 255, 255, 0.95)',
        textStyle: { fontSize: 12, fontFamily: bodyFamily, color: chart._tooltipTextColor || '#333' },
        formatter: isPie ? (p) => `${p.name}<br/><b>${valueFormatter(p.value)}</b> (${p.percent}%)` : undefined,
        valueFormatter: isPie ? undefined : valueFormatter,
        borderColor: chart._tooltipBorderColor || '#ddd',
        borderWidth: 1,
        padding: [8, 12]
      },
      grid: isPie || isTree || isRadar ? undefined : {
        top: 30,
        right: 20,
        bottom: chart._showToolbox ? 40 : 10, 
        left: '2%',
        containLabel: true
      },
      legend: hasGroups && !isPie ? {
        top: 0,
        type: 'scroll',
        textStyle: { fontSize: 10, color: '#666' }
      } : undefined,
      toolbox: chart._showToolbox ? {
        feature: {
          dataZoom: { yAxisIndex: 'none' },
          restore: {},
          saveAsImage: {}
        },
        iconStyle: { borderColor: s.accent }
      } : undefined,
      dataZoom: !isPie && !isTree && !isRadar && uniqueX.length > 12 ? [
        {
          type: 'slider',
          show: true,
          yAxisIndex: isHbar ? 0 : undefined,
          xAxisIndex: isHbar ? undefined : 0,
          right: isHbar ? 0 : undefined,
          bottom: isHbar ? undefined : 0,
          width: isHbar ? 15 : undefined,
          height: isHbar ? undefined : 15,
          start: 0,
          end: Math.min(100, Math.floor((12 / uniqueX.length) * 100)),
          borderColor: 'transparent', backgroundColor: '#f9f9f9', fillerColor: `${s.accent}20`
        },
        {
          type: 'inside',
          yAxisIndex: isHbar ? 0 : undefined,
          xAxisIndex: isHbar ? undefined : 0,
          zoomOnMouseWheel: false,
          moveOnMouseWheel: true,
          moveOnMouseMove: true
        }
      ] : (chart._showToolbox && !isPie && !isTree && !isRadar ? [
        { type: 'slider', show: true, bottom: 0, height: 20, borderColor: 'transparent', backgroundColor: '#f9f9f9', fillerColor: `${s.accent}20` }
      ] : undefined)
    };

    if (isPie) {
      const pieData = data.map((d, i) => {
        const labelName = String(d[xKey] || "");
        const customColor = chart._pieColors?.[labelName];
        return {
          name: labelName,
          value: Number(d[yKey]) || 0,
          itemStyle: { color: customColor || _pieColors[i % _pieColors.length] }
        };
      });
      baseOption.series = [{
        type: 'pie',
        radius: [`${chart._innerRadius ?? 60}%`, `${chart._outerRadius ?? 90}%`],
        roseType: chart._roseType ? 'area' : false,
        itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
        label: { show: showLabels, formatter: (p) => getBarLabelText(data[p.dataIndex], p.value), fontSize: bodySize, color: '#666' },
        data: pieData
      }];
      return baseOption;
    }

    if (isTree) {
      const treeData = data.map((d, i) => {
        const labelName = String(d[xKey] || "");
        const customColor = chart._pieColors?.[labelName];
        return {
          name: labelName,
          value: Number(d[yKey]) || 0,
          itemStyle: { color: customColor || _pieColors[i % _pieColors.length] }
        };
      });
      baseOption.series = [{
        type: 'treemap',
        roam: false,
        itemStyle: { borderColor: '#fff', borderWidth: 2, gapWidth: 2 },
        label: { show: true, formatter: '{b}\n{c}', fontSize: bodySize },
        data: treeData
      }];
      return baseOption;
    }

    if (isRadar) {
      const indicators = uniqueX.map(x => {
        let maxVal = 0;
        seriesGroups.forEach(g => {
          const val = groupedData[g][x] || 0;
          if (val > maxVal) maxVal = val;
        });
        return { name: String(x), max: maxVal * 1.2 || 100 };
      });

      baseOption.radar = {
        indicator: indicators,
        shape: 'polygon',
        splitNumber: 5,
        axisName: { color: '#666', fontSize: bodySize, fontFamily: bodyFamily },
        splitLine: { lineStyle: { color: ['#eee'] } },
        splitArea: { show: false },
        axisLine: { lineStyle: { color: '#ddd' } }
      };

      const radarSeriesData = seriesGroups.map((g, i) => {
        const values = uniqueX.map(x => groupedData[g][x] || 0);
        const c = hasGroups ? _pieColors[i % _pieColors.length] : s.accent;
        return {
          name: g,
          value: values,
          itemStyle: { color: c },
          areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: c }, { offset: 1, color: c + '00' }]) }
        };
      });

      baseOption.series = [{
        type: 'radar',
        data: radarSeriesData
      }];
      return baseOption;
    }

    const xAxisDef = {
      type: 'category',
      data: uniqueX,
      axisLabel: isHbar 
        ? { ...axisLabelProps, width: 120, overflow: 'truncate' } 
        : { ...axisLabelProps, rotate: labelAngle, width: 90, overflow: 'truncate' },
      axisLine: { show: !isHbar, lineStyle: { color: '#eee' } },
      axisTick: { show: false },
      splitLine: { show: showGrid && isHbar, lineStyle: { type: 'dashed', color: '#f0f0f0' } },
      inverse: isHbar
    };

    const yAxisDef = {
      type: 'value',
      axisLabel: { ...axisLabelProps, formatter: (v) => fmtAxis(v, chart._numberFormat) },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: showGrid && !isHbar, lineStyle: { type: 'dashed', color: '#f0f0f0' } }
    };

    baseOption.xAxis = isHbar ? yAxisDef : xAxisDef;
    baseOption.yAxis = isHbar ? xAxisDef : yAxisDef;

    baseOption.series = seriesGroups.map((g, i) => {
      const rules = chart.config?.conditionalFormats || chart._conditionalFormats || [];
      const seriesData = uniqueX.map(x => {
        const val = groupedData[g][x] || 0;
        let itemStyle = undefined;
        if (!hasGroups) {
          const customColor = chart._pieColors?.[String(x)];
          if (customColor) itemStyle = { color: customColor };
        }
        
        if (rules.length > 0) {
          const evalDict = { 
            [chart.measure || chart.config?.measure || chart.yKey || yKey]: val, 
            [chart.dimension || chart.config?.dimension || chart.xKey || xKey]: x, 
            [chart.group_by || chart.config?.group_by || chart.groupByCol]: g 
          };
          const cond = evaluateConditions(evalDict, rules);
          const overrideColor = cond.bgColor || cond.barColor || cond.rowBgColor || cond.textColor;
          if (overrideColor) {
            itemStyle = itemStyle || {};
            itemStyle.color = overrideColor;
          }
        }
        
        if (itemStyle) return { value: val, itemStyle };
        return val;
      });
      const isArea = type === "area";
      const isLine = type === "line" || isArea;
      
      const customGroupColor = hasGroups ? chart._pieColors?.[String(g)] : undefined;
      const c = customGroupColor || (hasGroups ? _pieColors[i % _pieColors.length] : s.accent);
      
      const seriesObj = {
        name: g,
        type: isLine ? 'line' : 'bar',
        data: seriesData,
        barMaxWidth: chart._barWidth || 40,
        smooth: chart._smoothLine || false,
        showSymbol: seriesData.length <= 20,
        symbolSize: 6,
        itemStyle: { color: c, borderRadius: isLine ? 0 : (isHbar ? [0, 4, 4, 0] : [4, 4, 0, 0]) },
        lineStyle: isLine ? { width: 3, color: c } : undefined,
        areaStyle: isArea ? {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: c },
            { offset: 1, color: c + '00' }
          ])
        } : undefined,
        label: {
          show: showLabels,
          position: isHbar ? 'right' : 'top',
          color: '#666',
          fontSize: bodySize,
          formatter: (p) => valueFormatter(p.value)
        }
      };

      if (i === 0 && chart._targetLineValue) {
        const tVal = Number(chart._targetLineValue);
        if (!isNaN(tVal)) {
          seriesObj.markLine = {
            silent: false,
            symbol: ['none', 'none'],
            label: {
              formatter: chart._targetLineLabel ? `${chart._targetLineLabel}: {c}` : '{c}',
              position: 'insideEndTop',
              color: chart._targetLineColor || '#ff4757',
              fontSize: 11,
              fontWeight: 800,
              backgroundColor: 'rgba(255,255,255,0.7)',
              padding: [2, 4],
              borderRadius: 2
            },
            lineStyle: {
              color: chart._targetLineColor || '#ff4757',
              type: 'dashed',
              width: 2
            },
            data: [
              isHbar ? { xAxis: tVal } : { yAxis: tVal }
            ]
          };
        }
      }

      return seriesObj;
    });

    // --- MAP SPECIFIC OVERRIDE ---
    if (type === "map") {
      const minVal = Math.min(...data.map(d => Number(d[yKey]) || 0), 0);
      const maxVal = Math.max(...data.map(d => Number(d[yKey]) || 0), 1);
      
      const mapData = data.map(d => ({
          name: String(d[xKey] || ""),
          value: Number(d[yKey]) || 0,
          original_data: d
      }));

      baseOption.tooltip = {
        trigger: 'item',
        formatter: (params) => {
            if(!params.name) return "";
            return `${params.name}<br/>${yKey}: <b>${params.value?.toLocaleString() || 0}</b>`;
        }
      };
      
      baseOption.visualMap = {
        left: 'right',
        min: minVal,
        max: maxVal,
        inRange: { color: ['#e3f2fd', s.accent || '#1565C0'] },
        text: ['High', 'Low'],
        calculable: true,
        show: true
      };
      
      baseOption.series = [{
        name: yKey,
        type: 'map',
        roam: true,
        map: chart.mapRegion || chart.map_region || 'usa',
        emphasis: { label: { show: true } },
        itemStyle: { areaColor: '#f3f4f6', borderColor: '#fff' },
        data: mapData
      }];
      
      delete baseOption.grid;
      delete baseOption.xAxis;
      delete baseOption.yAxis;
      delete baseOption.legend;
    }

    // --- GAUGE SPECIFIC OVERRIDE ---
    if (type === "gauge") {
      const val = data.length > 0 ? (Number(data[0][yKey]) || Number(data[0][xKey]) || 0) : 0;
      const target = chart._gaugeTarget || chart.config?.gaugeTarget || 100;
      
      baseOption.series = [{
        type: 'gauge',
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max: target,
        splitNumber: 8,
        axisLine: {
          lineStyle: {
            width: 10,
            color: [
              [0.3, '#ff4d4f'],
              [0.7, '#faad14'],
              [1, '#52c41a']
            ]
          }
        },
        pointer: {
          icon: 'path://M12.8,0.7l12,40.1H0.7L12.8,0.7z',
          length: '12%',
          width: 20,
          offsetCenter: [0, '-60%'],
          itemStyle: { color: 'auto' }
        },
        axisTick: { length: 12, lineStyle: { color: 'auto', width: 2 } },
        splitLine: { length: 20, lineStyle: { color: 'auto', width: 5 } },
        axisLabel: { color: '#464646', fontSize: 12, distance: -60, formatter: (val) => Math.round(val) },
        title: { offsetCenter: [0, '-20%'], fontSize: 14 },
        detail: {
          fontSize: 24,
          offsetCenter: [0, '20%'],
          valueAnimation: true,
          formatter: (val) => val.toLocaleString(),
          color: 'inherit'
        },
        data: [{ value: val, name: yKey }]
      }];
      
      delete baseOption.grid;
      delete baseOption.xAxis;
      delete baseOption.yAxis;
      delete baseOption.legend;
    }

    return baseOption;
  };

  const iconColor = titleColor;
  const chipBg = titleColor === "#fff" ? "rgba(255,255,255,0.22)" : `${titleColor}22`;
  const chartIcon = type === "pie" ? <DonutLarge sx={{ fontSize: 14, color: iconColor }} />
    : (type === "area" || type === "line") ? <ShowChart sx={{ fontSize: 14, color: iconColor }} />
      : type === "hbar" ? <BarIcon sx={{ fontSize: 14, color: iconColor, transform: "rotate(90deg)" }} />
        : type === "treemap" ? <TableChart sx={{ fontSize: 14, color: iconColor }} />
        : type === "radar" ? <SpaceBar sx={{ fontSize: 14, color: iconColor }} />
        : type === "progress" ? <FormatListNumbered sx={{ fontSize: 14, color: iconColor }} />
          : <BarIcon sx={{ fontSize: 14, color: iconColor }} />;

  const borderTop = chart._borderTop !== false;
  const borderRight = chart._borderRight !== false;
  const borderBottom = chart._borderBottom !== false;
  const borderLeft = chart._borderLeft !== false;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      <Card elevation={0} sx={{
      height: "100%", display: "flex", flexDirection: "column",
      borderRadius: roundedCorners ? 1 : 0,
      borderTop: borderTop ? `1.5px solid ${borderColor}` : "none",
      borderRight: borderRight ? `1.5px solid ${borderColor}` : "none",
      borderBottom: borderBottom ? `1.5px solid ${borderColor}` : "none",
      borderLeft: borderLeft ? `1.5px solid ${borderColor}` : "none",
      overflow: "hidden", background: chart._bgColor || "#fff",
      fontFamily: chart._fontFamily || "inherit",
      "& *": chart._fontFamily ? { fontFamily: `${chart._fontFamily} !important` } : {},
      boxShadow: "none !important", transform: "none !important", transition: "none !important",
      "&:hover": { boxShadow: "none !important", transform: "none !important" }
    }}>
      <Box className={isAdmin ? "drag-handle" : "disabled-handle"} sx={{ background: headerBg, px: 2.5, py: 1.3, display: "flex", alignItems: "center", gap: 1.2, cursor: isAdmin ? "grab" : "default", "&:active": { cursor: isAdmin ? "grabbing" : "default" } }}>
        <Avatar sx={{ width: 26, height: 26, background: chipBg }}>{chartIcon}</Avatar>
        <Typography
          fontWeight={chart._fontWeight === "bold" ? "900" : "800"}
          fontSize={chart._fontSize ? `${chart._fontSize}px` : 13}
          fontStyle={chart._fontStyle || "normal"}
          color={titleColor}
          noWrap
          sx={{ flex: 1, textAlign: titleAlign }}
        >
          {title}
        </Typography>
        {!hidePill && <Chip label={type.toUpperCase()} size="small" sx={{ height: 18, fontSize: 9, fontWeight: 800, letterSpacing: 0.5, background: chipBg, color: titleColor }} />}
        {isDateCol && (
          <Tooltip title="Change Time Trend" placement="top">
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onTrendClick && onTrendClick(e); }} sx={{ color: titleColor, opacity: 0.8, width: 24, height: 24, "&:hover": { opacity: 1 } }}>
              {trendLoadingId === chart.id ? <CircularProgress size={14} color="inherit" /> : <AccessTime sx={{ fontSize: 16 }} />}
            </IconButton>
          </Tooltip>
        )}
        {isAdmin && (
          <>
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEdit(chart); }} sx={{ color: titleColor, ml: -0.5, width: 24, height: 24 }}>
              <Settings sx={{ fontSize: 16 }} />
            </IconButton>
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDelete && onDelete(chart); }} sx={{ color: titleColor, opacity: 0.75, width: 24, height: 24, "&:hover": { color: "#ff5252", opacity: 1 } }}>
              <DeleteOutline sx={{ fontSize: 16 }} />
            </IconButton>
          </>
        )}
      </Box>

      <Box sx={{ p: hasPadding ? 2 : 0, pb: hasPadding ? 1.5 : 0, flex: 1, minHeight: 0, height: "100%", overflow: "hidden", fontFamily: bodyFamily, fontSize: `${bodySize}px` }}>
        {type === "progress" ? (() => {
          const maxVal = Math.max(...data.map(d => Number(d[yKey]) || 0), 1);
          const total = data.reduce((acc, r) => acc + (Number(r[yKey]) || 0), 0);
          return (
            <Box sx={{ height: "100%", overflowY: "auto", pr: 1, "&::-webkit-scrollbar": { width: 4 }, "&::-webkit-scrollbar-thumb": { background: `${s.accent}40`, borderRadius: 2 } }}>
              <Box sx={{ border: "1px solid #eee", borderRadius: 1, overflow: "hidden" }}>
                {data.map((r, i) => {
                  const val = Number(r[yKey]) || 0;
                  const pct = total > 0 ? (val / total * 100).toFixed(1) : 0;
                  const rules = chart.config?.conditionalFormats || chart._conditionalFormats || [];
                  const cond = evaluateConditions(r, rules);
                  return (
                    <Box key={i} onClick={(e) => onChartClick && onChartClick(chart, { activeLabel: r[xKey] })} sx={{ display: "flex", borderBottom: i === data.length - 1 ? "none" : "1px solid #eee", cursor: "pointer", "&:hover .prog-bar": { filter: "brightness(0.95)" }, background: cond.rowBgColor || "transparent" }}>
                      <Box sx={{ flex: 1, py: 1, px: 1.5, display: "flex", alignItems: "center", background: cond.rowBgColor ? "transparent" : "#fff", color: cond.textColor || "inherit" }}>
                        <Typography fontSize={12} fontWeight={600} color={cond.textColor || "#444"} noWrap>{r[xKey] || "Unknown"}</Typography>
                      </Box>
                      <Box sx={{ flex: 0.45, minWidth: "130px", position: "relative", borderLeft: "1px solid #eee", background: cond.bgColor || "#fcfcfc" }}>
                        <Box className="prog-bar" sx={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "100%", background: cond.barColor || (cond.dataBar ? cond.dataBar.color : s.accent), opacity: cond.dataBar ? Math.max(0.05, cond.dataBar.val / maxVal) : Math.max(0.15, val / maxVal), transition: "opacity 0.5s ease" }} />
                        <Box sx={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center", height: "100%", py: 1 }}>
                          <Typography fontSize={12} fontWeight={800} color={cond.textColor || "#111"}>
                            {fmtAxis(val, chart._numberFormat)} <span style={{ fontWeight: 600, color: cond.textColor || '#333' }}>| {pct}%</span>
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          );
        })() : type === "TextWidget" ? (
          <Box sx={{ p: 2, height: "100%", overflowY: "auto", display: "flex", flexDirection: "column" }}>
            <Typography sx={{ whiteSpace: "pre-wrap", color: titleColor, fontSize: bodySize, fontFamily: bodyFamily }}>
              {chart.text || "No text"}
            </Typography>
          </Box>
        ) : type === "IframeWidget" ? (() => {
          let url = chart.url || "";
          if (url.includes("youtube.com/watch?v=")) {
            url = url.replace("watch?v=", "embed/");
            const ampersandIdx = url.indexOf("&");
            if (ampersandIdx !== -1) {
              url = url.substring(0, ampersandIdx);
            }
          } else if (url.includes("youtu.be/")) {
            url = url.replace("youtu.be/", "youtube.com/embed/");
          }
          return (
            <Box sx={{ width: "100%", height: "100%", overflow: "hidden" }}>
              <iframe 
                src={url} 
                style={{ width: "100%", height: "100%", border: "none", pointerEvents: "auto" }} 
                title={title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </Box>
          );
        })() : type === "table" ? (() => {
          const dims = [chart.config?.dimension || "Primary"];
          const extras = chart._extraCols || chart.config?.extraCols || [];
          const measure = chart.config?.measure || "Value";
          
          return (
            <Box sx={{ height: "100%", overflow: "auto", "&::-webkit-scrollbar": { width: 4, height: 4 }, "&::-webkit-scrollbar-thumb": { background: `${s.accent}40`, borderRadius: 2 } }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead style={{ position: "sticky", top: 0, background: "#fafafa", zIndex: 1 }}>
                  <tr>
                    <th style={{ padding: "8px 12px", borderBottom: "2px solid #ddd", fontSize: 12, fontWeight: 700, color: "#444" }}>{dims[0]}</th>
                    {extras.map((col, idx) => (
                      <th key={idx} style={{ padding: "8px 12px", borderBottom: "2px solid #ddd", fontSize: 12, fontWeight: 700, color: "#444" }}>{col}</th>
                    ))}
                    <th style={{ padding: "8px 12px", borderBottom: "2px solid #ddd", fontSize: 12, fontWeight: 700, color: "#444", textAlign: "right" }}>{measure}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((r, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #eee", backgroundColor: i % 2 === 0 ? "#fff" : "#fafafa", transition: "background 0.2s" }}>
                      <td style={{ padding: "8px 12px", fontSize: 12, color: "#333" }}>{r[xKey] || ""}</td>
                      {extras.map((_, idx) => (
                        <td key={idx} style={{ padding: "8px 12px", fontSize: 12, color: "#333" }}>{r[`extra_${idx}`] || ""}</td>
                      ))}
                      <td style={{ padding: "8px 12px", fontSize: 12, color: "#111", fontWeight: 600, textAlign: "right" }}>
                        {fmtAxis(Number(r[yKey]) || 0, chart._numberFormat)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          );
        })() : (
          <ReactECharts
            option={buildEChartsOption()}
            style={{ height: '100%', width: '100%', minHeight: 50, minWidth: 50 }}
            notMerge={true}
            lazyUpdate={true}
            onEvents={{
              'click': (params) => {
                if (onChartClick) {
                  onChartClick(chart, { activeLabel: params.name });
                }
              }
            }}
          />
        )}
      </Box>
    </Card>
    </motion.div>
  );
};


// ── Skeleton loader ───────────────────────────────────────────────────────────
const Skeleton = () => (
  <Card elevation={0} sx={{ borderRadius: 1, overflow: "hidden", border: "1.5px solid #f0f0f0" }}>
    <Box sx={{
      height: 44, background: "linear-gradient(90deg,#f5f5f5,#ececec,#f5f5f5)",
      backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite",
      "@keyframes shimmer": { "0%": { backgroundPosition: "200% 0" }, "100%": { backgroundPosition: "-200% 0" } }
    }} />
    <Box sx={{ p: 2, height: 240, background: "#fafafa" }} />
  </Card>
);

// ── Floating Image ───────────────────────────────────────────────────────────
const FloatingImage = ({ img, onUpdate, onDelete, isAdmin }) => {
  const [pos, setPos] = useState({ x: img.x || 100, y: img.y || 100 });
  const [size, setSize] = useState({ w: img.w || 120, h: img.h || 120 });
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const startRef = useRef({ x: 0, y: 0, startX: 0, startY: 0, startW: 0, startH: 0 });

  const handlePointerDown = (e) => {
    if (!isAdmin) return;
    e.preventDefault();
    setDragging(true);
    startRef.current = { x: e.clientX, y: e.clientY, startX: pos.x, startY: pos.y };
    e.target.setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    setPos({ x: startRef.current.startX + dx, y: startRef.current.startY + dy });
  };
  const handlePointerUp = (e) => {
    if (!dragging) return;
    setDragging(false);
    e.target.releasePointerCapture(e.pointerId);
    onUpdate(img.id, { ...pos, ...size });
  };

  const handleResizeDown = (e) => {
    if (!isAdmin) return;
    e.stopPropagation(); e.preventDefault();
    setResizing(true);
    startRef.current = { x: e.clientX, y: e.clientY, startW: size.w, startH: size.h };
    e.target.setPointerCapture(e.pointerId);
  };
  const handleResizeMove = (e) => {
    if (!resizing) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    setSize({ w: Math.max(50, startRef.current.startW + dx), h: Math.max(50, startRef.current.startH + dy) });
  };
  const handleResizeUp = (e) => {
    if (!resizing) return;
    setResizing(false);
    e.target.releasePointerCapture(e.pointerId);
    onUpdate(img.id, { ...pos, ...size });
  };

  return (
    <Box
      sx={{
        position: "absolute", left: pos.x, top: pos.y, width: size.w, height: size.h,
        zIndex: dragging ? 1000 : 100, cursor: isAdmin ? (dragging ? "grabbing" : "grab") : "default",
        "&:hover .img-actions": { opacity: 1 },
      }}
      onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}
    >
      <img src={img.src} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" }} />
      {isAdmin && (
        <Stack className="img-actions" direction="row" sx={{ position: "absolute", top: -8, right: -8, opacity: 0, transition: "opacity 0.2s", zIndex: 2 }}>
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDelete(img.id); }} onPointerDown={e => e.stopPropagation()} sx={{ width: 24, height: 24, background: "#ff5252", color: "#fff", "&:hover": { background: "#d32f2f" }, boxShadow: "0 2px 5px rgba(0,0,0,0.2)" }}>
            <DeleteOutline sx={{ fontSize: 14 }} />
          </IconButton>
        </Stack>
      )}
      {isAdmin && (
        <Box
          className="img-actions"
          onPointerDown={handleResizeDown} onPointerMove={handleResizeMove} onPointerUp={handleResizeUp} onPointerCancel={handleResizeUp}
          sx={{
            position: "absolute", bottom: -5, right: -5, width: 16, height: 16, cursor: "nwse-resize",
            background: "#1a1a2e", borderRadius: "50%", border: "2px solid #fff", opacity: 0, transition: "opacity 0.2s", zIndex: 2, boxShadow: "0 2px 5px rgba(0,0,0,0.2)"
          }}
        />
      )}
    </Box>
  );
};

// ── Filter Widget Card ────────────────────────────────────────────────────────
const FilterWidgetCard = ({ col, dash, filterOverrides, advancedFilters, setAdvancedFilters, availableFilterValues, isAdmin, onEdit, onDelete, slots }) => {
  const ov = filterOverrides[col] || {};
  const isDate = dash?.date_cols?.includes(col);

  const accentColor = ov.accentColor || slots[0].accent;
  const bgColor = ov.bgColor || "#ffffff";
  const labelColor = ov.labelColor || "#333";
  const title = ov.title || col;
  const roundedCorners = ov.roundedCorners !== false;
  const hasBorder = ov.hasBorder !== false;

  return (
    <Card className={isAdmin ? "drag-handle" : "disabled-handle"} elevation={0} sx={{
      width: "100%", height: "100%", borderRadius: roundedCorners ? 2 : 0, overflow: "hidden",
      cursor: isAdmin ? "grab" : "default", "&:active": { cursor: isAdmin ? "grabbing" : "default" },
      border: hasBorder ? `1.5px solid ${ov.borderColor || "#eee"}` : "none",
      borderTop: hasBorder ? `2.5px solid ${accentColor}` : "none",
      background: bgColor,
      position: "relative",
      fontFamily: ov.fontFamily || "inherit",
    }}>
      {/* Edit / Delete buttons */}
      {isAdmin && (
        <Stack direction="row" sx={{ position: "absolute", top: 6, right: 6, opacity: 0.4, "&:hover": { opacity: 1 }, transition: "opacity 0.15s", zIndex: 10 }}>
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEdit(col); }} sx={{ width: 22, height: 22 }}>
            <Settings sx={{ fontSize: 14 }} />
          </IconButton>
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDelete(col); }} sx={{ width: 22, height: 22, "&:hover": { color: "#ff5252" } }}>
            <DeleteOutline sx={{ fontSize: 14 }} />
          </IconButton>
        </Stack>
      )}

      <CardContent sx={{ p: ov.hasPadding === false ? 0 : 2, pb: ov.hasPadding === false ? "0 !important" : "16px !important", height: "100%", display: "flex", flexDirection: "column" }}>
        <Typography fontSize={ov.fontSize || 13} fontWeight={ov.fontWeight || 700} color={labelColor} mb={1.5}
          textAlign={ov.textAlign || "left"} fontStyle={ov.fontStyle || "normal"}
        >
          {title}
        </Typography>

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto' }} onPointerDown={e => e.stopPropagation()}>
          {isDate ? (
            <Stack spacing={1}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography fontSize={11} fontWeight={600} color="text.secondary" sx={{ minWidth: 30 }}>From</Typography>
                <input type="date" style={{ flex: 1, padding: "4px 6px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "11px", outline: "none", color: "#333", fontFamily: "inherit", minWidth: 0 }}
                  value={advancedFilters[`date_${col}`]?.from || ""}
                  onChange={e => setAdvancedFilters(prev => ({ ...prev, [`date_${col}`]: { ...prev[`date_${col}`], from: e.target.value } }))}
                />
              </Stack>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography fontSize={11} fontWeight={600} color="text.secondary" sx={{ minWidth: 30 }}>To</Typography>
                <input type="date" style={{ flex: 1, padding: "4px 6px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "11px", outline: "none", color: "#333", fontFamily: "inherit", minWidth: 0 }}
                  value={advancedFilters[`date_${col}`]?.to || ""}
                  onChange={e => setAdvancedFilters(prev => ({ ...prev, [`date_${col}`]: { ...prev[`date_${col}`], to: e.target.value } }))}
                />
              </Stack>
            </Stack>
          ) : (
            <select
              style={{ width: "100%", padding: "6px 8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "12px", outline: "none", color: "#333", fontFamily: "inherit" }}
              value={advancedFilters.cats?.[col]?.[0] || ""}
              onChange={e => {
                const v = e.target.value;
                setAdvancedFilters(prev => ({ ...prev, cats: { ...(prev.cats || {}), [col]: v ? [v] : [] } }));
              }}
            >
              <option value="">(All)</option>
              {dash?.filters?.find(f => f.col === col)?.values?.map(val => (
                <option key={val} value={val}>{val}</option>
              ))}
            </select>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
import BuilderModal from "./BuilderModal";
import ScheduleModal from "./ScheduleModal";


const SettingCard = ({ icon, title, onClick }) => (
  <CardActionArea onClick={onClick} sx={{ height: "100%", borderRadius: 2 }}>
    <Card sx={{ p: 2.5, height: "100%", borderRadius: 2, border: "1px solid #eaeaea", boxShadow: "0px 4px 12px rgba(0,0,0,0.03)", display: "flex", alignItems: "center", gap: 1.5 }}>
      <Box sx={{ fontSize: 26, color: "text.secondary", display: "flex" }}>{icon}</Box>
      <Typography fontSize={14} fontWeight={800} textTransform="uppercase" color="text.secondary" letterSpacing={1}>{title}</Typography>
    </Card>
  </CardActionArea>
);

const OverviewTab = ({ file, fileId, onUpdateFile, currentUser }) => {
  const isAdmin = currentUser?.role === "admin";
  const [dash, setDash] = useState(null);
  const [dashLoad, setDashLoad] = useState(true);
  const [insights, setInsights] = useState("");
  const [insightLoad, setInsightLoad] = useState(false);
  const [gridWidth, setGridWidth] = useState(1200);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pinnedCharts, setPinnedCharts] = useState([]);
  const [pinnedKpis, setPinnedKpis] = useState([]);
  const [pinnedFilters, setPinnedFilters] = useState([]);
  const [dashboardTabs, setDashboardTabs] = useState([{ id: "main", name: "Main Dashboard" }]);
  const [activeTabId, setActiveTabId] = useState("main");
  const [filterOverrides, setFilterOverrides] = useState({});
  const [filterCol, setFilterCol] = useState("");
  const [filterVal, setFilterVal] = useState("");
  const [activeCrossFilter, setActiveCrossFilter] = useState(null);
  const [drilldownOpen, setDrilldownOpen] = useState(false);

  // Load GeoJSON Maps for ECharts
  useEffect(() => {
    const loadMaps = async () => {
      try {
        const [usaRes, worldRes, indiaRes] = await Promise.all([
          fetch('/maps/usa.json'),
          fetch('/maps/world.json'),
          fetch('/maps/india.json')
        ]);
        if (usaRes.ok) echarts.registerMap('usa', await usaRes.json());
        if (worldRes.ok) echarts.registerMap('world', await worldRes.json());
        if (indiaRes.ok) echarts.registerMap('india', await indiaRes.json());
      } catch (e) {
        console.error("Failed to load map data:", e);
      }
    };
    loadMaps();
  }, []);

  const handleChartClick = (chart, clickData) => {
    if (!clickData) return;
    
    const action = chart._onClickAction || chart.onClickAction || "filter";
    const target = chart._onClickTarget || chart.onClickTarget || "";

    if (action === "none") return;
    
    if (action === "navigate" && target) {
      setActiveTabId(target);
      return;
    }

    // Default: Filter
    let clickedVal = null;
    const colToFilter = chart.dimension || chart.config?.dimension || chart.xKey || "label";

    if (clickData.activePayload && clickData.activePayload.length > 0) {
      clickedVal = clickData.activePayload[0].payload[colToFilter] || clickData.activePayload[0].payload["_l"];
    } else if (clickData.payload) {
      clickedVal = clickData.payload[colToFilter] || clickData.payload["_l"] || clickData.name;
    } else if (clickData[colToFilter] !== undefined) {
      clickedVal = clickData[colToFilter];
    } else if (clickData.activeLabel) {
      clickedVal = clickData.activeLabel;
    }

    if (clickedVal !== undefined && clickedVal !== null) {
      if (activeCrossFilter?.col === colToFilter && activeCrossFilter?.val === String(clickedVal)) {
        setActiveCrossFilter(null);
      } else {
        setActiveCrossFilter({ col: colToFilter, val: String(clickedVal) });
      }
    }
  };
  const [advancedFilters, setAdvancedFilters] = useState({});
  const [parameters, setParameters] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullScreen = () => {
    const elem = document.getElementById("dashboard-content");
    if (!document.fullscreenElement && elem) {
      elem.requestFullscreen().catch(err => console.log(err));
      setIsFullscreen(true);
    } else if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);
  const [columnParamValues, setColumnParamValues] = useState({});
  const [parameterValues, setParameterValues] = useState({});
  const [draftParameterValues, setDraftParameterValues] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState("");
  const [parameterModalOpen, setParameterModalOpen] = useState(false);
  const [chartOverrides, setChartOverrides] = useState({});
  const [editingChart, setEditingChart] = useState(null);
  const [activeSettingCategory, setActiveSettingCategory] = useState(null);
  const [activeKpiSettingCategory, setActiveKpiSettingCategory] = useState(null);

  // Time Trend UI State
  const [trendMenuAnchor, setTrendMenuAnchor] = useState(null);
  const [trendActiveChart, setTrendActiveChart] = useState(null);
  const [trendLoadingId, setTrendLoadingId] = useState(null);
  const [editForm, setEditForm] = useState({ title: "", type: "" });
  const [headerConfig, setHeaderConfig] = useState({});
  const [editingHeader, setEditingHeader] = useState(false);
  const [editHeaderForm, setEditHeaderForm] = useState({});
  const [kpiOverrides, setKpiOverrides] = useState({});
  const [editingKpi, setEditingKpi] = useState(null);
  const [editKpiForm, setEditKpiForm] = useState({ label: "" });
  const [editingFilter, setEditingFilter] = useState(null);
  const [editFilterForm, setEditFilterForm] = useState({ col: "" });
  const [deletedChartIds, setDeletedChartIds] = useState(new Set());
  const [deletedKpiLabels, setDeletedKpiLabels] = useState(new Set());
  const [builderOpen, setBuilderOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState({ file: null, data: null, insert: null, analysis: null });
  const handleMenuClick = (menu, e) => setMenuAnchorEl(prev => ({ ...prev, [menu]: e.currentTarget }));
  const handleMenuClose = (menu) => setMenuAnchorEl(prev => ({ ...prev, [menu]: null }));
  const [layoutRestored, setLayoutRestored] = useState(false);
  const [paletteName, setPaletteName] = useState("DashForge");
  const [labelAlign, setLabelAlign] = useState("horizontal");
  const [narrative, setNarrative] = useState("");
  const [narrativeLoad, setNarrativeLoad] = useState(false);
  const [narrativeOpen, setNarrativeOpen] = useState(false);
  const [dictionaryOpen, setDictionaryOpen] = useState(false);
  const [dashImages, setDashImages] = useState([]);
  const [availableFilterValues, setAvailableFilterValues] = useState({});
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [configLoaded, setConfigLoaded] = useState(false);
  const [isSaved, setIsSaved] = useState(file?.is_saved ?? true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameVal, setRenameVal] = useState(file?.filename || "");
  const [renameLoading, setRenameLoading] = useState(false);

  const handleRenameDashboard = async () => {
    if (!renameVal.trim()) return;
    setRenameLoading(true);
    try {
      const { data } = await axios.put(`${API}/dashboards/${fileId}/rename`, { filename: renameVal });
      setIsSaved(true);
      onUpdateFile({ ...file, filename: data.filename, is_saved: true });
      setRenameOpen(false);
    } catch (e) {
      alert("Failed to rename dashboard.");
    } finally {
      setRenameLoading(false);
    }
  };

  const handleSaveDashboard = async () => {
    setSaveLoading(true);
    try {
      await axios.post(`${API}/dashboards/${fileId}/save`);
      setIsSaved(true);
      onUpdateFile({ ...file, is_saved: true });
    } catch (e) {
      alert("Failed to save dashboard.");
    } finally {
      setSaveLoading(false);
    }
  };

  const loadFilterValues = async (col) => {
    if (!col) return;
    try {
      const { data } = await axios.get(`${API}/column_values/${fileId}/${col}`);
      setAvailableFilterValues(prev => ({ ...prev, [col]: data.values || [] }));
    } catch (e) {
      console.error("Failed to load filter values", e);
    }
  };

  const handleFilterValueChange = (col, val) => {
    let nextVals = typeof val === 'string' ? val.split(',') : val;
    if (nextVals.includes("SELECT_ALL")) {
      const allVals = availableFilterValues[col] || [];
      const current = editForm.filters?.[col] || [];
      if (current.length === allVals.length) {
        nextVals = [];
      } else {
        nextVals = [...allVals];
      }
    }
    setEditForm(f => ({
      ...f,
      filters: { ...f.filters, [col]: nextVals }
    }));
  };

  const handleRemoveFilter = (col) => {
    const nextFilters = { ...editForm.filters };
    delete nextFilters[col];
    setEditForm(f => ({ ...f, filters: nextFilters }));
  };

  const handleAddFilterColumn = (col) => {
    if (!col) return;
    setEditForm(f => ({
      ...f,
      filters: { ...(f.filters || {}), [col]: [] }
    }));
    loadFilterValues(col);
  };

  const isAllSelected = (col) => {
    const selected = editForm.filters?.[col] || [];
    const all = availableFilterValues[col] || [];
    return all.length > 0 && selected.length === all.length;
  };

  const isIndeterminate = (col) => {
    const selected = editForm.filters?.[col] || [];
    const all = availableFilterValues[col] || [];
    return selected.length > 0 && selected.length < all.length;
  };

  const handleKpiFilterValueChange = (col, val) => {
    let nextVals = typeof val === 'string' ? val.split(',') : val;
    if (nextVals.includes("SELECT_ALL")) {
      const allVals = availableFilterValues[col] || [];
      const current = editKpiForm.advancedFilters?.[col] || [];
      if (current.length === allVals.length) {
        nextVals = [];
      } else {
        nextVals = [...allVals];
      }
    }
    setEditKpiForm(f => ({
      ...f,
      filters: { ...f.filters, [col]: nextVals }
    }));
  };

  const handleRemoveKpiFilter = (col) => {
    const nextFilters = { ...editKpiForm.advancedFilters };
    delete nextFilters[col];
    setEditKpiForm(f => ({ ...f, filters: nextFilters }));
  };

  const handleAddKpiFilterColumn = (col) => {
    if (!col) return;
    setEditKpiForm(f => ({
      ...f,
      filters: { ...(f.filters || {}), [col]: [] }
    }));
    loadFilterValues(col);
  };

  const isKpiAllSelected = (col) => {
    const selected = editKpiForm.advancedFilters?.[col] || [];
    const all = availableFilterValues[col] || [];
    return all.length > 0 && selected.length === all.length;
  };

  const isKpiIndeterminate = (col) => {
    const selected = editKpiForm.advancedFilters?.[col] || [];
    const all = availableFilterValues[col] || [];
    return selected.length > 0 && selected.length < all.length;
  };

  useEffect(() => {
    if (!parameters || parameters.length === 0) return;
    parameters.forEach(p => {
      if (p.type === 'Dataset Column' && p.column && !columnParamValues[p.column]) {
        axios.get(`${API}/column_values/${fileId}/${p.column}`)
          .then(({ data }) => {
            if (data && data.values) {
              setColumnParamValues(prev => ({ ...prev, [p.column]: data.values }));
            }
          })
          .catch(err => console.error("Failed to fetch column values", err));
      }
    });
  }, [parameters, fileId]);

  useEffect(() => {
    if (editingChart) {
      setEditError("");
      setEditLoading(false);
      const cfg = editingChart.config || {};
      const currentFilters = editingChart._filters || cfg.filters || editingChart.filters || {};
      Object.keys(currentFilters).forEach(col => {
        loadFilterValues(col);
      });
    }
  }, [editingChart]);
  const [speaking, setSpeaking] = useState(false);
  const [layouts, setLayouts] = useState(null);
  const activeSlots = buildSlots(PALETTES[paletteName] || PALETTES["DashForge"]);
  const activePieColors = PALETTES[paletteName] || PALETTES["DashForge"];
  const gridRef = useRef(null);
  const lk = file?.layout_key || fileId; // stable key for layout storage

  useEffect(() => {
    if (!lk) return;
    const loadConfig = async () => {
      try {
        const { data } = await axios.get(`${API}/dashboard/${lk}/config`);
        if (data && data.config) {
          const cfg = data.config;
          setPinnedCharts(cfg.pinnedCharts || []);
          setChartOverrides(cfg.chartOverrides || {});
          setKpiOverrides(cfg.kpiOverrides || {});
          setPinnedKpis(cfg.pinnedKpis || []);
          setPinnedFilters(cfg.pinnedFilters || []);
          setFilterOverrides(cfg.filterOverrides || {});
          setDeletedChartIds(new Set(cfg.deletedChartIds || []));
          setDeletedKpiLabels(new Set(cfg.deletedKpiLabels || []));
          if (cfg.dashboardTabs && cfg.dashboardTabs.length > 0) setDashboardTabs(cfg.dashboardTabs);
          if (cfg.activeTabId) setActiveTabId(cfg.activeTabId);
          if (cfg.paletteName && PALETTES[cfg.paletteName]) setPaletteName(cfg.paletteName);
          if (cfg.labelAlign) setLabelAlign(cfg.labelAlign);
          if (cfg.layouts) {
            const migratedLayouts = {};
            Object.keys(cfg.layouts).forEach(brk => {
              migratedLayouts[brk] = cfg.layouts[brk].map(l => {
                const match = l.i.match(/^kpi_\d+_(.+)$/);
                if (match) return { ...l, i: match[1] };
                return l;
              });
            });
            setLayouts(migratedLayouts);
          }
          setDashImages(cfg.dashImages || []);
          setParameters(cfg.parameters || []);
          setParameterValues(cfg.parameterValues || {});
          setDraftParameterValues(cfg.parameterValues || {});
          setHeaderConfig(cfg.headerConfig || {});
          const localPinnedCharts = JSON.parse(localStorage.getItem(`pinned_charts_${lk}`) || "[]");
          const mergedPinnedCharts = [...(cfg.pinnedCharts || [])];
          for (const lc of localPinnedCharts) {
            if (!mergedPinnedCharts.find(bc => bc.id === lc.id)) mergedPinnedCharts.push(lc);
          }
          setPinnedCharts(mergedPinnedCharts);

          const localPinnedKpis = JSON.parse(localStorage.getItem(`pinned_kpis_${lk}`) || "[]");
          const mergedPinnedKpis = [...(cfg.pinnedKpis || [])];
          for (const lkpi of localPinnedKpis) {
            if (!mergedPinnedKpis.find(bk => bk.id === lkpi.id)) mergedPinnedKpis.push(lkpi);
          }
          setPinnedKpis(mergedPinnedKpis);

          setPinnedFilters(cfg.pinnedFilters || []);

          const hasLayout = (mergedPinnedCharts.length > 0) || (mergedPinnedKpis.length > 0)
            || (Object.keys(cfg.chartOverrides || {}).length > 0) || (cfg.deletedChartIds?.length > 0)
            || (cfg.pinnedFilters?.length > 0);
          if (hasLayout) setLayoutRestored(true);
        } else {
          // If no backend config, try to load from localStorage as a one-time migration fallback
          try {
            const storedPins = JSON.parse(localStorage.getItem(`pinned_charts_${lk}`) || "[]");
            setPinnedCharts(storedPins);
            const storedOverrides = JSON.parse(localStorage.getItem(`chart_overrides_${lk}`) || "{}");
            setChartOverrides(storedOverrides);
            const storedKpis = JSON.parse(localStorage.getItem(`kpi_overrides_${lk}`) || "{}");
            setKpiOverrides(storedKpis);
            const storedPinnedKpis = JSON.parse(localStorage.getItem(`pinned_kpis_${lk}`) || "[]");
            setPinnedKpis(storedPinnedKpis);
            const storedFilters = JSON.parse(localStorage.getItem(`pinned_filters_${lk}`) || "[]");
            setPinnedFilters(storedFilters);
            const storedFilterOverrides = JSON.parse(localStorage.getItem(`filter_overrides_${lk}`) || "{}");
            setFilterOverrides(storedFilterOverrides);
            const dCharts = JSON.parse(localStorage.getItem(`deleted_charts_${lk}`) || "[]");
            setDeletedChartIds(new Set(dCharts));
            const dKpis = JSON.parse(localStorage.getItem(`deleted_kpis_${lk}`) || "[]");
            setDeletedKpiLabels(new Set(dKpis));
            const pal = localStorage.getItem(`palette_${lk}`);
            if (pal && PALETTES[pal]) setPaletteName(pal);
            const align = localStorage.getItem(`label_align_${lk}`);
            if (align) setLabelAlign(align);
            const storedLayouts = JSON.parse(localStorage.getItem(`layouts_${lk}`) || "null");
            if (storedLayouts) {
              const migratedLayouts = {};
              Object.keys(storedLayouts).forEach(brk => {
                migratedLayouts[brk] = storedLayouts[brk].map(l => {
                  const match = l.i.match(/^kpi_\d+_(.+)$/);
                  if (match) return { ...l, i: match[1] };
                  return l;
                });
              });
              setLayouts(migratedLayouts);
            }
            const storedImages = JSON.parse(localStorage.getItem(`dash_images_${lk}`) || "[]");
            setDashImages(storedImages);
            const storedParams = JSON.parse(localStorage.getItem(`parameter_values_${lk}`) || "{}");
            setParameterValues(storedParams);
            setDraftParameterValues(storedParams);
            const storedHeaderConfig = JSON.parse(localStorage.getItem(`header_config_${lk}`) || "{}");
            setHeaderConfig(storedHeaderConfig);

            const hasLayout = storedPins.length > 0 || storedPinnedKpis.length > 0 || storedFilters.length > 0
              || Object.keys(storedOverrides).length > 0 || dCharts.length > 0;
            if (hasLayout) setLayoutRestored(true);
          } catch {
            setPinnedCharts([]);
            setChartOverrides({});
            setKpiOverrides({});
            setPinnedKpis([]);
            setPinnedFilters([]);
            setFilterOverrides({});
            setDeletedChartIds(new Set());
            setDeletedKpiLabels(new Set());
          }
        }
      } catch (err) {
        console.error("Failed to load dashboard config", err);
      } finally {
        setConfigLoaded(true);
      }
    };
    loadConfig();
  }, [lk]);

  useEffect(() => {
    if (!isAdmin || !lk || !configLoaded) return;
    const timeoutId = setTimeout(() => {
      const config = {
        pinnedCharts,
        chartOverrides,
        kpiOverrides,
        pinnedKpis,
        pinnedFilters,
        filterOverrides,
        deletedChartIds: [...deletedChartIds],
        deletedKpiLabels: [...deletedKpiLabels],
        paletteName,
        labelAlign,
        layouts,
        dashImages,
        parameters,
        parameterValues,
        headerConfig,
        dashboardTabs,
        activeTabId
      };
      axios.post(`${API}/dashboard/${lk}/config`, { config })
        .catch(err => console.error("Failed to save dashboard config", err));
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [
    pinnedCharts, chartOverrides, kpiOverrides, pinnedKpis,
    pinnedFilters, filterOverrides,
    deletedChartIds, deletedKpiLabels, paletteName, labelAlign,
    layouts, dashImages, parameters, parameterValues, headerConfig,
    dashboardTabs, activeTabId, lk, isAdmin, configLoaded
  ]);

  const getChartConfig = (ch) => {
    const dim = ch.config?.dimension || (ch.id === "trend" ? (file?.date_columns?.[0] || "") : (ch.id === "monthly" ? (file?.date_columns?.[0] || "") : (ch.id?.startsWith("pie_") ? ch.id.replace("pie_", "") : (ch.id?.startsWith("bar_") ? ch.id.replace("bar_", "") : (ch.id === "hbar_fin" ? (file?.columns?.find(col => !file?.numeric_columns?.includes(col) && !file?.date_columns?.includes(col)) || "") : (ch.xKey || ""))))));
    const measure = ch.config?.measure || (ch.id === "trend" ? (file?.numeric_columns?.[0] || "") : (ch.id === "monthly" ? (file?.numeric_columns?.[0] || "") : (ch.id?.startsWith("pie_") ? ch.id.replace("pie_", "") : (ch.id?.startsWith("bar_") ? ch.id.replace("bar_", "") : (ch.id === "hbar_fin" ? (file?.numeric_columns?.[0] || "") : (ch.yKey || ""))))));
    return { dim, measure };
  };

  const handleTrendChange = async (newTrend) => {
    const chart = trendActiveChart;
    setTrendMenuAnchor(null);
    if (!chart || !newTrend) return;

    setTrendLoadingId(chart.id);

    const ov = chartOverrides[chart.id] || {};

    try {
      const { data } = await axios.post(`${API}/build_chart`, {
        file_id: fileId,
        dimension: ov.dimension || getChartConfig(chart).dim,
        measure: ov.measure || getChartConfig(chart).measure,
        agg: ov.agg || chart.config?.agg,
        chart_type: ov.type || chart.config?.type,
        group_by: ov.groupByCol || ov._groupByCol || chart.config?.group_by,
        filters: ov.filters || chart.config?.filters,
        advanced_filters: ov.advancedFilters || ov._advancedFilters || chart.advancedFilters || chart._advancedFilters || chart.config?.advancedFilters || chart.config?._advancedFilters,
        parameters: parameterValues,
        time_grouping: newTrend,
        limit: ov.limit || chart.config?.limit,
        label_col: ov.labelCol || chart.config?.label_col
      });

      if (data.error) {
        alert(data.error);
        return;
      }

      const nextChartOverrides = { ...chartOverrides };
      nextChartOverrides[chart.id] = {
        ...(nextChartOverrides[chart.id] || {}),
        data: data.data,
        xKey: data.xKey || "label",
        yKey: data.yKey || "value",
        _timeGrouping: newTrend
      };
      setChartOverrides(nextChartOverrides);
      localStorage.setItem(`chart_overrides_${lk}`, JSON.stringify(nextChartOverrides));
    } catch (e) {
      console.error(e);
      alert("Failed to update time trend.");
    } finally {
      setTrendLoadingId(null);
    }
  };


  useEffect(() => {
    if (!gridRef.current) return;
    let timeoutId = null;
    const ro = new ResizeObserver((entries) => {
      if (entries[0]) {
        const newWidth = entries[0].contentRect.width;
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          setGridWidth(prev => {
            if (Math.abs(prev - newWidth) > 25) {
              return newWidth;
            }
            return prev;
          });
        }, 100);
      }
    });
    ro.observe(gridRef.current);
    return () => {
      ro.disconnect();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [dashLoad]);
  useEffect(() => {
    if (!fileId || file?.doc_mode) {
      setDashLoad(false);
      return;
    }

    setDashLoad(true);

    axios.get(`${API}/dashboard/${fileId}`, {
      params: {
        filter_col: filterCol || null,
        filter_val: filterVal || null,
        cross_filter_col: activeCrossFilter?.col || null,
        cross_filter_val: activeCrossFilter?.val || null
      }
    })
      .then(({ data }) => setDash(data))
      .catch((err) => console.error(err))
      .finally(() => setDashLoad(false));

  }, [fileId, file, filterCol, filterVal, activeCrossFilter]);

  const prevCrossFilterRef = useRef(activeCrossFilter);
  const initialDataFetchedRef = useRef(false);

  useEffect(() => {
    if (!configLoaded) return;

    setChartOverrides(prev => {
      const next = { ...prev };
      let changed = false;
      for (const id in next) {
        if (next[id].data) { delete next[id].data; changed = true; }
      }
      return changed ? next : prev;
    });
    setKpiOverrides(prev => {
      const next = { ...prev };
      let changed = false;
      for (const id in next) {
        if (next[id].total !== undefined) { delete next[id].total; changed = true; }
        if (next[id].avg !== undefined) { delete next[id].avg; changed = true; }
        if (next[id]._raw_total !== undefined) { delete next[id]._raw_total; changed = true; }
        if (next[id]._raw_avg !== undefined) { delete next[id]._raw_avg; changed = true; }
      }
      return changed ? next : prev;
    });

    const wasCrossFiltered = prevCrossFilterRef.current !== null;
    const isCrossFiltered = activeCrossFilter !== null;
    const isInitialFetch = !initialDataFetchedRef.current;

    if ((isInitialFetch || isCrossFiltered || wasCrossFiltered) && (pinnedCharts.length > 0 || pinnedKpis.length > 0)) {
      initialDataFetchedRef.current = true;
      const updatePins = async () => {
        setRefreshing(true);
        try {
          const newChartOverrides = {};
          const newKpiOverrides = {};
          const promises = [];

          for (const chart of pinnedCharts) {
            if (chart.type === 'TextWidget' || chart.type === 'IframeWidget') continue;
            const ov = chartOverrides[chart.id] || chart;
            const config = getChartConfig(chart);
            const agg = ov.agg || chart.config?.agg || (chart.id?.startsWith("pie_") || chart.id?.startsWith("bar_") || chart.id === "monthly" ? "COUNT" : "SUM");
            if (config.dim && config.measure) {
              promises.push(
                axios.post(`${API}/build_chart`, {
                  file_id: fileId,
                  dimension: ov.dimension || config.dim,
                  measure: ov.measure || config.measure,
                  agg: agg,
                  chart_type: ov.type || chart.config?.type || "bar",
                  group_by: ov.groupByCol || ov._groupByCol || chart.config?.group_by,
                  filters: { ...(ov.filters || chart.config?.filters || {}), ...(activeCrossFilter ? { [activeCrossFilter.col]: activeCrossFilter.val } : {}) },
                  advanced_filters: ov.advancedFilters || ov._advancedFilters || chart.advancedFilters || chart._advancedFilters || chart.config?.advancedFilters || chart.config?._advancedFilters,
                  parameters: parameterValues,
                  time_grouping: ov.timeGrouping || chart.config?.time_grouping || "none",
                  limit: ov.limit || chart.config?.limit
                }).then(({ data }) => {
                  if (data && data.data) {
                    newChartOverrides[chart.id] = { ...ov, data: data.data, error: null };
                  }
                }).catch(e => console.error(e))
              );
            }
          }

          for (const kpi of pinnedKpis) {
            const kpiKey = kpi._origLabel || kpi.label;
            const ov = kpiOverrides[kpiKey] || kpi;

            const isFallback = !kpi.config;
            const fallbackAgg = kpiKey.toLowerCase().includes("total") || kpiKey.toLowerCase().includes("count") || kpiKey.toLowerCase().includes("patients") ? "COUNT" : "SUM";
            const agg = ov.agg || kpi.agg || kpi.config?.agg || fallbackAgg;
            const meas = ov.measure || kpi.measure || kpi.config?.measure || (agg === "COUNT" ? "" : "");

            promises.push(
              axios.post(`${API}/build_kpi`, {
                file_id: fileId,
                measure: meas,
                agg: agg,
                label: ov.label || kpi.label,
                filters: { ...(ov.filters || kpi.config?.filters || {}), ...(activeCrossFilter ? { [activeCrossFilter.col]: activeCrossFilter.val } : {}) },
                advanced_filters: ov.advancedFilters || ov._advancedFilters || kpi.advancedFilters || kpi._advancedFilters || kpi.config?.advancedFilters || kpi.config?._advancedFilters,
                parameters: parameterValues
              }).then(({ data }) => {
                if (data && data.total) {
                  newKpiOverrides[kpiKey] = { ...ov, total: data.total, avg: data.avg, _raw_total: data._raw_total, _raw_avg: data._raw_avg, error: null };
                }
              }).catch(e => {
                newKpiOverrides[kpiKey] = { ...ov, total: "ERR", error: e?.response?.data?.detail || e.message };
                console.error("KPI Error:", e);
              })
            );
          }

          await Promise.allSettled(promises);

          if (Object.keys(newChartOverrides).length > 0) {
            setChartOverrides(prev => ({ ...prev, ...newChartOverrides }));
          }
          if (Object.keys(newKpiOverrides).length > 0) {
            setKpiOverrides(prev => ({ ...prev, ...newKpiOverrides }));
          }
        } finally {
          setRefreshing(false);
        }
      };
      updatePins();
    }
    prevCrossFilterRef.current = activeCrossFilter;
  }, [activeCrossFilter, configLoaded]);

  const loadInsights = async () => {
    setInsightLoad(true);
    try {
      const { data } = await axios.get(`${API}/summary/${fileId}`);
      setInsights(data.ai_insights);
    } catch { setInsights("Could not load insights."); }
    finally { setInsightLoad(false); }
  };

  const charts = [...(dash?.charts || []), ...pinnedCharts]
    .filter(c => !deletedChartIds.has(c.id) && (c.tabId || "main") === activeTabId)
    .map(c => {
      const ov = chartOverrides[c.id] || {};
      return {
        ...c,
        title: ov.title || c.title,
        type: ov.type || c.type,
        data: ov.data || c.data,
        xKey: ov.xKey || c.xKey || "label",
        yKey: ov.yKey || c.yKey || "value",
        _colorOverride: ov.color || null,
        _headerColor: ov.headerColor || null,
        _textColor: ov.textColor || null,
        _bgColor: ov.bgColor || null,
        _conditionalFormats: ov._conditionalFormats || null,
        _labelAlign: ov.labelAlign || null,
        _showLabels: !!ov.showLabels,
        _sortOrder: ov.sortOrder || "",
        _showGrid: ov.showGrid !== false,
        _showXAxis: ov.showXAxis ?? ov._showXAxis ?? true,
        _showYAxis: ov.showYAxis ?? ov._showYAxis ?? true,
        _titleAlign: ov.titleAlign || "",
        _hidePill: !!ov.hidePill,
        _hasMargin: ov.hasMargin !== false,
        _hasPadding: ov.hasPadding !== false,
        _roundedCorners: ov.roundedCorners !== false,
        _hasBorder: ov.hasBorder !== false,
        _borderTop: ov.borderTop ?? (ov.hasBorder !== false),
        _borderRight: ov.borderRight ?? (ov.hasBorder !== false),
        _borderBottom: ov.borderBottom ?? (ov.hasBorder !== false),
        _borderLeft: ov.borderLeft ?? (ov.hasBorder !== false),
        _borderColor: ov.borderColor || "",
        _gapTop: ov.gapTop ?? 0,
        _gapRight: ov.gapRight ?? 0,
        _gapBottom: ov.gapBottom ?? 0,
        _gapLeft: ov.gapLeft ?? 0,
        _innerRadius: ov.innerRadius !== undefined ? ov.innerRadius : null,
        _outerRadius: ov.outerRadius !== undefined ? ov.outerRadius : null,
        _pieColors: ov.pieColors || null,
        _pieLabelMode: ov.pieLabelMode || null,
        _filters: ov.filters || c.filters || (c.config ? c.config.filters : null),
        _limit: ov.limit || c.limit || (c.config ? c.config.limit : null),
        _fontFamily: ov.fontFamily || null,
        _fontSize: ov.fontSize || null,
        _fontWeight: ov.fontWeight || null,
        _fontStyle: ov.fontStyle || null,
        _bodyFontFamily: ov.bodyFontFamily || null,
        _bodyFontSize: ov.bodyFontSize || null,
        _bodyFontWeight: ov.bodyFontWeight || null,
        _bodyFontStyle: ov.bodyFontStyle || null,
        _numberFormat: ov.numberFormat || "auto",
        _secondaryNumberFormat: ov._secondaryNumberFormat || ov.secondaryNumberFormat || "auto",
        _rowHeight: ov.rowHeight !== undefined ? ov.rowHeight : null,
        _barWidth: ov.barWidth !== undefined ? ov.barWidth : null,
        _advancedFilters: ov.advancedFilters || ov._advancedFilters || c.advancedFilters || c._advancedFilters || (c.config ? c.config.advancedFilters : null),
      };
    });
  const kpis = [...(dash?.kpis || []), ...pinnedKpis]
    .filter(k => !deletedKpiLabels.has(k._origLabel || k.label) && (k.tabId || "main") === activeTabId)
    .map(k => {
      const ov = kpiOverrides[k._origLabel || k.label] || {};
      return {
        ...k,
        _origLabel: k._origLabel || k.label,
        label: ov.label || k.label,
        total: ov.total !== undefined ? ov.total : k.total,
        avg: ov.avg !== undefined ? ov.avg : k.avg,
        min: ov.min !== undefined ? ov.min : k.min,
        max: ov.max !== undefined ? ov.max : k.max,
        count: ov.count !== undefined ? ov.count : k.count,
        count_dist: ov.count_dist !== undefined ? ov.count_dist : k.count_dist,
        _raw_avg: ov._raw_avg !== undefined ? ov._raw_avg : k._raw_avg,
        _raw_total: ov._raw_total !== undefined ? ov._raw_total : k._raw_total,
        _raw_min: ov._raw_min !== undefined ? ov._raw_min : k._raw_min,
        _raw_max: ov._raw_max !== undefined ? ov._raw_max : k._raw_max,
        value: ov.value !== undefined ? ov.value : k.value,
        config: ov.config || k.config,
        _filters: ov.filters || k.filters || (k.config ? k.config.filters : null),
        _accentColor: ov.accentColor || null,
        _bgColor: ov.bgColor || null,
        _conditionalFormats: ov._conditionalFormats || null,
        _textAlign: ov.textAlign || null,
        _valueFontSize: ov.valueFontSize || null,
        _subtitle: ov.subtitle || "",
        _showStats: ov.showStats !== false,
        _labelColor: ov.labelColor || null,
        _valueColor: ov.valueColor || null,
        _numberFormat: ov.numberFormat || "auto",
        _secondaryNumberFormat: ov._secondaryNumberFormat || ov.secondaryNumberFormat || "auto",
        _hasMargin: ov.hasMargin !== false,
        _hasPadding: ov.hasPadding !== false,
        _roundedCorners: ov.roundedCorners !== false,
        _hasBorder: ov.hasBorder !== false,
        _advancedFilters: ov.advancedFilters || ov._advancedFilters || k.advancedFilters || k._advancedFilters || (k.config ? k.config.advancedFilters : null),
        _borderTop: ov.borderTop ?? (ov.hasBorder !== false),
        _borderRight: ov.borderRight ?? (ov.hasBorder !== false),
        _borderBottom: ov.borderBottom ?? (ov.hasBorder !== false),
        _borderLeft: ov.borderLeft ?? (ov.hasBorder !== false),
        _borderColor: ov.borderColor || "",
        _gapTop: ov.gapTop ?? 0,
        _gapRight: ov.gapRight ?? 0,
        _gapBottom: ov.gapBottom ?? 0,
        _gapLeft: ov.gapLeft ?? 0,
        _icon: ov.icon || "None",
        _fontFamily: ov.fontFamily || null,
        _fontSize: ov.fontSize || null,
        _fontWeight: ov.fontWeight || null,
        _fontStyle: ov.fontStyle || null,
        _bodyFontFamily: ov.bodyFontFamily || null,
        _bodyFontSize: ov.bodyFontSize || null,
        _bodyFontWeight: ov.bodyFontWeight || null,
        _bodyFontStyle: ov.bodyFontStyle || null,
        _onClickAction: ov.onClickAction || null,
        _onClickTarget: ov.onClickTarget || null,
      };
    });

  const deleteChart = (chart) => {
    const next = new Set([...deletedChartIds, chart.id]);
    setDeletedChartIds(next);
    localStorage.setItem(`deleted_charts_${lk}`, JSON.stringify([...next]));
  };

  const deleteKpi = (kpi) => {
    const key = kpi._origLabel || kpi.label;
    const next = new Set([...deletedKpiLabels, key]);
    setDeletedKpiLabels(next);
    localStorage.setItem(`deleted_kpis_${lk}`, JSON.stringify([...next]));
  };

  const generateLayout = () => {
    const layout = [];

    kpis.forEach((k, i) => {
      layout.push({
        i: k._origLabel || k.id || k.label || `kpi_${i}`,
        x: (i % 3) * 4,
        y: Math.floor(i / 3) * 3,
        w: 4, h: 3, minW: 2, minH: 2
      });
    });

    let curY = Math.ceil(kpis.length / 3) * 3;
    let leftY = curY;
    let rightY = curY;

    charts.forEach((c) => {
      let h = c.type === "hbar" ? Math.max(6, Math.ceil((c.data.length * 38 + 60) / 80)) : 6;
      let w = 6;
      let x, y;

      if (leftY <= rightY) {
        x = 0;
        y = leftY;
        leftY += h;
      } else {
        x = 6;
        y = rightY;
        rightY += h;
      }

      layout.push({
        i: c.id,
        x, y,
        w, h,
        minW: 3, minH: 3
      });
    });

    return layout;
  };

  const handleAddStandaloneImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const imgId = `img_${Date.now()}`;
      const newImg = { id: imgId, src: ev.target.result, x: 100, y: 100, w: 120, h: 120, tabId: activeTabId };
      const nextImages = [...dashImages, newImg];
      setDashImages(nextImages);
      localStorage.setItem(`dash_images_${lk}`, JSON.stringify(nextImages));
    };
    reader.readAsDataURL(file);
    e.target.value = null;
  };

  const handleUpdateDashImage = (imgId, updates) => {
    const nextImages = dashImages.map(img => img.id === imgId ? { ...img, ...updates } : img);
    setDashImages(nextImages);
    localStorage.setItem(`dash_images_${lk}`, JSON.stringify(nextImages));
  };

  const deleteDashImage = (imgId) => {
    const nextImages = dashImages.filter(img => img.id !== imgId);
    setDashImages(nextImages);
    localStorage.setItem(`dash_images_${lk}`, JSON.stringify(nextImages));
  };

  const exportMQDB = async () => {
    handleMenuClose('file');
    setDownloadingPdf(true);
    try {
      const ui_config = {
        layouts, kpi_overrides: kpiOverrides, chart_overrides: chartOverrides,
        dash_images: dashImages, deleted_kpis: [...deletedKpiLabels],
        deleted_charts: [...deletedChartIds], header_config: headerConfig,
        pinned_kpis: pinnedKpis, pinned_charts: pinnedCharts,
        filter_overrides: filterOverrides, parameters, parameter_values: parameterValues
      };
      const response = await axios.post(`${API}/dashboards/${fileId}/export`, {
        ui_config
      }, { responseType: 'blob' });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${file?.filename || 'dashboard'}.mqdb`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      console.error("MQDB Export failed", e);
      alert("Failed to export .mqdb file.");
    }
    setDownloadingPdf(false);
  };

  const exportPDF = async () => {
    handleMenuClose('file');
    setDownloadingPdf(true);
    const element = document.getElementById("dashboard-content");
    if (!element) { setDownloadingPdf(false); return; }
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: "#F4F2FF" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = (canvas.height * pdfW) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
      pdf.save(`${file?.filename}_Dashboard_Report.pdf`);
    } catch (e) {
      console.error("PDF Export failed", e);
    }
    setDownloadingPdf(false);
  };

  const refreshWidgetsWithParameters = async (newParamValues) => {
    setRefreshing(true);
    try {
      // Check charts
      const nextChartOverrides = { ...chartOverrides };
      let chartUpdated = false;
      const allCharts = [...(dash?.charts || []), ...pinnedCharts];
      for (const chart of allCharts) {
        const ov = chartOverrides[chart.id] || chart;
        const advFilters = ov.advancedFilters || ov._advancedFilters || chart.advancedFilters || chart._advancedFilters || chart.config?.advancedFilters || chart.config?._advancedFilters;
        console.log(`Chart ${chart.id} advFilters: ${JSON.stringify(advFilters || 'EMPTY')}`);
        if (advFilters && advFilters.length > 0) {
          try {
            const { data } = await axios.post(`${API}/build_chart`, {
              file_id: fileId,
              dimension: ov.dimension || getChartConfig(chart).dim,
              measure: ov.measure || getChartConfig(chart).measure,
              agg: ov.agg || chart.config?.agg,
              chart_type: ov.type || chart.config?.type,
              group_by: ov.groupByCol || ov._groupByCol || chart.config?.group_by,
              filters: { ...(ov.filters || chart.config?.filters || {}), ...(activeCrossFilter ? { [activeCrossFilter.col]: activeCrossFilter.val } : {}) },
              advanced_filters: advFilters,
              parameters: newParamValues,
              time_grouping: ov.timeGrouping || chart.config?.time_grouping,
              limit: ov.limit || chart.config?.limit
            });
            if (data && data.data) {
              nextChartOverrides[chart.id] = { ...ov, data: data.data, error: null };
              chartUpdated = true;
            } else if (data && data.error) {
              nextChartOverrides[chart.id] = { ...ov, data: [], error: data.error };
              chartUpdated = true;
              setSnackbarMsg(`Chart ${ov.title || 'Error'}: ${data.error}`);
              setSnackbarOpen(true);
            }
          } catch (e) {
            console.error("Failed to refresh chart with parameter", e);
            setSnackbarMsg(`Chart error: ${e.response?.data?.detail || e.message}`);
            setSnackbarOpen(true);
          }
        }
      }
      if (chartUpdated) setChartOverrides(nextChartOverrides);

      // Check KPIs
      const nextKpiOverrides = { ...kpiOverrides };
      let kpiUpdated = false;
      const allKpis = [...(dash?.kpis || []), ...pinnedKpis];
      for (const kpi of allKpis) {
        const kpiKey = kpi._origLabel || kpi.label;
        const ov = kpiOverrides[kpiKey] || kpi;

        const measure = ov.config?.measure || ov.measure;
        const agg = ov.config?.agg || ov.agg;
        const label = ov.label || ov.config?.label;
        const advFilters = ov.advancedFilters || ov._advancedFilters || kpi.advancedFilters || kpi._advancedFilters || kpi.config?.advancedFilters || kpi.config?._advancedFilters;

        console.log(`KPI [${kpiKey}] measure=${measure}, advFilters=${JSON.stringify(advFilters || 'EMPTY')}, paramVals=${JSON.stringify(newParamValues)}`);

        if (advFilters && advFilters.length > 0 && measure) {
          try {
            const { data } = await axios.post(`${API}/build_kpi`, {
              file_id: fileId,
              measure: measure,
              label: label,
              agg: agg,
              filters: ov.filters || ov.config?.filters,
              advanced_filters: advFilters,
              parameters: newParamValues
            });
            if (data) {
              if (data.error) {
                nextKpiOverrides[kpiKey] = { ...ov, total: 0, avg: 0, min: 0, max: 0, count: 0, count_dist: 0, error: data.error };
                setSnackbarMsg(`KPI ${label || 'Error'}: ${data.error}`);
                setSnackbarOpen(true);
              } else {
                nextKpiOverrides[kpiKey] = { ...ov, ...data, label: ov.label || data.label, error: null };
              }
              kpiUpdated = true;
            }
          } catch (e) {
            console.error("Failed to refresh kpi with parameter", e);
            setSnackbarMsg(`KPI error: ${e.response?.data?.detail || e.message}`);
            setSnackbarOpen(true);
          }
        }
      }
      if (kpiUpdated) setKpiOverrides(nextKpiOverrides);

    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  };

  const processedLayouts = useMemo(() => Object.fromEntries(
    Object.entries(layouts || { lg: generateLayout(), md: generateLayout() }).map(([brk, arr]) => [
      brk,
      arr.map(l => ({ ...l, static: !isAdmin, isDraggable: isAdmin, isResizable: isAdmin, minW: 1 }))
    ])
  ), [layouts, isAdmin, kpis, charts]);

  return (
    <Stack spacing={3} sx={{ p: { xs: 2, sm: 3, md: 4 }, pb: 10 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Stack direction="row" spacing={1} flex={1}>
          <Typography fontSize={13} fontWeight={700} color="text.secondary" noWrap>
            {file?.title}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          {/* TOP MENU BAR (Tableau Style) */}
          <Box display="flex" gap={1} alignItems="center" bgcolor="rgba(255, 255, 255, 0.65)" borderRadius={2} px={1} py={0.5} sx={{ backdropFilter: "blur(12px)", boxShadow: "0 2px 12px rgba(0,0,0,0.03)", border: "1px solid rgba(255,255,255,0.4)" }}>
            {!dashLoad && (
              <>
                <Button size="small" onClick={(e) => handleMenuClick('file', e)} sx={{ color: '#333', textTransform: 'none', fontWeight: 600, minWidth: 'auto', px: 1.5, borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' } }}>File</Button>
                <Menu anchorEl={menuAnchorEl.file} open={Boolean(menuAnchorEl.file)} onClose={() => handleMenuClose('file')} PaperProps={{ sx: { borderRadius: 2, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', mt: 0.5, border: '1px solid #f0f0f0' } }}>
                  {isAdmin && (
                    <MenuItem onClick={() => { handleSaveDashboard(); handleMenuClose('file'); }} disabled={isSaved || saveLoading} sx={{ fontSize: 13, fontWeight: 600, px: 2, py: 1 }}>
                      {saveLoading ? <CircularProgress size={16} sx={{ mr: 1.5 }} /> : <Save sx={{ mr: 1.5, fontSize: 18, color: 'text.secondary' }} />} {isSaved ? "Saved" : "Save Dashboard"}
                    </MenuItem>
                  )}
                  <MenuItem onClick={exportPDF} disabled={downloadingPdf} sx={{ fontSize: 13, fontWeight: 600, px: 2, py: 1 }}>
                    {downloadingPdf ? <CircularProgress size={16} sx={{ mr: 1.5 }} /> : <Download sx={{ mr: 1.5, fontSize: 18, color: 'text.secondary' }} />} Export to PDF
                  </MenuItem>
                  <MenuItem onClick={exportMQDB} disabled={downloadingPdf} sx={{ fontSize: 13, fontWeight: 600, px: 2, py: 1 }}>
                    <Download sx={{ mr: 1.5, fontSize: 18, color: 'text.secondary' }} /> Export to .mqdb
                  </MenuItem>
                </Menu>
              </>
            )}

            {!dashLoad && (
              <IconButton size="small" onClick={toggleFullScreen} sx={{ color: '#333', ml: 1 }}>
                {isFullscreen ? <FullscreenExit fontSize="small" /> : <Fullscreen fontSize="small" />}
              </IconButton>
            )}

            {!dashLoad && (
              <>
                <Button size="small" onClick={(e) => handleMenuClick('data', e)} sx={{ color: '#333', textTransform: 'none', fontWeight: 600, minWidth: 'auto', px: 1.5, borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' } }}>Data</Button>
                <Menu anchorEl={menuAnchorEl.data} open={Boolean(menuAnchorEl.data)} onClose={() => handleMenuClose('data')} PaperProps={{ sx: { borderRadius: 2, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', mt: 0.5, border: '1px solid #f0f0f0' } }}>
                  <MenuItem onClick={() => { setDrilldownOpen(true); handleMenuClose('data'); }} sx={{ fontSize: 13, fontWeight: 600, px: 2, py: 1 }}>
                    <TableChart sx={{ mr: 1.5, fontSize: 18, color: 'text.secondary' }} /> View Raw Data (Drill Down)
                  </MenuItem>
                  <MenuItem onClick={() => { setDictionaryOpen(true); handleMenuClose('data'); }} sx={{ fontSize: 13, fontWeight: 600, px: 2, py: 1 }}>
                    <MenuBook sx={{ mr: 1.5, fontSize: 18, color: 'text.secondary' }} /> Data Dictionary
                  </MenuItem>
                  <MenuItem onClick={() => { setParameterModalOpen(true); handleMenuClose('data'); }} sx={{ fontSize: 13, fontWeight: 600, px: 2, py: 1 }}>
                    <Settings sx={{ mr: 1.5, fontSize: 18, color: 'text.secondary' }} /> Parameters
                  </MenuItem>
                </Menu>

              {isAdmin && (
                <>

                <Button size="small" onClick={(e) => handleMenuClick('insert', e)} sx={{ color: '#333', textTransform: 'none', fontWeight: 600, minWidth: 'auto', px: 1.5, borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' } }}>Insert</Button>
                <Menu anchorEl={menuAnchorEl.insert} open={Boolean(menuAnchorEl.insert)} onClose={() => handleMenuClose('insert')} PaperProps={{ sx: { borderRadius: 2, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', mt: 0.5, border: '1px solid #f0f0f0' } }}>
                  <MenuItem onClick={() => { setBuilderOpen(true); handleMenuClose('insert'); }} sx={{ fontSize: 13, fontWeight: 600, px: 2, py: 1 }}>
                    <AutoGraph sx={{ mr: 1.5, fontSize: 18, color: 'text.secondary' }} /> Build Custom Chart
                  </MenuItem>
                  <MenuItem onClick={() => {
                    handleMenuClose('insert');
                    const text = prompt("Enter text content for the widget:");
                    if (text) {
                      const newChart = {
                        id: `text_${Date.now()}`,
                        type: 'TextWidget',
                        title: 'Text Box',
                        text: text,
                        tabId: activeTabId,
                        layout: { w: 4, h: 4 }
                      };
                      const next = [...pinnedCharts, newChart];
                      setPinnedCharts(next);
                      localStorage.setItem(`pinned_charts_${lk}`, JSON.stringify(next));
                      setIsSaved(false);
                    }
                  }} sx={{ fontSize: 13, fontWeight: 600, px: 2, py: 1 }}>
                    <TextFields sx={{ mr: 1.5, fontSize: 18, color: 'text.secondary' }} /> Add Text Box
                  </MenuItem>
                  <MenuItem onClick={() => {
                    handleMenuClose('insert');
                    const url = prompt("Enter Web Page URL (e.g., https://example.com):");
                    if (url) {
                      const newChart = {
                        id: `iframe_${Date.now()}`,
                        type: 'IframeWidget',
                        title: 'Web Page',
                        url: url,
                        tabId: activeTabId,
                        layout: { w: 6, h: 8 }
                      };
                      const next = [...pinnedCharts, newChart];
                      setPinnedCharts(next);
                      localStorage.setItem(`pinned_charts_${lk}`, JSON.stringify(next));
                      setIsSaved(false);
                    }
                  }} sx={{ fontSize: 13, fontWeight: 600, px: 2, py: 1 }}>
                    <Language sx={{ mr: 1.5, fontSize: 18, color: 'text.secondary' }} /> Add Web Page
                  </MenuItem>
                  <MenuItem component="label" sx={{ fontSize: 13, fontWeight: 600, px: 2, py: 1 }}>
                    <ImageIcon sx={{ mr: 1.5, fontSize: 18, color: 'text.secondary' }} /> Add Floating Image
                    <input type="file" hidden accept="image/*" onChange={(e) => { handleAddStandaloneImage(e); handleMenuClose('insert'); }} />
                  </MenuItem>
                </Menu>

                <Button size="small" onClick={(e) => handleMenuClick('analysis', e)} sx={{ color: '#333', textTransform: 'none', fontWeight: 600, minWidth: 'auto', px: 1.5, borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' } }}>Analysis</Button>
                <Menu anchorEl={menuAnchorEl.analysis} open={Boolean(menuAnchorEl.analysis)} onClose={() => handleMenuClose('analysis')} PaperProps={{ sx: { borderRadius: 2, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', mt: 0.5, border: '1px solid #f0f0f0' } }}>
                  <MenuItem onClick={() => { setScheduleOpen(true); handleMenuClose('analysis'); }} sx={{ fontSize: 13, fontWeight: 600, px: 2, py: 1 }}>
                    <Schedule sx={{ mr: 1.5, fontSize: 18, color: 'text.secondary' }} /> Schedule Report
                  </MenuItem>
                  <MenuItem onClick={async () => {
                    handleMenuClose('analysis');
                    setNarrativeLoad(true);
                    try {
                      const { data } = await axios.get(`${API}/narrate/${fileId}`);
                      setNarrative(data.narrative);
                      setNarrativeOpen(true);
                    } catch { setNarrative("Could not generate narrative."); setNarrativeOpen(true); }
                    finally { setNarrativeLoad(false); }
                  }} disabled={narrativeLoad} sx={{ fontSize: 13, fontWeight: 600, px: 2, py: 1 }}>
                    {narrativeLoad ? <CircularProgress size={16} sx={{ mr: 1.5 }} /> : <RecordVoiceOver sx={{ mr: 1.5, fontSize: 18, color: 'text.secondary' }} />} AI Narrator
                  </MenuItem>
                </Menu>
                </>
              )}
              </>
            )}
          </Box>
        </Stack>
      </Stack>

      <Box id="dashboard-content" sx={{ display: 'flex', flexDirection: 'column', gap: 3, p: isFullscreen ? 3 : 0.5, bgcolor: isFullscreen ? '#F4F2FF' : 'transparent', overflowY: isFullscreen ? 'auto' : 'visible' }}>
        {activeCrossFilter && (
          <Box sx={{ display: 'flex', alignItems: 'center', p: 1.5, bgcolor: 'rgba(25, 118, 210, 0.08)', borderRadius: 2, border: '1px solid rgba(25, 118, 210, 0.2)' }}>
            <FilterAlt sx={{ color: 'primary.main', mr: 1, fontSize: 20 }} />
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main', mr: 2, flexGrow: 1 }}>
              Cross-Filtered by: {activeCrossFilter.col} = {activeCrossFilter.val}
            </Typography>
            <Button size="small" variant="outlined" disableElevation onClick={() => setDrilldownOpen(true)} sx={{ textTransform: 'none', borderRadius: 1.5, py: 0.25, mr: 1 }}>
              View Raw Data
            </Button>
            <Button size="small" variant="contained" disableElevation onClick={() => setActiveCrossFilter(null)} sx={{ textTransform: 'none', borderRadius: 1.5, py: 0.25 }}>
              Clear Filter
            </Button>
          </Box>
        )}
        {/* ── KPI Cards ── */}
        {!file?.doc_mode && (
          dashLoad ? (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              {[0, 1, 2, 3].map(i => (
                <Box key={i} sx={{
                  flex: 1, height: 110, borderRadius: 1,
                  background: "linear-gradient(90deg,#f5f5f5,#ececec,#f5f5f5)",
                  backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite",
                  "@keyframes shimmer": { "0%": { backgroundPosition: "200% 0" }, "100%": { backgroundPosition: "-200% 0" } }
                }} />
              ))}
            </Stack>
          ) : kpis.length === 0 && charts.length === 0 && activeTabId === "main" ? (
            /* Fallback metadata cards when no numeric data */
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              {[
                { label: "Total Rows", value: file.rows?.toLocaleString(), icon: <TableChart />, grad: activeSlots[0].grad },
                { label: "Columns", value: file.columns?.length, icon: <Bolt />, grad: activeSlots[1 % activeSlots.length].grad },
                { label: "Numeric Cols", value: file.numeric_columns?.length ?? 0, icon: <TrendingUp />, grad: activeSlots[2 % activeSlots.length].grad },
              ].map(({ label, value, icon, grad }) => (
                <Card key={label} elevation={0} sx={{ flex: 1, borderRadius: 1, border: "1.5px solid #f0f0f0" }}>
                  <CardContent sx={{ p: 2.5 }}>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <Avatar sx={{ width: 40, height: 40, background: grad }}>{icon}</Avatar>
                      <Stack>
                        <Typography fontSize={22} fontWeight={900}
                          sx={{ background: grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                          {value}
                        </Typography>
                        <Typography fontSize={11} color="text.secondary" fontWeight={700}
                          textTransform="uppercase" letterSpacing={0.8}>{label}</Typography>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          ) : null
        )}

        {/* ── AI Narrative Card ── */}
        {narrativeOpen && narrative && (
          <Card elevation={0} sx={{
            borderRadius: 2, overflow: "hidden",
            border: "2px solid rgba(108,99,255,0.2)",
            background: "linear-gradient(135deg,#FFFFFF 0%,#F0EEFF 100%)",
            animation: "floatUp 0.35s ease both",
            "@keyframes floatUp": { from: { opacity: 0, transform: "translateY(16px)" }, to: { opacity: 1, transform: "translateY(0)" } },
          }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <Avatar sx={{ width: 38, height: 38, background: "linear-gradient(135deg,#6C63FF,#9B94FF)", boxShadow: "0 4px 14px rgba(108,99,255,0.3)" }}>
                    <RecordVoiceOver sx={{ fontSize: 20, color: "#fff" }} />
                  </Avatar>
                  <Stack>
                    <Typography fontWeight={900} fontSize={14} color="#1E1B4B">AI Executive Summary</Typography>
                    <Typography fontSize={10} color="text.disabled">Generated by Groq AI · Click 🔊 to listen</Typography>
                  </Stack>
                </Stack>
                <Stack direction="row" spacing={0.5}>
                  <Tooltip title="Copy narrative">
                    <IconButton size="small" onClick={() => navigator.clipboard.writeText(narrative)}
                      sx={{ color: "#6C63FF", "&:hover": { background: "rgba(108,99,255,0.1)" } }}>
                      <ContentCopy sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={speaking ? "Stop reading" : "Read aloud"}>
                    <IconButton size="small" onClick={() => {
                      if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
                      const utter = new SpeechSynthesisUtterance(narrative);
                      utter.rate = 0.95; utter.pitch = 1;
                      utter.onend = () => setSpeaking(false);
                      window.speechSynthesis.speak(utter);
                      setSpeaking(true);
                    }} sx={{ color: speaking ? R : "#6C63FF", background: speaking ? `${R}12` : "transparent", "&:hover": { background: "rgba(108,99,255,0.1)" } }}>
                      <VolumeUp sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Close">
                    <IconButton size="small" onClick={() => { setNarrativeOpen(false); window.speechSynthesis.cancel(); setSpeaking(false); }}
                      sx={{ color: "text.disabled", "&:hover": { color: R } }}>
                      <Close sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
              <Typography fontSize={14} lineHeight={2} color="#333" whiteSpace="pre-wrap"
                sx={{ fontFamily: "'Nunito', serif" }}>
                {narrative}
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* ── Charts Grid ── */}
        {!file?.doc_mode && (
          <Stack spacing={1.5}>
            {activeTabId === "main" && (
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Avatar sx={{ width: 32, height: 32, background: `linear-gradient(135deg,${R},#e05555)` }}>
                  <AutoGraph sx={{ fontSize: 18 }} />
                </Avatar>
                <Typography fontWeight={900} fontSize={16}>Visual Summary</Typography>
              </Stack>
            )}

            {dashLoad && (
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
                {[0, 1, 2, 3].map(i => <Skeleton key={i} />)}
              </Box>
            )}

            {!dashLoad && (charts.length > 0 || kpis.length > 0 || dashImages.length > 0) && (
              <Box sx={{ mx: -1.5, minHeight: 400, position: "relative" }} ref={gridRef}>

                {/* Floating Images Layer */}
                {dashImages.filter(img => (img.tabId || "main") === activeTabId).map(img => (
                  <FloatingImage key={img.id} img={img} onUpdate={handleUpdateDashImage} onDelete={deleteDashImage} isAdmin={isAdmin} />
                ))}

                {/* --- Dashboard Header & Parameters --- */}
                <Box sx={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "flex-end", mb: 2, pb: 1.5,
                  borderBottom: headerConfig?.hideBorder ? "none" : "1.5px solid #eee",
                  backgroundColor: headerConfig?.bgColor || "transparent",
                  padding: headerConfig?.padding ? `${headerConfig.padding}px` : "0px",
                  borderRadius: headerConfig?.borderRadius ? `${headerConfig.borderRadius}px` : "0px",
                  position: "relative"
                }}>
                  <Box sx={{
                    flex: 1,
                    display: "flex",
                    justifyContent: headerConfig?.align === "center" ? "center" : (headerConfig?.align === "right" ? "flex-end" : "flex-start"),
                    alignItems: "center", position: "relative", "&:hover .edit-header-btn": { opacity: 1 },
                    pr: parameters.length > 0 && headerConfig?.align === "center" ? 0 : 2
                  }}>
                    {activeTabId !== "main" && headerConfig?.showBackButton !== false && (
                      <IconButton
                        sx={{
                          mr: 1.5,
                          color: headerConfig?.backButtonColor || headerConfig?.color || "#222",
                          transition: "transform 0.2s",
                          "&:hover": { transform: "translateX(-4px)" }
                        }}
                        onClick={() => setActiveTabId("main")}
                      >
                        {headerConfig?.backButtonIcon === "chevron" ? <ChevronLeft sx={{ fontSize: 28 }} /> :
                         headerConfig?.backButtonIcon === "keyboard" ? <KeyboardBackspace sx={{ fontSize: 24 }} /> :
                         <ArrowBack sx={{ fontSize: 24 }} />}
                      </IconButton>
                    )}
                    <Typography
                      variant="h4"
                      sx={{
                        color: headerConfig?.color || "#222",
                        pb: 0.5, pl: 0.5,
                        fontSize: headerConfig?.fontSize ? `${headerConfig.fontSize}px` : undefined,
                        fontWeight: headerConfig?.fontWeight || 900,
                        fontFamily: headerConfig?.fontFamily || "inherit",
                        fontStyle: headerConfig?.fontStyle || "normal",
                        textAlign: headerConfig?.align || "left"
                      }}
                    >
                      {headerConfig?.title || file?.title || file?.filename}
                    </Typography>
                    {isAdmin && (
                      <IconButton
                        className="edit-header-btn"
                        size="small"
                        sx={{ opacity: 0.3, transition: "opacity 0.2s", ml: 1, color: "text.secondary", "&:hover": { opacity: 1 } }}
                        onClick={() => {
                          setEditHeaderForm({
                            title: headerConfig?.title || file?.title || file?.filename || "",
                            color: headerConfig?.color || "",
                            bgColor: headerConfig?.bgColor || "",
                            fontSize: headerConfig?.fontSize || "",
                            fontWeight: headerConfig?.fontWeight || "",
                            fontFamily: headerConfig?.fontFamily || "",
                            fontStyle: headerConfig?.fontStyle || "",
                            align: headerConfig?.align || "left",
                            hideBorder: headerConfig?.hideBorder || false,
                          });
                          setEditingHeader(true);
                        }}
                      >
                        <Edit sx={{ fontSize: 16 }} />
                      </IconButton>
                    )}
                  </Box>

                  {parameters.length > 0 && (
                    <Stack direction="row" spacing={2} alignItems="flex-end">
                      {parameters.map(p => (
                        <Stack key={p.name} spacing={0.5}>
                          <Typography fontSize={11} fontWeight={700} color="text.secondary" sx={{ ml: 0.5 }}>{p.name}</Typography>
                          {p.type === 'Dataset Column' ? (
                            <select
                              style={{
                                padding: "6px 10px", border: "1.5px solid #ddd", borderRadius: "6px",
                                fontSize: "13px", fontWeight: "600", outline: "none", color: "#333",
                                fontFamily: "inherit", minWidth: "140px", background: "#fbfbfb"
                              }}
                              value={draftParameterValues[p.name] !== undefined ? draftParameterValues[p.name] : (parameterValues[p.name] || "")}
                              onChange={e => {
                                const newVal = e.target.value;
                                setDraftParameterValues(prev => ({ ...prev, [p.name]: newVal }));
                                const nextVals = { ...parameterValues, ...draftParameterValues, [p.name]: newVal };
                                setParameterValues(nextVals);
                                localStorage.setItem(`parameter_values_${lk}`, JSON.stringify(nextVals));
                                setIsSaved(false);
                                refreshWidgetsWithParameters(nextVals);
                              }}
                            >
                              <option value="">(All)</option>
                              {(columnParamValues[p.column] || []).map(val => (
                                <option key={val} value={val}>{val}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={p.type === 'Date' ? 'date' : 'text'}
                              style={{
                                padding: "6px 10px", border: "1.5px solid #ddd", borderRadius: "6px",
                                fontSize: "13px", fontWeight: "600", outline: "none", color: "#333",
                                fontFamily: "inherit", minWidth: "140px", background: "#fbfbfb"
                              }}
                              value={draftParameterValues[p.name] !== undefined ? draftParameterValues[p.name] : (parameterValues[p.name] || "")}
                              onChange={e => {
                                const newVal = e.target.value;
                                setDraftParameterValues(prev => ({ ...prev, [p.name]: newVal }));
                                if (p.type === 'Date') {
                                  const nextVals = { ...parameterValues, ...draftParameterValues, [p.name]: newVal };
                                  setParameterValues(nextVals);
                                  localStorage.setItem(`parameter_values_${lk}`, JSON.stringify(nextVals));
                                  setIsSaved(false);
                                  refreshWidgetsWithParameters(nextVals);
                                }
                              }}
                              onBlur={e => {
                                const newVal = e.target.value;
                                if (draftParameterValues[p.name] !== parameterValues[p.name]) {
                                  const nextVals = { ...parameterValues, ...draftParameterValues, [p.name]: newVal };
                                  setParameterValues(nextVals);
                                  localStorage.setItem(`parameter_values_${lk}`, JSON.stringify(nextVals));
                                  setIsSaved(false);
                                  refreshWidgetsWithParameters(nextVals);
                                }
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  const newVal = e.target.value;
                                  if (draftParameterValues[p.name] !== parameterValues[p.name]) {
                                    const nextVals = { ...parameterValues, ...draftParameterValues, [p.name]: newVal };
                                    setParameterValues(nextVals);
                                    localStorage.setItem(`parameter_values_${lk}`, JSON.stringify(nextVals));
                                    setIsSaved(false);
                                    refreshWidgetsWithParameters(nextVals);
                                  }
                                }
                              }}
                            />
                          )}
                        </Stack>
                      ))}
                    </Stack>
                  )}
                </Box>

                {/* Dashboard Tabs */}
                <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2, display: 'flex', alignItems: 'center' }}>
                  <Tabs
                    value={activeTabId}
                    onChange={(e, val) => setActiveTabId(val)}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{
                      minHeight: 36,
                      "& .MuiTab-root": {
                        minHeight: 36,
                        py: 0.5,
                        px: 2,
                        textTransform: 'none',
                        fontWeight: 700,
                        fontSize: 13,
                      }
                    }}
                  >
                    {dashboardTabs.map(tab => (
                      <Tab 
                        key={tab.id} 
                        value={tab.id} 
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <span>{tab.name}</span>
                            {isAdmin && (
                              <Stack direction="row" spacing={0} alignItems="center">
                                <IconButton
                                  size="small"
                                  sx={{ p: 0.25, opacity: 0.5, "&:hover": { opacity: 1, color: "primary.main" } }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const newName = prompt("Rename Tab:", tab.name);
                                    if (newName) {
                                      setDashboardTabs(prev => prev.map(t => t.id === tab.id ? { ...t, name: newName } : t));
                                      setIsSaved(false);
                                    }
                                  }}
                                >
                                  <Edit sx={{ fontSize: 13 }} />
                                </IconButton>
                                {tab.id !== "main" && (
                                  <IconButton
                                    size="small"
                                    sx={{ p: 0.25, opacity: 0.5, "&:hover": { opacity: 1, color: "error.main" } }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (window.confirm(`Are you sure you want to delete the tab "${tab.name}"? All KPIs, charts, and images on this tab will be permanently removed.`)) {
                                        setDashboardTabs(prev => prev.filter(t => t.id !== tab.id));
                                        if (activeTabId === tab.id) setActiveTabId("main");
                                        setPinnedCharts(prev => prev.filter(c => (c.tabId || "main") !== tab.id));
                                        setPinnedKpis(prev => prev.filter(k => (k.tabId || "main") !== tab.id));
                                        setDashImages(prev => prev.filter(i => (i.tabId || "main") !== tab.id));
                                        setIsSaved(false);
                                      }
                                    }}
                                  >
                                    <Close sx={{ fontSize: 14 }} />
                                  </IconButton>
                                )}
                              </Stack>
                            )}
                          </Box>
                        }
                        onDoubleClick={() => {
                          if (isAdmin) {
                            const newName = prompt("Rename Tab:", tab.name);
                            if (newName) {
                              setDashboardTabs(prev => prev.map(t => t.id === tab.id ? { ...t, name: newName } : t));
                              setIsSaved(false);
                            }
                          }
                        }}
                      />
                    ))}
                  </Tabs>
                  {isAdmin && (
                    <IconButton 
                      size="small" 
                      onClick={() => {
                        const newId = 'tab_' + Date.now();
                        setDashboardTabs(prev => [...prev, { id: newId, name: "New Tab" }]);
                        setActiveTabId(newId);
                        setIsSaved(false);
                      }}
                      sx={{ ml: 1 }}
                    >
                      <Add sx={{ fontSize: 18 }} />
                    </IconButton>
                  )}
                </Box>

                <Box sx={{ position: "relative" }}>
                  {refreshing && (
                    <Box sx={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, display: "flex", justifyContent: "center", alignItems: "center", background: "rgba(255,255,255,0.4)", backdropFilter: "blur(2px)", borderRadius: 2 }}>
                      <Stack alignItems="center" spacing={2}>
                        <CircularProgress size={40} />
                        <Typography fontWeight={600} color="text.secondary">Updating Dashboard...</Typography>
                      </Stack>
                    </Box>
                  )}
                  <Box sx={{ opacity: refreshing ? 0.5 : 1, pointerEvents: refreshing ? "none" : "auto", transition: "opacity 0.2s" }}>
                    <ResponsiveGridLayout
                      key={activeTabId}
                      width={gridWidth || 1200}
                      className="layout"
                      layouts={processedLayouts}
                      breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                      cols={{ lg: 12, md: 12, sm: 6, xs: 1, xxs: 1 }}
                      rowHeight={75}
                      margin={[0, 0]}
                      draggableHandle={isAdmin ? ".drag-handle" : ".none"}
                      isResizable={isAdmin === true}
                      isDraggable={isAdmin === true}
                      onLayoutChange={(curr, all) => {
                        if (isAdmin) {
                          setLayouts(prev => {
                            if (!prev) return all;
                            const newLayouts = { ...prev };
                            const currentTabIds = new Set([
                              ...kpis.map((kpi, idx) => kpi._origLabel || kpi.id || kpi.label || `kpi_${idx}`),
                              ...charts.map(c => c.id)
                            ]);
                            Object.keys(all).forEach(brk => {
                              const currBrkArr = all[brk] || [];
                              const prevBrkArr = prev[brk] || [];
                              const currTabItems = currBrkArr.filter(c => currentTabIds.has(c.i));
                              const itemsInOtherTabs = prevBrkArr.filter(p => !currentTabIds.has(p.i));
                              newLayouts[brk] = [...currTabItems, ...itemsInOtherTabs];
                            });
                            
                            if (JSON.stringify(prev) === JSON.stringify(newLayouts)) {
                              return prev;
                            }
                            return newLayouts;
                          });
                          setIsSaved(false);
                        }
                      }}
                    >
                      {kpis.map((kpi, idx) => (
                        <div key={kpi._origLabel || kpi.id || kpi.label || `kpi_${idx}`}
                          style={{ padding: `${kpi._gapTop || 0}px ${kpi._gapRight || 0}px ${kpi._gapBottom || 0}px ${kpi._gapLeft || 0}px` }}>
                          <Box sx={{ height: "100%", '& > div': { height: "100%" } }}>
                            <KpiCard kpi={kpi} idx={idx} slots={activeSlots} isAdmin={isAdmin}
                              onKpiClick={(k) => {
                                const action = k._onClickAction || k.onClickAction;
                                const target = k._onClickTarget || k.onClickTarget;
                                console.log("KPI Clicked!", { action, target, kpi: k });
                                if (action === "navigate" && target) {
                                  setActiveTabId(target);
                                }
                              }}
                              onEdit={(k) => {
                                setEditingKpi(k);
                                const ov = kpiOverrides[k._origLabel] || {};
                                setEditKpiForm({
                                  label: k.label,
                                  accentColor: ov.accentColor || "",
                                  bgColor: ov.bgColor || "#FFFDF5",
                                  textAlign: ov.textAlign || "center",
                                  valueFontSize: ov.valueFontSize || 32,
                                  subtitle: ov.subtitle || "",
                                  showStats: ov.showStats !== false,
                                  hasMargin: ov.hasMargin !== false,
                                  labelColor: ov.labelColor || "#333",
                                  valueColor: ov.valueColor || "",
                                  numberFormat: ov.numberFormat || "auto",
                                  hasPadding: ov.hasPadding !== false,
                                  roundedCorners: ov.roundedCorners !== false,
                                  hasBorder: ov.hasBorder !== false,
                                  borderTop: ov.borderTop ?? (ov.hasBorder !== false),
                                  borderRight: ov.borderRight ?? (ov.hasBorder !== false),
                                  borderBottom: ov.borderBottom ?? (ov.hasBorder !== false),
                                  borderLeft: ov.borderLeft ?? (ov.hasBorder !== false),
                                  gapTop: ov.gapTop ?? 0,
                                  gapRight: ov.gapRight ?? 0,
                                  gapBottom: ov.gapBottom ?? 0,
                                  gapLeft: ov.gapLeft ?? 0,
                                  icon: ov.icon || "None",
                                  fontFamily: ov.fontFamily || "",
                                  fontSize: ov.fontSize || 13,
                                  fontWeight: ov.fontWeight || "normal",
                                  fontStyle: ov.fontStyle || "normal",
                                  bodyFontFamily: ov.bodyFontFamily || "",
                                  bodyFontSize: ov.bodyFontSize || 10,
                                  bodyFontWeight: ov.bodyFontWeight || "normal",
                                  bodyFontStyle: ov.bodyFontStyle || "normal",
                                  filters: ov.filters || k._filters || {},
                                  config: ov.config || k.config || null,
                                  advancedFilters: ov.advancedFilters || k.advancedFilters || k._advancedFilters || k.config?.advancedFilters || k.config?._advancedFilters || [],
                                  conditionalFormats: ov.conditionalFormats || k.conditionalFormats || k._conditionalFormats || k.config?.conditionalFormats || k.config?._conditionalFormats || [],
                                  onClickAction: ov.onClickAction || k.onClickAction || k._onClickAction || "none",
                                  onClickTarget: ov.onClickTarget || k.onClickTarget || k._onClickTarget || "",
                                });
                              }}
                              onDelete={deleteKpi}
                            />
                          </Box>
                        </div>
                      ))}
                      {charts.map((c, chartIdx) => (
                        <div key={c.id}
                          style={{ padding: `${c._gapTop || 0}px ${c._gapRight || 0}px ${c._gapBottom || 0}px ${c._gapLeft || 0}px` }}>
                          <Box sx={{ height: "100%", '& > div': { height: "100%" } }}>
                            <ChartCard chart={c} idx={chartIdx}
                              slots={activeSlots} pieColors={activePieColors} labelAlign={labelAlign} isAdmin={isAdmin}
                              isDateCol={file?.date_columns?.includes(getChartConfig(c).dim) || dash?.date_cols?.includes(getChartConfig(c).dim)}
                              trendLoadingId={trendLoadingId}
                              onChartClick={handleChartClick}
                              onTrendClick={(e) => {
                                setTrendActiveChart(c);
                                setTrendMenuAnchor(e.currentTarget);
                              }}

                              onEdit={(ch) => {
                                setEditingChart(ch);
                                setEditForm({
                                  title: ch.title, type: ch.type,
                                  text: ch.text || "",
                                  url: ch.url || "",
                                  color: ch._colorOverride || "",
                                  headerColor: ch._headerColor || "",
                                  textColor: ch._textColor || "",
                                  bgColor: ch._bgColor || "",
                                  labelAlign: ch._labelAlign || "",
                                  showLabels: ch._showLabels || false,
                                  sortOrder: ch._sortOrder || "",
                                  showGrid: ch._showGrid !== false,
                                  showXAxis: ch._showXAxis !== false,
                                  showYAxis: ch._showYAxis !== false,
                                  titleAlign: ch._titleAlign || "left",
                                  hidePill: ch._hidePill || false,
                                  hasMargin: ch._hasMargin !== false,
                                  hasPadding: ch._hasPadding !== false,
                                  roundedCorners: ch._roundedCorners !== false,
                                  hasBorder: ch._hasBorder !== false,
                                  borderTop: ch._borderTop ?? (ch._hasBorder !== false),
                                  borderRight: ch._borderRight ?? (ch._hasBorder !== false),
                                  borderBottom: ch._borderBottom ?? (ch._hasBorder !== false),
                                  borderLeft: ch._borderLeft ?? (ch._hasBorder !== false),
                                  gapTop: ch._gapTop ?? 0,
                                  gapRight: ch._gapRight ?? 0,
                                  gapBottom: ch._gapBottom ?? 0,
                                  gapLeft: ch._gapLeft ?? 0,
                                  innerRadius: ch._innerRadius !== null && ch._innerRadius !== undefined ? ch._innerRadius : 60,
                                  outerRadius: ch._outerRadius !== null && ch._outerRadius !== undefined ? ch._outerRadius : 90,
                                  pieColors: ch._pieColors || {},
                                  groupByCol: ch.groupByCol || ch._groupByCol || ch.config?.group_by || "",
                                  dimension: ch.config?.dimension || (ch.id === "trend" ? (file.date_columns?.[0] || "") : (ch.id === "monthly" ? (file.date_columns?.[0] || "") : (ch.id.startsWith("pie_") ? ch.id.replace("pie_", "") : (ch.id.startsWith("bar_") ? ch.id.replace("bar_", "") : (ch.id === "hbar_fin" ? (file.columns?.find(col => !file.numeric_columns?.includes(col) && !file.date_columns?.includes(col)) || "") : (ch.xKey || "")))))),
                                  measure: ch.config?.measure || (ch.id === "trend" ? (file.numeric_columns?.[0] || "") : (ch.id === "monthly" ? (file.date_columns?.[0] || "") : (ch.id.startsWith("pie_") ? ch.id.replace("pie_", "") : (ch.id.startsWith("bar_") ? ch.id.replace("bar_", "") : (ch.id === "hbar_fin" ? (file.numeric_columns?.[0] || "") : (ch.yKey || "")))))),
                                  agg: ch.config?.agg || (ch.id === "trend" ? "SUM" : (ch.id === "monthly" ? "COUNT" : (ch.id.startsWith("pie_") ? "COUNT" : (ch.id.startsWith("bar_") ? "COUNT" : (ch.id === "hbar_fin" ? "SUM" : "COUNT"))))),
                                  timeGrouping: ch.config?.time_grouping || (ch.id === "monthly" ? "month" : "none"),
                                  filters: ch._filters || ch.config?.filters || ch.filters || {},
                                  limit: ch._limit || ch.config?.limit || ch.limit || (ch.type === "pie" ? 10 : 40),
                                  showTooltip: ch._showTooltip !== false,
                                  tooltipBgColor: ch._tooltipBgColor || "rgba(255, 255, 255, 0.95)",
                                  tooltipTextColor: ch._tooltipTextColor || "#333333",
                                  tooltipBorderColor: ch._tooltipBorderColor || "#dddddd",
                                  targetLineValue: ch._targetLineValue || "",
                                  targetLineLabel: ch._targetLineLabel || "",
                                  targetLineColor: ch._targetLineColor || "#ff4757",
                                  fontFamily: ch._fontFamily || "",
                                  fontSize: ch._fontSize || 13,
                                  fontWeight: ch._fontWeight || "normal",
                                  fontStyle: ch._fontStyle || "normal",
                                  bodyFontFamily: ch._bodyFontFamily || "",
                                  bodyFontSize: ch._bodyFontSize || 10,
                                  bodyFontWeight: ch._bodyFontWeight || "normal",
                                  bodyFontStyle: ch._bodyFontStyle || "normal",
                                  rowHeight: ch._rowHeight !== null && ch._rowHeight !== undefined ? ch._rowHeight : (ch.type === "hbar" ? 38 : 10),
                                  barWidth: ch._barWidth !== null && ch._barWidth !== undefined ? ch._barWidth : (ch.type === "hbar" ? 22 : 40),
                                  labelCol: ch.config?.label_col || "",
                                  pieLabelMode: ch._pieLabelMode || "percentage",
                                  secondaryNumberFormat: ch._secondaryNumberFormat || "auto",
                                  advancedFilters: ch.advancedFilters || ch._advancedFilters || ch.config?.advancedFilters || ch.config?._advancedFilters || [],
                                  conditionalFormats: ch._conditionalFormats || ch.config?.conditionalFormats || [],
                                  onClickAction: ch._onClickAction || ch.onClickAction || "filter",
                                  onClickTarget: ch._onClickTarget || ch.onClickTarget || "",
                                });
                              }} onDelete={deleteChart} />
                          </Box>
                        </div>
                      ))}
                    </ResponsiveGridLayout>
                  </Box>
                </Box>
              </Box>
            )}

            {!dashLoad && charts.length === 0 && kpis.length === 0 && dashImages.length === 0 && (
              <Card elevation={0} sx={{
                borderRadius: 1,
                border: "1.5px dashed rgba(197,38,38,0.2)", p: 5, textAlign: "center"
              }}>
                <Typography color="text.secondary" fontSize={13}>
                  No charts could be generated. Try the <strong>Ask AI</strong> tab.
                </Typography>
              </Card>
            )}
          </Stack>
        )}
      </Box>

      {/* ── Column chips ── */}
      <Card elevation={0} sx={{ borderRadius: 1, border: "1.5px solid rgba(197,38,38,0.1)" }}>
        <CardContent sx={{ p: 2.5 }}>
          <Typography fontWeight={800} fontSize={11} textTransform="uppercase"
            letterSpacing={1.1} color="text.secondary" mb={1.5}>🏷️ Detected Columns</Typography>
          <Stack direction="row" flexWrap="wrap" gap={0.8}>
            {file.columns?.map(col => {
              const isNum = file.numeric_columns?.includes(col);
              const isDate = file.date_columns?.includes(col);
              const orig = file.rename_map
                ? Object.entries(file.rename_map).find(([, v]) => v === col)?.[0] : null;
              return (
                <Tooltip key={col} title={orig ? `Renamed from: ${orig}` : ""} placement="top">
                  <Chip label={col} size="small" sx={{
                    background: orig ? (isNum ? "#F0FFF0" : isDate ? "#F0FFF8" : "#F0FFF4")
                      : isNum ? "#FFF5F5" : isDate ? "#EFF6FF" : "#F5F5F8",
                    color: isNum ? T.red : isDate ? T.blue : "#666",
                    fontWeight: 700, fontSize: 11,
                    border: `1.5px solid ${orig ? "#2E7D3240" : isNum ? "#E5393528" : isDate ? "#1565C028" : "rgba(0,0,0,0.07)"}`,
                  }} />
                </Tooltip>
              );
            })}
          </Stack>
          <Stack direction="row" spacing={2} mt={1.2} flexWrap="wrap" gap={0.8}>
            {[{ c: T.red, l: "Numeric" }, { c: T.blue, l: "Date" }, { c: "#999", l: "Text" }, { c: "#2E7D32", l: "Auto-renamed" }]
              .map(({ c, l }) => (
                <Stack key={l} direction="row" alignItems="center" spacing={0.6}>
                  <Box sx={{ width: 7, height: 7, borderRadius: "5%", background: c }} />
                  <Typography fontSize={11} color="text.secondary">{l}</Typography>
                </Stack>
              ))}
          </Stack>
        </CardContent>
      </Card>

      {/* ── Data Preview ── */}
      <Card elevation={0} sx={{ borderRadius: 1, border: "1.5px solid rgba(197,38,38,0.1)" }}>
        <CardContent sx={{ p: 2.5 }}>
          <Typography fontWeight={800} fontSize={11} textTransform="uppercase"
            letterSpacing={1.1} color="text.secondary" mb={1.5}>👀 Data Preview — First 5 Rows</Typography>
          <TableContainer sx={{ borderRadius: 2, border: "1.5px solid rgba(197,38,38,0.08)" }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ background: "#FFF5F5" }}>
                  {file.columns?.map(col => (
                    <TableCell key={col} sx={{ whiteSpace: "nowrap", fontWeight: 800, fontSize: 12, color: R }}>
                      {col}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {file.preview?.map((row, i) => (
                  <TableRow key={i} sx={{ "&:last-child td": { border: 0 }, "&:hover": { background: "#FFF5F5" } }}>
                    {file.columns?.map(col => (
                      <TableCell key={col} sx={{ whiteSpace: "nowrap", fontSize: 12 }}>
                        {String(row[col] ?? "—")}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* ── AI Insights ── */}
      <Card elevation={0} sx={{
        borderRadius: 1,
        border: "2px solid rgba(197,38,38,0.14)",
        background: "linear-gradient(135deg,#FFFEFE,#FFF5F5)"
      }}>
        <CardContent sx={{ p: 2.5 }}>
          <Stack direction={{ xs: "column", sm: "row" }}
            alignItems={{ sm: "center" }} justifyContent="space-between" spacing={2} mb={2}>
            <Stack>
              <Typography fontWeight={800} fontSize={11} textTransform="uppercase"
                letterSpacing={1.1} color="text.secondary">✨ AI Key Insights</Typography>
              <Typography fontSize={12} color="text.secondary">Powered by Groq AI</Typography>
            </Stack>
            <Button variant="contained" onClick={loadInsights} disabled={insightLoad}
              startIcon={insightLoad
                ? <CircularProgress size={16} sx={{ color: "#fff" }} />
                : <Lightbulb />}
              sx={{
                background: `linear-gradient(135deg,${R},#FF7043)`, borderRadius: 50, px: 3,
                "&:hover": { background: `linear-gradient(135deg,#C62828,${R})` }
              }}>
              {insightLoad ? "Analysing…" : "Generate Insights"}
            </Button>
          </Stack>

          {insightLoad && (
            <LinearProgress sx={{
              borderRadius: 4, mb: 2,
              "& .MuiLinearProgress-bar": { background: `linear-gradient(90deg,${R},#FF7043)` }
            }} />
          )}

          {insights
            ? <Typography fontSize={14} lineHeight={1.9} sx={{ whiteSpace: "pre-wrap" }}>{insights}</Typography>
            : !insightLoad && (
              <Stack alignItems="center" spacing={1.5} py={3}>
                <Avatar sx={{ width: 48, height: 48, background: "#FFF5F5" }}>
                  <Psychology sx={{ color: R, fontSize: 26 }} />
                </Avatar>
                <Typography color="text.secondary" fontSize={13} textAlign="center">
                  Click "Generate Insights" for AI-powered analysis 🤖
                </Typography>
              </Stack>
            )
          }
        </CardContent>
      </Card>

      {/* Editing Dialog */}
      <Drawer anchor="right" PaperProps={{ sx: { width: { xs: "100vw", sm: 500 }, bgcolor: "#f4f6f8" } }} open={!!editingChart} onClose={() => { setEditingChart(null); setActiveSettingCategory(null); }}>
        <Box sx={{ p: 2, px: 3, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #eaeaea", bgcolor: "#fff", fontWeight: 800, fontSize: 16 }}>Customize Chart<IconButton size="small" onClick={() => { setEditingChart(null); setActiveSettingCategory(null); }}><Close /></IconButton></Box>
        <Box sx={{ display: "flex", flexDirection: "column", p: 3, overflowY: "auto", flex: 1, overflowX: "hidden" }}>
<Box sx={{ mb: 3 }}>
  <TextField
    label="Chart Title"
    fullWidth
    variant="outlined"
    value={editForm.title || ""}
    onChange={(e) => setEditForm(f => ({ ...f, title: e.target.value }))}
    sx={{ background: "#fff", "& input": { fontWeight: 800, fontSize: 16 } }}
  />
</Box>
{editForm.type === "TextWidget" && (
  <Box sx={{ mb: 3 }}>
    <TextField
      label="Text Content"
      fullWidth
      multiline
      minRows={4}
      variant="outlined"
      value={editForm.text || ""}
      onChange={(e) => setEditForm(f => ({ ...f, text: e.target.value }))}
      sx={{ background: "#fff" }}
    />
  </Box>
)}
{editForm.type === "IframeWidget" && (
  <Box sx={{ mb: 3 }}>
    <TextField
      label="Web Page URL"
      fullWidth
      variant="outlined"
      value={editForm.url || ""}
      onChange={(e) => setEditForm(f => ({ ...f, url: e.target.value }))}
      placeholder="https://example.com"
      sx={{ background: "#fff" }}
    />
  </Box>
)}
{activeSettingCategory === null ? (
  <Grid container spacing={3}>
    
    <Grid item xs={12} sm={6}>
      <CardActionArea onClick={() => setActiveSettingCategory('DATA')} sx={{ height: "100%", borderRadius: 2 }}>
        <Card sx={{ p: 2.5, height: "100%", borderRadius: 2, border: "1px solid #eaeaea", boxShadow: "0px 4px 12px rgba(0,0,0,0.03)", display: "flex", alignItems: "center", gap: 1.5 }}>
          <TableChart sx={{ fontSize: 26, color: "text.secondary" }} />
          <Typography fontSize={14} fontWeight={800} textTransform="uppercase" color="text.secondary" letterSpacing={1}>Data Configuration</Typography>
        </Card>
      </CardActionArea>
    </Grid>
    <Grid item xs={12} sm={6}>
      <CardActionArea onClick={() => setActiveSettingCategory('FILTERS')} sx={{ height: "100%", borderRadius: 2 }}>
        <Card sx={{ p: 2.5, height: "100%", borderRadius: 2, border: "1px solid #eaeaea", boxShadow: "0px 4px 12px rgba(0,0,0,0.03)", display: "flex", alignItems: "center", gap: 1.5 }}>
          <FilterAlt sx={{ fontSize: 26, color: "text.secondary" }} />
          <Typography fontSize={14} fontWeight={800} textTransform="uppercase" color="text.secondary" letterSpacing={1}>Filters & Parameters</Typography>
        </Card>
      </CardActionArea>
    </Grid>
    <Grid item xs={12} sm={6}>
      <CardActionArea onClick={() => setActiveSettingCategory('COLORS')} sx={{ height: "100%", borderRadius: 2 }}>
        <Card sx={{ p: 2.5, height: "100%", borderRadius: 2, border: "1px solid #eaeaea", boxShadow: "0px 4px 12px rgba(0,0,0,0.03)", display: "flex", alignItems: "center", gap: 1.5 }}>
          <Palette sx={{ fontSize: 26, color: "text.secondary" }} />
          <Typography fontSize={14} fontWeight={800} textTransform="uppercase" color="text.secondary" letterSpacing={1}>Colors & Theming</Typography>
        </Card>
      </CardActionArea>
    </Grid>
    <Grid item xs={12} sm={6}>
      <CardActionArea onClick={() => setActiveSettingCategory('ANALYTICS')} sx={{ height: "100%", borderRadius: 2 }}>
        <Card sx={{ p: 2.5, height: "100%", borderRadius: 2, border: "1px solid #eaeaea", boxShadow: "0px 4px 12px rgba(0,0,0,0.03)", display: "flex", alignItems: "center", gap: 1.5 }}>
          <TrendingUp sx={{ fontSize: 26, color: "text.secondary" }} />
          <Typography fontSize={14} fontWeight={800} textTransform="uppercase" color="text.secondary" letterSpacing={1}>Analytics</Typography>
        </Card>
      </CardActionArea>
    </Grid>
    <Grid item xs={12} sm={6}>
      <CardActionArea onClick={() => setActiveSettingCategory('AXES')} sx={{ height: "100%", borderRadius: 2 }}>
        <Card sx={{ p: 2.5, height: "100%", borderRadius: 2, border: "1px solid #eaeaea", boxShadow: "0px 4px 12px rgba(0,0,0,0.03)", display: "flex", alignItems: "center", gap: 1.5 }}>
          <GridOn sx={{ fontSize: 26, color: "text.secondary" }} />
          <Typography fontSize={14} fontWeight={800} textTransform="uppercase" color="text.secondary" letterSpacing={1}>Axes & Grid</Typography>
        </Card>
      </CardActionArea>
    </Grid>
    <Grid item xs={12} sm={6}>
      <CardActionArea onClick={() => setActiveSettingCategory('TYPOGRAPHY')} sx={{ height: "100%", borderRadius: 2 }}>
        <Card sx={{ p: 2.5, height: "100%", borderRadius: 2, border: "1px solid #eaeaea", boxShadow: "0px 4px 12px rgba(0,0,0,0.03)", display: "flex", alignItems: "center", gap: 1.5 }}>
          <TextFields sx={{ fontSize: 26, color: "text.secondary" }} />
          <Typography fontSize={14} fontWeight={800} textTransform="uppercase" color="text.secondary" letterSpacing={1}>Typography & Spacing</Typography>
        </Card>
      </CardActionArea>
    </Grid>
    <Grid item xs={12} sm={6}>
      <CardActionArea onClick={() => setActiveSettingCategory('CONDITIONAL')} sx={{ height: "100%", borderRadius: 2 }}>
        <Card sx={{ p: 2.5, height: "100%", borderRadius: 2, border: "1px solid #eaeaea", boxShadow: "0px 4px 12px rgba(0,0,0,0.03)", display: "flex", alignItems: "center", gap: 1.5 }}>
          <FormatColorFill sx={{ fontSize: 26, color: "text.secondary" }} />
          <Typography fontSize={14} fontWeight={800} textTransform="uppercase" color="text.secondary" letterSpacing={1}>Conditional Formatting</Typography>
        </Card>
      </CardActionArea>
    </Grid>
  </Grid>
) : (
<Box>
  <Button startIcon={<ArrowBack />} onClick={() => setActiveSettingCategory(null)} sx={{ mb: 2, fontWeight: 700, textTransform: "none", color: "text.secondary" }}>Back to Categories</Button>
  <Card sx={{ borderRadius: 2, border: "1px solid #eaeaea", boxShadow: "0px 4px 12px rgba(0,0,0,0.03)" }}>
    {activeSettingCategory === 'DATA' && (
      <Box sx={{ display: "flex", flexDirection: "column" }}>
        <Box sx={{ p: 2, borderBottom: "1px solid #eaeaea", display: "flex", alignItems: "center", gap: 1.5, bgcolor: "#fafafa" }}>
          <TableChart sx={{ fontSize: 20, color: "text.secondary" }} />
          <Typography fontSize={14} fontWeight={800} textTransform="uppercase" color="text.secondary" letterSpacing={1}>Data Configuration</Typography>
        </Box>
        <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 2.5 }}>
<FormControl fullWidth size="small">

            <Select

              value={editForm.type}

              onChange={(e) => setEditForm(f => ({ ...f, type: e.target.value }))}

            >

              <MenuItem value="bar">Bar Chart</MenuItem>

              <MenuItem value="hbar">Horizontal Bar Chart</MenuItem>

              <MenuItem value="line">Line Chart</MenuItem>

              <MenuItem value="area">Area Chart</MenuItem>

              <MenuItem value="pie">Pie Chart (Donut)</MenuItem>

              <MenuItem value="treemap">🔲 Tree Map</MenuItem>

              <MenuItem value="progress">📊 Progress Bar Table</MenuItem>
              
              <MenuItem value="map">🗺️ Map (Choropleth)</MenuItem>

            </Select>

          </FormControl>

          

          {editForm.type === "map" && (
            <FormControl fullWidth size="small" sx={{ mt: 1 }}>
              <InputLabel sx={{ fontSize: 13 }}>Map Region</InputLabel>
              <Select
                value={editForm.mapRegion || "usa"}
                onChange={(e) => setEditForm({ ...editForm, mapRegion: e.target.value })}
                label="Map Region"
                sx={{ fontSize: 13 }}
              >
                <MenuItem value="usa">USA</MenuItem>
                <MenuItem value="world">World</MenuItem>
                <MenuItem value="india">India</MenuItem>
              </Select>
            </FormControl>
          )}

          {["bar", "hbar", "line", "area"].includes(editForm.type) && (

            <FormControl fullWidth size="small" sx={{ mt: 1 }}>

              <InputLabel sx={{ fontSize: 13 }}>Group By (Optional)</InputLabel>

              <Select

                value={editForm.groupByCol || ""}

                onChange={(e) => setEditForm(f => ({ ...f, groupByCol: e.target.value }))}

                label="Group By (Optional)"

              >

                <MenuItem value=""><em>None</em></MenuItem>

                {file.columns?.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}

                {Object.keys(file.calc_fields || {}).map(c => <MenuItem key={c} value={c}>fx: {c}</MenuItem>)}

              </Select>

            </FormControl>

          )}



          {/* ── Secondary Label Section ── */}

          <Box sx={{ background: "#fafafa", borderRadius: 2, p: 1.5, border: "1px solid #eee", mt: 0.5 }}>

            <Typography fontSize={11} fontWeight={800} textTransform="uppercase" color="text.disabled" letterSpacing={1} mb={1.5}>🏷️ Secondary Label</Typography>

            <FormControl fullWidth size="small">

              <Select

                displayEmpty

                value={editForm.labelCol || ""}

                onChange={(e) => setEditForm(f => ({ ...f, labelCol: e.target.value }))}

              >

                <MenuItem value=""><em>None</em></MenuItem>

                {file.columns?.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}

                {Object.keys(file.calc_fields || {}).map(c => <MenuItem key={c} value={c}>fx: {c}</MenuItem>)}

              </Select>

            </FormControl>



            {editForm.labelCol && (<Box mt={1.5}>

              <Typography fontSize={12} fontWeight={700} color="text.secondary">Secondary Format</Typography>

              <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5} mt={0.5}>

                {NUMBER_FORMATS.map(opt => (

                  <Chip key={opt.value} label={opt.label} size="small" clickable

                    onClick={() => setEditForm(f => ({ ...f, secondaryNumberFormat: opt.value }))}

                    sx={{

                      fontWeight: 700, fontSize: 11,

                      background: (editForm.secondaryNumberFormat || "auto") === opt.value ? "#1a1a2e" : "#f0f0f0",

                      color: (editForm.secondaryNumberFormat || "auto") === opt.value ? "#fff" : "#444",

                      border: (editForm.secondaryNumberFormat || "auto") === opt.value ? "1.5px solid #a78bfa" : "1.5px solid transparent",

                    }} />

                ))}

              </Stack>

            </Box>)}</Box>

{/* ── Number Format ── */}

          <Typography fontSize={12} fontWeight={700} color="text.secondary" mt={1}>Number Format</Typography>

          <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5} mt={0.5}>

            {NUMBER_FORMATS.map(opt => (

              <Chip key={opt.value} label={opt.label} size="small" clickable

                onClick={() => setEditForm(f => ({ ...f, numberFormat: opt.value }))}

                sx={{

                  fontWeight: 700, fontSize: 11,

                  background: (editForm.numberFormat || "auto") === opt.value ? "#1a1a2e" : "#f0f0f0",

                  color: (editForm.numberFormat || "auto") === opt.value ? "#fff" : "#444",

                  border: (editForm.numberFormat || "auto") === opt.value ? "1.5px solid #a78bfa" : "1.5px solid transparent",

                }} />

            ))}

          </Stack>
        </Box>

        <Box sx={{ background: "#fafafa", borderRadius: 2, p: 1.5, border: "1px solid #eee", mt: 2 }}>
          <Typography fontSize={11} fontWeight={800} textTransform="uppercase" color="text.disabled" letterSpacing={1} mb={1}>🔗 Click Action</Typography>
          <FormControl size="small" fullWidth>
            <Select
              value={editForm.onClickAction || "filter"}
              onChange={(e) => setEditForm(f => ({ ...f, onClickAction: e.target.value }))}
            >
              <MenuItem value="none">None (Read Only)</MenuItem>
              <MenuItem value="filter">Filter Dashboard (Default)</MenuItem>
              <MenuItem value="navigate">Navigate to Tab</MenuItem>
            </Select>
          </FormControl>
          {(editForm.onClickAction === "navigate") && (
            <FormControl size="small" fullWidth sx={{ mt: 1.5 }}>
              <Select
                value={editForm.onClickTarget || ""}
                onChange={(e) => setEditForm(f => ({ ...f, onClickTarget: e.target.value }))}
                displayEmpty
              >
                <MenuItem value="" disabled>Select Target Tab...</MenuItem>
                {dashboardTabs.map(t => (
                  <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>
      </Box>
    )}
    {activeSettingCategory === 'FILTERS' && (
      <Card sx={{ borderRadius: 4, border: "1px solid #eaeaea", boxShadow: "0px 4px 20px rgba(0,0,0,0.02)", bgcolor: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Box sx={{ p: 2, px: 3, borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 1.5 }}>
          <FilterAlt sx={{ fontSize: 22, color: "#64748b" }} />
          <Typography fontSize={14} fontWeight={800} textTransform="uppercase" color="#64748b" letterSpacing={1}>Filters & Parameters</Typography>
        </Box>
        <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 3 }}>
{/* ── Filters Section ── */}

          <Box sx={{ borderRadius: 6, border: "1px solid #f1f5f9", p: 2.5 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" mb={2}>
              <Search sx={{ fontSize: 18, color: "#94a3b8" }} />
              <Typography fontSize={12} fontWeight={800} textTransform="uppercase" color="#94a3b8" letterSpacing={1}>Chart Filters</Typography>
            </Stack>



            {/* List existing filters */}

            {Object.keys(editForm.filters || {}).map((col) => (

              <Stack key={col} spacing={0.5} sx={{ mb: 1.5 }}>

                <Stack direction="row" alignItems="center" justifyContent="space-between">

                  <Typography fontSize={12} fontWeight={700} color="text.secondary">{col}</Typography>

                  <IconButton size="small" onClick={() => handleRemoveFilter(col)} sx={{ color: "#bbb", p: 0.3 }}>

                    <DeleteOutline sx={{ fontSize: 13 }} />

                  </IconButton>

                </Stack>

                {/* Multiselect Select Dropdown for this column's values */}

                <FormControl size="small" fullWidth>

                  <Select

                    multiple

                    value={editForm.filters[col] || []}

                    onChange={(e) => handleFilterValueChange(col, e.target.value)}

                    renderValue={(selected) => selected.length === 0 ? "None selected" : selected.join(", ")}

                    sx={{ background: "#fff", fontSize: 12, fontWeight: 700 }}

                  >

                    <MenuItem value="SELECT_ALL">

                      <Checkbox checked={isAllSelected(col)} indeterminate={isIndeterminate(col)} size="small" />

                      <ListItemText primary="Select All" primaryTypographyProps={{ fontSize: 12, fontWeight: 700 }} />

                    </MenuItem>

                    {(availableFilterValues[col] || []).map((val) => (

                      <MenuItem key={val} value={val}>

                        <Checkbox checked={(editForm.filters[col] || []).includes(val)} size="small" />

                        <ListItemText primary={val} primaryTypographyProps={{ fontSize: 12, fontWeight: 600 }} />

                      </MenuItem>

                    ))}

                  </Select>

                </FormControl>

              </Stack>

            ))}



            {/* Add filter selector */}
            <FormControl size="small" fullWidth sx={{ mt: 1 }}>
              <Select
                value=""
                onChange={(e) => handleAddFilterColumn(e.target.value)}
                displayEmpty
                renderValue={() => "Add Filter Column"}
                sx={{ background: "#fff", fontSize: 13, fontWeight: 700, borderRadius: 10, color: "#64748b", '& fieldset': { borderColor: "#cbd5e1" } }}
              >

                {file.columns?.filter(c => !editForm.filters?.[c]).map(col => (

                  <MenuItem key={col} value={col}>{col}</MenuItem>

                ))}

              </Select>

            </FormControl>

          </Box>

{/* ── Advanced Parameter Filters ── */}
          {parameters.length > 0 && (
            <Box sx={{ borderRadius: 6, border: "1px solid #f1f5f9", p: 2.5 }}>
              <Stack direction="row" spacing={1.5} alignItems="center" mb={2}>
                <Settings sx={{ fontSize: 18, color: "#cbd5e1" }} />
                <Typography fontSize={12} fontWeight={800} textTransform="uppercase" color="#cbd5e1" letterSpacing={1}>Advanced Parameter Filters</Typography>
              </Stack>
              <Stack spacing={1.5}>

                {(editForm.advancedFilters || []).map((af, i) => (

                  <Stack direction="row" spacing={1} key={i} alignItems="center">

                    <Select size="small" value={af.col} onChange={e => {

                      const next = [...(editForm.advancedFilters || [])];

                      next[i].col = e.target.value;

                      setEditForm(f => ({ ...f, advancedFilters: next }));

                    }} sx={{ flex: 2, fontSize: 12, background: "#fff" }} displayEmpty>

                      <MenuItem value=""><em>Select Column...</em></MenuItem>

                      {file?.columns?.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}

                    </Select>

                    <Select size="small" value={af.op} onChange={e => {

                      const next = [...(editForm.advancedFilters || [])];

                      next[i].op = e.target.value;

                      setEditForm(f => ({ ...f, advancedFilters: next }));

                    }} sx={{ flex: 1, fontSize: 12, background: "#fff" }}>

                      <MenuItem value="=">=</MenuItem>

                      <MenuItem value=">=">&gt;=</MenuItem>

                      <MenuItem value="<=">&lt;=</MenuItem>

                      <MenuItem value=">">&gt;</MenuItem>

                      <MenuItem value="<">&lt;</MenuItem>

                      <MenuItem value="!=">!=</MenuItem>

                    </Select>

                    <Select size="small" value={(af.val && af.val.startsWith("@")) ? af.val : "CUSTOM"} onChange={e => {

                      const next = [...(editForm.advancedFilters || [])];

                      if (e.target.value === "CUSTOM") next[i].val = "";

                      else next[i].val = e.target.value;

                      setEditForm(f => ({ ...f, advancedFilters: next }));

                    }} sx={{ flex: (af.val && af.val.startsWith("@")) ? 2 : 1.2, fontSize: 12, background: "#fff" }} displayEmpty>

                      {parameters.map(p => <MenuItem key={p.name} value={`@${p.name}`}>@{p.name}</MenuItem>)}

                      <MenuItem value="CUSTOM"><em>Unlinked</em></MenuItem>

                    </Select>

                    {!(af.val && af.val.startsWith("@")) && (

                      <TextField size="small" placeholder="Custom Value" value={af.val} onChange={e => {

                        const next = [...(editForm.advancedFilters || [])];

                        next[i].val = e.target.value;

                        setEditForm(f => ({ ...f, advancedFilters: next }));

                      }} sx={{ flex: 2, background: "#fff" }} InputProps={{ sx: { fontSize: 12 } }} />

                    )}

                    <IconButton size="small" color="error" onClick={() => {

                      const next = [...(editForm.advancedFilters || [])];

                      next.splice(i, 1);

                      setEditForm(f => ({ ...f, advancedFilters: next }));

                    }}>

                      <DeleteOutline sx={{ fontSize: 16 }} />

                    </IconButton>

                  </Stack>

                ))}

                <Button size="small" variant="outlined" startIcon={<Add />} onClick={() => {
                  setEditForm(f => ({ ...f, advancedFilters: [...(f.advancedFilters || []), { col: "", op: ">=", val: parameters.length > 0 ? `@${parameters[0].name}` : "" }] }));
                }} sx={{ alignSelf: "flex-start", mt: 1, borderRadius: 8, textTransform: "none", color: "#8b5cf6", borderColor: "#c4b5fd", fontWeight: 700, px: 2 }}>
                  Link Parameter
                </Button>

              </Stack>

            </Box>

          )}



          
        </Box>
      </Card>
    )}
    {activeSettingCategory === 'COLORS' && (
      <Box sx={{ display: "flex", flexDirection: "column" }}>
        <Box sx={{ p: 2, borderBottom: "1px solid #eaeaea", display: "flex", alignItems: "center", gap: 1.5, bgcolor: "#fafafa" }}>
          <Palette sx={{ fontSize: 20, color: "text.secondary" }} />
          <Typography fontSize={14} fontWeight={800} textTransform="uppercase" color="text.secondary" letterSpacing={1}>Colors & Theming</Typography>
        </Box>
        <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 2.5 }}>
{/* ── Colors Section ── */}

          <Box sx={{ background: "#fafafa", borderRadius: 2, p: 1.5, border: "1px solid #eee", mt: 0.5 }}>

            <Typography fontSize={11} fontWeight={800} textTransform="uppercase" color="text.disabled" letterSpacing={1} mb={1}>🎨 Colors</Typography>



            {/* Chart Data Color */}

            <Stack direction="row" spacing={1} alignItems="center" mb={1}>

              <Typography fontSize={12} fontWeight={700} color="text.secondary" sx={{ minWidth: 80 }}>Data</Typography>

              <Box sx={{ width: 26, height: 26, borderRadius: 1, border: "2px solid #ddd", background: editForm.color || activeSlots[0]?.accent || R, flexShrink: 0 }} />

              <TextField size="small" placeholder="#hex" value={editForm.color || ""}

                onChange={(e) => setEditForm(f => ({ ...f, color: e.target.value }))}

                sx={{ width: 100, "& input": { fontSize: 12, fontWeight: 700, fontFamily: "monospace", py: 0.5 } }} />

              <IconButton size="small" onClick={() => setEditForm(f => ({ ...f, color: "" }))} sx={{ color: "#bbb" }}><DeleteOutline sx={{ fontSize: 14 }} /></IconButton>

            </Stack>



            {/* Header Bar Color */}

            <Stack direction="row" spacing={1} alignItems="center" mb={1}>

              <Typography fontSize={12} fontWeight={700} color="text.secondary" sx={{ minWidth: 80 }}>Header</Typography>

              <Box sx={{ width: 26, height: 26, borderRadius: 1, border: "2px solid #ddd", background: editForm.headerColor || (editForm.color || activeSlots[0]?.accent || R), flexShrink: 0 }} />

              <TextField size="small" placeholder="#hex" value={editForm.headerColor || ""}

                onChange={(e) => setEditForm(f => ({ ...f, headerColor: e.target.value }))}

                sx={{ width: 100, "& input": { fontSize: 12, fontWeight: 700, fontFamily: "monospace", py: 0.5 } }} />

              <IconButton size="small" onClick={() => setEditForm(f => ({ ...f, headerColor: "" }))} sx={{ color: "#bbb" }}><DeleteOutline sx={{ fontSize: 14 }} /></IconButton>

            </Stack>



            {/* Title Text Color */}

            <Stack direction="row" spacing={1} alignItems="center" mb={1}>

              <Typography fontSize={12} fontWeight={700} color="text.secondary" sx={{ minWidth: 80 }}>Text</Typography>

              <Box sx={{ width: 26, height: 26, borderRadius: 1, border: "2px solid #ddd", background: editForm.textColor || "#ffffff", flexShrink: 0 }} />

              <TextField size="small" placeholder="#fff" value={editForm.textColor || ""}

                onChange={(e) => setEditForm(f => ({ ...f, textColor: e.target.value }))}

                sx={{ width: 100, "& input": { fontSize: 12, fontWeight: 700, fontFamily: "monospace", py: 0.5 } }} />

              <Stack direction="row" spacing={0.3}>

                {["#ffffff", "#1a1a2e", "#333333", "#000000"].map(c => (

                  <Box key={c} onClick={() => setEditForm(f => ({ ...f, textColor: c }))}

                    sx={{

                      width: 18, height: 18, borderRadius: "4px", background: c, cursor: "pointer",

                      border: editForm.textColor === c ? "2px solid #a78bfa" : `1.5px solid ${c === "#ffffff" ? "#ddd" : "transparent"}`,

                      "&:hover": { transform: "scale(1.15)" }, transition: "transform 0.1s"

                    }} />

                ))}

              </Stack>

            </Stack>



            {/* Background Color */}

            <Stack direction="row" spacing={1} alignItems="center" mb={1}>

              <Typography fontSize={12} fontWeight={700} color="text.secondary" sx={{ minWidth: 80 }}>Background</Typography>

              <Box sx={{ width: 26, height: 26, borderRadius: 1, border: "2px solid #ddd", background: editForm.bgColor || "#ffffff", flexShrink: 0 }} />

              <TextField size="small" placeholder="#ffffff" value={editForm.bgColor || ""}

                onChange={(e) => setEditForm(f => ({ ...f, bgColor: e.target.value }))}

                sx={{ width: 100, "& input": { fontSize: 12, fontWeight: 700, fontFamily: "monospace", py: 0.5 } }} />

              <IconButton size="small" onClick={() => setEditForm(f => ({ ...f, bgColor: "" }))} sx={{ color: "#bbb" }}><DeleteOutline sx={{ fontSize: 14 }} /></IconButton>

            </Stack>



            {/* Quick Pick */}

            <Typography fontSize={10} color="text.disabled" fontWeight={700} mb={0.5}>Quick Pick (click = data, Shift = header, Ctrl/Alt = background)</Typography>

            <Stack direction="row" spacing={0.4} flexWrap="wrap" gap={0.4}>

              {[...(PALETTES[paletteName] || PALETTES["DashForge"]), "#264653", "#2a9d8f", "#e9c46a", "#f4a261", "#e76f51", "#606c38", "#283618", "#bc6c25", "#ffffff", "#fafafa", "#f5f5f5", "#fffdf5"].map((c, i) => (

                <Box key={i} onClick={(e) => {

                  if (e.shiftKey) setEditForm(f => ({ ...f, headerColor: c }));

                  else if (e.ctrlKey || e.altKey) setEditForm(f => ({ ...f, bgColor: c }));

                  else setEditForm(f => ({ ...f, color: c }));

                }}

                  sx={{

                    width: 22, height: 22, borderRadius: "4px", background: c, cursor: "pointer",

                    border: (editForm.color === c || editForm.headerColor === c || editForm.bgColor === c) ? "2.5px solid #1a1a2e" : "1.5px solid transparent",

                    transition: "transform 0.1s", "&:hover": { transform: "scale(1.18)" }

                  }} />

              ))}

            </Stack>

          </Box>
        </Box>
      </Box>
    )}
    {activeSettingCategory === 'ANALYTICS' && (
      <Box sx={{ display: "flex", flexDirection: "column" }}>
        <Box sx={{ p: 2, borderBottom: "1px solid #eaeaea", display: "flex", alignItems: "center", gap: 1.5, bgcolor: "#fafafa" }}>
          <TrendingUp sx={{ fontSize: 20, color: "text.secondary" }} />
          <Typography fontSize={14} fontWeight={800} textTransform="uppercase" color="text.secondary" letterSpacing={1}>Analytics</Typography>
        </Box>
        <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 2.5 }}>
{/* ── Target Line ── */}

          <Box sx={{ background: "#fafafa", borderRadius: 2, p: 1.5, border: "1px solid #eee", mt: 0.5 }}>

            <Typography fontSize={11} fontWeight={800} textTransform="uppercase" color="text.disabled" letterSpacing={1} mb={1}>🎯 Target / Reference Line</Typography>

            <Stack spacing={1}>

              <Stack direction="row" spacing={1} alignItems="center">

                <Typography fontSize={12} fontWeight={700} color="text.secondary" sx={{ minWidth: 80 }}>Value</Typography>

                <TextField size="small" placeholder="e.g. 500" value={editForm.targetLineValue || ""}

                  onChange={(e) => setEditForm(f => ({ ...f, targetLineValue: e.target.value }))}

                  sx={{ flex: 1, "& input": { fontSize: 12, py: 0.5 } }} />

              </Stack>

              <Stack direction="row" spacing={1} alignItems="center">

                <Typography fontSize={12} fontWeight={700} color="text.secondary" sx={{ minWidth: 80 }}>Label</Typography>

                <TextField size="small" placeholder="e.g. Monthly Goal" value={editForm.targetLineLabel || ""}

                  onChange={(e) => setEditForm(f => ({ ...f, targetLineLabel: e.target.value }))}

                  sx={{ flex: 1, "& input": { fontSize: 12, py: 0.5 } }} />

              </Stack>

              <Stack direction="row" spacing={1} alignItems="center">

                <Typography fontSize={12} fontWeight={700} color="text.secondary" sx={{ minWidth: 80 }}>Color</Typography>

                <Box sx={{ width: 26, height: 26, borderRadius: 1, border: "2px solid #ddd", background: editForm.targetLineColor || "#ff4757", flexShrink: 0 }} />

                <TextField size="small" placeholder="#ff4757" value={editForm.targetLineColor || ""}

                  onChange={(e) => setEditForm(f => ({ ...f, targetLineColor: e.target.value }))}

                  sx={{ flex: 1, "& input": { fontSize: 12, fontWeight: 700, fontFamily: "monospace", py: 0.5 } }} />

              </Stack>

            </Stack>

          </Box>



          {/* ── Tooltips ── */}

          <Box sx={{ background: "#fafafa", borderRadius: 2, p: 1.5, border: "1px solid #eee", mt: 0.5 }}>

            <Typography fontSize={11} fontWeight={800} textTransform="uppercase" color="text.disabled" letterSpacing={1} mb={1}>💬 Tooltips</Typography>

            <FormControlLabel

              control={<Switch size="small" checked={editForm.showTooltip !== false}

                onChange={(e) => setEditForm(f => ({ ...f, showTooltip: e.target.checked }))} />}

              label={<Typography fontSize={12} fontWeight={700}>Show Tooltips on Hover</Typography>} />

              

            {editForm.showTooltip !== false && (

              <Box mt={1}>

                {/* Background Color */}

                <Stack direction="row" spacing={1} alignItems="center" mb={1}>

                  <Typography fontSize={12} fontWeight={700} color="text.secondary" sx={{ minWidth: 80 }}>Background</Typography>

                  <Box sx={{ width: 26, height: 26, borderRadius: 1, border: "2px solid #ddd", background: editForm.tooltipBgColor || "rgba(255, 255, 255, 0.95)", flexShrink: 0 }} />

                  <TextField size="small" placeholder="rgba(255,255,255,0.9)" value={editForm.tooltipBgColor || ""}

                    onChange={(e) => setEditForm(f => ({ ...f, tooltipBgColor: e.target.value }))}

                    sx={{ flex: 1, "& input": { fontSize: 12, fontWeight: 700, fontFamily: "monospace", py: 0.5 } }} />

                </Stack>

                {/* Text Color */}

                <Stack direction="row" spacing={1} alignItems="center" mb={1}>

                  <Typography fontSize={12} fontWeight={700} color="text.secondary" sx={{ minWidth: 80 }}>Text</Typography>

                  <Box sx={{ width: 26, height: 26, borderRadius: 1, border: "2px solid #ddd", background: editForm.tooltipTextColor || "#333333", flexShrink: 0 }} />

                  <TextField size="small" placeholder="#333333" value={editForm.tooltipTextColor || ""}

                    onChange={(e) => setEditForm(f => ({ ...f, tooltipTextColor: e.target.value }))}

                    sx={{ flex: 1, "& input": { fontSize: 12, fontWeight: 700, fontFamily: "monospace", py: 0.5 } }} />

                </Stack>

                {/* Border Color */}

                <Stack direction="row" spacing={1} alignItems="center" mb={1}>

                  <Typography fontSize={12} fontWeight={700} color="text.secondary" sx={{ minWidth: 80 }}>Border</Typography>

                  <Box sx={{ width: 26, height: 26, borderRadius: 1, border: "2px solid #ddd", background: editForm.tooltipBorderColor || "#dddddd", flexShrink: 0 }} />

                  <TextField size="small" placeholder="#dddddd" value={editForm.tooltipBorderColor || ""}

                    onChange={(e) => setEditForm(f => ({ ...f, tooltipBorderColor: e.target.value }))}

                    sx={{ flex: 1, "& input": { fontSize: 12, fontWeight: 700, fontFamily: "monospace", py: 0.5 } }} />

                </Stack>

              </Box>

            )}

          </Box>
        </Box>
      </Box>
    )}
    {activeSettingCategory === 'AXES' && (
      <Box sx={{ display: "flex", flexDirection: "column" }}>
        <Box sx={{ p: 2, borderBottom: "1px solid #eaeaea", display: "flex", alignItems: "center", gap: 1.5, bgcolor: "#fafafa" }}>
          <GridOn sx={{ fontSize: 20, color: "text.secondary" }} />
          <Typography fontSize={14} fontWeight={800} textTransform="uppercase" color="text.secondary" letterSpacing={1}>Axes & Grid</Typography>
        </Box>
        <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 2.5 }}>
{/* ── Feature Toggles ── */}

          <Box sx={{ background: "#fafafa", borderRadius: 2, p: 1.5, border: "1px solid #eee" }}>

            <Typography fontSize={11} fontWeight={800} textTransform="uppercase" color="text.disabled" letterSpacing={1} mb={1}>⚡ Features</Typography>

            <Stack spacing={0.5}>

              <FormControlLabel

                control={<Switch size="small" checked={editForm.showLabels || false}

                  onChange={(e) => setEditForm(f => ({ ...f, showLabels: e.target.checked }))} />}

                label={<Typography fontSize={12} fontWeight={700}>Show Data Labels</Typography>} />

              <FormControlLabel

                control={<Switch size="small" checked={editForm.showGrid !== false}

                  onChange={(e) => setEditForm(f => ({ ...f, showGrid: e.target.checked }))} />}

                label={<Typography fontSize={12} fontWeight={700}>Show Grid Lines</Typography>} />

              <FormControlLabel

                control={<Switch size="small" checked={editForm.showXAxis !== false}

                  onChange={(e) => setEditForm(f => ({ ...f, showXAxis: e.target.checked }))} />}

                label={<Typography fontSize={12} fontWeight={700}>Show X-Axis</Typography>} />

              <FormControlLabel

                control={<Switch size="small" checked={editForm.showYAxis !== false}

                  onChange={(e) => setEditForm(f => ({ ...f, showYAxis: e.target.checked }))} />}

                label={<Typography fontSize={12} fontWeight={700}>Show Y-Axis</Typography>} />

            </Stack>



            {(editForm.type === "hbar" || editForm.type === "progress") && (

              <Box sx={{ mt: 1.5 }}>

                <Typography fontSize={12} fontWeight={700} color="text.secondary">Row Height / Container Spacing (px)</Typography>

                <Stack direction="row" spacing={2} alignItems="center" mt={0.5}>

                  <Slider

                    size="small"

                    value={editForm.rowHeight !== undefined ? editForm.rowHeight : (editForm.type === "hbar" ? 38 : 10)}

                    min={20}

                    max={120}

                    step={1}

                    onChange={(_, val) => setEditForm(f => ({ ...f, rowHeight: val }))}

                    sx={{ flex: 1, color: R }}

                  />

                  <Typography fontSize={13} fontWeight={800} color="text.primary" sx={{ minWidth: 28 }}>

                    {editForm.rowHeight !== undefined ? editForm.rowHeight : (editForm.type === "hbar" ? 38 : 10)}

                  </Typography>

                </Stack>

              </Box>

            )}

            {["bar", "hbar"].includes(editForm.type) && (

              <Box sx={{ mt: 1.5 }}>

                <Typography fontSize={12} fontWeight={700} color="text.secondary">Bar Thickness (px)</Typography>

                <Stack direction="row" spacing={2} alignItems="center" mt={0.5}>

                  <Slider

                    size="small"

                    value={editForm.barWidth !== undefined ? editForm.barWidth : (editForm.type === "hbar" ? 22 : 40)}

                    min={4}

                    max={120}

                    step={1}

                    onChange={(_, val) => setEditForm(f => ({ ...f, barWidth: val }))}

                    sx={{ flex: 1, color: R }}

                  />

                  <Typography fontSize={13} fontWeight={800} color="text.primary" sx={{ minWidth: 28 }}>

                    {editForm.barWidth !== undefined ? editForm.barWidth : (editForm.type === "hbar" ? 22 : 40)}

                  </Typography>

                </Stack>

              </Box>

            )}

            <Typography fontSize={12} fontWeight={700} color="text.secondary" mt={1}>Sort Order</Typography>

            <Stack direction="row" spacing={0.5} mt={0.5}>

              {[{ v: "", l: "Default" }, { v: "desc", l: "⬇ Descending" }, { v: "asc", l: "⬆ Ascending" }].map(opt => (

                <Chip key={opt.v} label={opt.l} size="small" clickable

                  onClick={() => setEditForm(f => ({ ...f, sortOrder: opt.v }))}

                  sx={{

                    fontWeight: 700, fontSize: 11,

                    background: (editForm.sortOrder || "") === opt.v ? "#1a1a2e" : "#f0f0f0",

                    color: (editForm.sortOrder || "") === opt.v ? "#fff" : "#444",

                    border: (editForm.sortOrder || "") === opt.v ? "1.5px solid #a78bfa" : "1.5px solid transparent",

                  }} />

              ))}

            </Stack>



            <Typography fontSize={12} fontWeight={700} color="text.secondary" mt={1}>Title Alignment</Typography>

            <Stack direction="row" spacing={0.5} mt={0.5}>

              {[{ v: "left", l: "◀ Left" }, { v: "center", l: "◆ Center" }, { v: "right", l: "▶ Right" }].map(opt => (

                <Chip key={opt.v} label={opt.l} size="small" clickable

                  onClick={() => setEditForm(f => ({ ...f, titleAlign: opt.v }))}

                  sx={{

                    fontWeight: 700, fontSize: 11,

                    background: (editForm.titleAlign || "left") === opt.v ? "#1a1a2e" : "#f0f0f0",

                    color: (editForm.titleAlign || "left") === opt.v ? "#fff" : "#444",

                    border: (editForm.titleAlign || "left") === opt.v ? "1.5px solid #a78bfa" : "1.5px solid transparent",

                  }} />

              ))}

            </Stack>



            <FormControlLabel sx={{ mt: 0.5 }}

              control={<Switch size="small" checked={editForm.hidePill || false}

                onChange={(e) => setEditForm(f => ({ ...f, hidePill: e.target.checked }))} />}

              label={<Typography fontSize={12} fontWeight={700}>Hide Type Badge</Typography>} />

            <FormControlLabel sx={{ mt: 0.5 }}

              control={<Switch size="small" checked={editForm.hasPadding !== false}

                onChange={(e) => setEditForm(f => ({ ...f, hasPadding: e.target.checked }))} />}

              label={<Typography fontSize={12} fontWeight={700}>Enable Padding</Typography>} />

            <FormControlLabel sx={{ mt: 0.5 }}

              control={<Switch size="small" checked={editForm.roundedCorners !== false}

                onChange={(e) => setEditForm(f => ({ ...f, roundedCorners: e.target.checked }))} />}

              label={<Typography fontSize={12} fontWeight={700}>Rounded Corners</Typography>} />

            <Typography fontSize={12} fontWeight={700} color="text.secondary" mt={1}>Borders</Typography>

            <Stack direction="row" spacing={0.5} flexWrap="wrap" mt={0.5}>

              {[

                { k: "borderTop", l: "Top" },

                { k: "borderRight", l: "Right" },

                { k: "borderBottom", l: "Bottom" },

                { k: "borderLeft", l: "Left" }

              ].map(opt => (

                <FormControlLabel

                  key={opt.k}

                  control={<Checkbox size="small" checked={editForm[opt.k] !== false}

                    onChange={(e) => setEditForm(f => ({ ...f, [opt.k]: e.target.checked }))} />}

                  label={<Typography fontSize={11} fontWeight={700}>{opt.l}</Typography>} />

              ))}

            </Stack>



            <Typography fontSize={12} fontWeight={700} color="text.secondary" mt={1}>Outer Gap (px)</Typography>

            <Stack direction="row" spacing={1} mt={0.5}>

              {[

                { k: "gapTop", l: "Top" },

                { k: "gapRight", l: "Right" },

                { k: "gapBottom", l: "Bottom" },

                { k: "gapLeft", l: "Left" }

              ].map(opt => (

                <TextField key={opt.k} label={opt.l} size="small" type="number"

                  value={editForm[opt.k] || 0}

                  onChange={(e) => setEditForm(f => ({ ...f, [opt.k]: Number(e.target.value) }))}

                  InputLabelProps={{ shrink: true, sx: { fontSize: 13, fontWeight: 600 } }}

                  sx={{ width: 65, "& input": { fontSize: 13, py: 0.6, textAlign: "center", fontWeight: 700 } }} />

              ))}

            </Stack>



            {(editForm.borderTop !== false || editForm.borderRight !== false || editForm.borderBottom !== false || editForm.borderLeft !== false) && (

              <Stack spacing={0.5} mt={0.8}>

                <Typography fontSize={12} fontWeight={700} color="text.secondary">Border Color</Typography>

                <Stack direction="row" spacing={1} alignItems="center">

                  <Box sx={{ width: 24, height: 24, borderRadius: 1, border: "1.5px solid #ddd", background: editForm.borderColor || "#e0e0e0", flexShrink: 0 }} />

                  <TextField size="small" placeholder="#e0e0e0" value={editForm.borderColor || ""}

                    onChange={(e) => setEditForm(f => ({ ...f, borderColor: e.target.value }))}

                    sx={{ width: 110, "& input": { fontSize: 11, fontFamily: "monospace", py: 0.4 } }} />

                  <input type="color" value={editForm.borderColor || "#e0e0e0"}

                    onChange={(e) => setEditForm(f => ({ ...f, borderColor: e.target.value }))}

                    style={{ width: 28, height: 28, border: "none", padding: 0, cursor: "pointer", borderRadius: 4 }} />

                  <IconButton size="small" onClick={() => setEditForm(f => ({ ...f, borderColor: "" }))} sx={{ color: "#bbb" }}><DeleteOutline sx={{ fontSize: 13 }} /></IconButton>

                </Stack>

                <Stack direction="row" spacing={0.4} flexWrap="wrap" gap={0.4}>

                  {["#e0e0e0", "#f0f0f0", "#d0d0d0", "#c52626", "#1565C0", "#449042", "#F57C00", "#6A1B9A", "#1a1a2e", "#000"].map((c, i) => (

                    <Box key={i} onClick={() => setEditForm(f => ({ ...f, borderColor: c }))}

                      sx={{

                        width: 20, height: 20, borderRadius: "4px", background: c, cursor: "pointer",

                        border: editForm.borderColor === c ? "2px solid #1a1a2e" : "1.5px solid transparent",

                        "&:hover": { transform: "scale(1.15)" }, transition: "transform 0.1s"

                      }} />

                  ))}

                </Stack>

              </Stack>

            )}

          </Box>



          {["bar", "hbar", "line", "area", "pie"].includes(editForm.type) && (

            <Box sx={{ background: "#fafafa", borderRadius: 2, p: 1.5, border: "1px solid #eee", mt: 0.5 }}>

              <Typography fontSize={11} fontWeight={800} textTransform="uppercase" color="text.disabled" letterSpacing={1} mb={1.5}>⭕ Data Label Settings</Typography>

              <Typography fontSize={12} fontWeight={700} color="text.secondary" mb={0.5}>Data Label Mode</Typography>

              <FormControl size="small" fullWidth>

                <Select

                  value={editForm.pieLabelMode || "percent"}

                  onChange={(e) => setEditForm(f => ({ ...f, pieLabelMode: e.target.value }))}

                  sx={{ background: "#fff", fontSize: 12, fontWeight: 700 }}

                >

                  <MenuItem value="percent">Percentage Only (e.g. 51%)</MenuItem>

                  <MenuItem value="label">Category Name (e.g. OUT PATIENT)</MenuItem>

                  <MenuItem value="both">Both Name & Percent (e.g. OUT PATIENT (51%))</MenuItem>

                  <MenuItem value="value">Numeric Value (e.g. 12.6K)</MenuItem>

                </Select>

              </FormControl>

            </Box>

          )}



          <Box sx={{ background: "#fafafa", borderRadius: 2, p: 1.5, border: "1px solid #eee", mt: 0.5 }}>

            <Typography fontSize={11} fontWeight={800} textTransform="uppercase" color="text.disabled" letterSpacing={1} mb={1.5}>⚙️ ECharts Options</Typography>

            <FormControlLabel

              control={<Switch size="small" checked={editForm.showToolbox || false} onChange={e => setEditForm(f => ({ ...f, showToolbox: e.target.checked }))} />}

              label={<Typography fontSize={12} fontWeight={700} color="text.secondary">Enable Chart Toolbox (Export/Zoom)</Typography>}

            />

            {editForm.type === "pie" && (

              <FormControlLabel

                control={<Switch size="small" checked={editForm.roseType || false} onChange={e => setEditForm(f => ({ ...f, roseType: e.target.checked }))} />}

                label={<Typography fontSize={12} fontWeight={700} color="text.secondary">Nightingale Rose Chart</Typography>}

              />

            )}

            {(editForm.type === "line" || editForm.type === "area") && (

              <FormControlLabel

                control={<Switch size="small" checked={editForm.smoothLine || false} onChange={e => setEditForm(f => ({ ...f, smoothLine: e.target.checked }))} />}

                label={<Typography fontSize={12} fontWeight={700} color="text.secondary">Smooth Curves</Typography>}

              />

            )}

          </Box>



          {editForm.type === "pie" && (

            <Box sx={{ background: "#fafafa", borderRadius: 2, p: 1.5, border: "1px solid #eee", mt: 0.5 }}>

              <Typography fontSize={11} fontWeight={800} textTransform="uppercase" color="text.disabled" letterSpacing={1} mb={2}>⭕ Pie Chart Radius</Typography>

              <Typography fontSize={12} fontWeight={700} color="text.secondary" gutterBottom>

                Inner Radius (Donut Hole): {editForm.innerRadius}px

              </Typography>

              <Slider

                size="small"

                value={editForm.innerRadius ?? 60}

                min={0}

                max={120}

                onChange={(e, val) => setEditForm(f => ({ ...f, innerRadius: val }))}

                valueLabelDisplay="auto"

                sx={{ mb: 2, color: R }}

              />

              <Typography fontSize={12} fontWeight={700} color="text.secondary" gutterBottom>

                Outer Radius (Chart Size): {editForm.outerRadius}px

              </Typography>

              <Slider

                size="small"

                value={editForm.outerRadius ?? 90}

                min={20}

                max={150}

                onChange={(e, val) => setEditForm(f => ({ ...f, outerRadius: val }))}

                valueLabelDisplay="auto"

                sx={{ color: R }}

              />

            </Box>

          )}



          {["pie", "bar", "hbar", "line", "area"].includes(editForm.type) && editingChart?.data && (() => {

            const hasGroups = editingChart.data.some(d => d.group_val !== undefined);

            return (

              <Box sx={{ background: "#fafafa", borderRadius: 2, p: 1.5, border: "1px solid #eee", mt: 0.5 }}>

                <Typography fontSize={11} fontWeight={800} textTransform="uppercase" color="text.disabled" letterSpacing={1} mb={1.5}>

                  🎨 {hasGroups ? "Group" : (editForm.type === "pie" ? "Slice" : "Bar/Line")} Colors Override

                </Typography>

                <Stack spacing={1} sx={{ maxHeight: 200, overflowY: "auto", pr: 0.5 }}>

                  {Array.from(new Set(editingChart.data.map(d => String(hasGroups ? d.group_val : (editForm.xKey ? d[editForm.xKey] : (d.label || "")))))).filter(Boolean).map((label, i) => {

                  const defaultColor = activePieColors[i % activePieColors.length];

                  const currentColor = editForm.pieColors?.[label] || "";

                  return (

                    <Stack key={label} direction="row" spacing={1} alignItems="center" justifyContent="space-between">

                      <Typography fontSize={12} fontWeight={700} color="text.secondary" sx={{ noWrap: true, textOverflow: "ellipsis", overflow: "hidden", maxWidth: 180 }}>

                        {label || "Unknown"}

                      </Typography>

                      <Stack direction="row" spacing={1} alignItems="center">

                        <Box sx={{ width: 18, height: 18, borderRadius: 0.5, border: "1px solid #ddd", background: currentColor || defaultColor }} />

                        <TextField

                          size="small"

                          placeholder={defaultColor}

                          value={currentColor}

                          onChange={(e) => {

                            const val = e.target.value;

                            setEditForm(f => ({

                              ...f,

                              pieColors: { ...f.pieColors, [label]: val }

                            }));

                          }}

                          sx={{ width: 90, "& input": { fontSize: 11, fontFamily: "monospace", py: 0.3, px: 0.8 } }}

                        />

                        <input

                          type="color"

                          value={currentColor || defaultColor}

                          onChange={(e) => {

                            const val = e.target.value;

                            setEditForm(f => ({

                              ...f,

                              pieColors: { ...f.pieColors, [label]: val }

                            }));

                          }}

                          style={{ width: 22, height: 22, border: "none", padding: 0, cursor: "pointer", borderRadius: 4 }}

                        />

                        <IconButton

                          size="small"

                          onClick={() => {

                            const nextColors = { ...editForm.pieColors };

                            delete nextColors[label];

                            setEditForm(f => ({ ...f, pieColors: nextColors }));

                          }}

                          disabled={!currentColor}

                          sx={{ color: "#bbb" }}

                        >

                          <DeleteOutline sx={{ fontSize: 12 }} />

                        </IconButton>

                      </Stack>

                    </Stack>

                  );

                })}

              </Stack>

            </Box>

            );

          })()}



          {/* ── Label Alignment ── */}

          <Typography fontSize={12} fontWeight={700} color="text.secondary">Label Alignment</Typography>

          <Stack direction="row" spacing={0.5}>

            {LABEL_ALIGNS.map(la => (

              <Chip

                key={la.value}

                icon={la.icon}

                label={la.label}

                clickable

                onClick={() => setEditForm(f => ({ ...f, labelAlign: la.value }))}

                sx={{

                  fontWeight: 700, fontSize: 11,

                  background: (editForm.labelAlign || labelAlign) === la.value ? "#1a1a2e" : "#f0f0f0",

                  color: (editForm.labelAlign || labelAlign) === la.value ? "#fff" : "#444",

                  border: (editForm.labelAlign || labelAlign) === la.value ? "2px solid #a78bfa" : "2px solid transparent",

                  "& .MuiChip-icon": { color: (editForm.labelAlign || labelAlign) === la.value ? "#fff" : "#888" },

                }}

              />

            ))}

          </Stack>



          
        </Box>
      </Box>
    )}
    {activeSettingCategory === 'TYPOGRAPHY' && (
      <Box sx={{ display: "flex", flexDirection: "column" }}>
        <Box sx={{ p: 2, borderBottom: "1px solid #eaeaea", display: "flex", alignItems: "center", gap: 1.5, bgcolor: "#fafafa" }}>
          <TextFields sx={{ fontSize: 20, color: "text.secondary" }} />
          <Typography fontSize={14} fontWeight={800} textTransform="uppercase" color="text.secondary" letterSpacing={1}>Typography & Spacing</Typography>
        </Box>
        <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 2.5 }}>
{/* ── Typography Section ── */}

          <Box sx={{ background: "#fafafa", borderRadius: 2, p: 1.5, border: "1px solid #eee" }}>

            <Typography fontSize={11} fontWeight={800} textTransform="uppercase" color="text.disabled" letterSpacing={1} mb={1.5}>✏️ Typography</Typography>



            {/* Header/Title Row */}

            <Typography fontSize={11} fontWeight={700} color="text.secondary" mb={0.5}>Header / Title</Typography>

            <Stack direction="row" spacing={1} alignItems="center" mb={2}>

              {/* Font Family Dropdown */}

              <FormControl size="small" sx={{ flex: 1, minWidth: 150 }}>

                <Select

                  value={editForm.fontFamily || ""}

                  onChange={(e) => setEditForm(f => ({ ...f, fontFamily: e.target.value }))}

                  displayEmpty

                  sx={{ background: "#fff", fontSize: 12, height: 32, fontWeight: 700 }}

                >

                  <MenuItem value="" sx={{ fontSize: 12, fontWeight: 700 }}><em>Default Font</em></MenuItem>

                  {FONT_FAMILIES.map(font => (

                    <MenuItem key={font.value} value={font.value} sx={{ fontFamily: font.value || "inherit", fontSize: 12, fontWeight: 700 }}>

                      {font.label.replace(" (Modern Sans)", "").replace(" (Clean & Bold)", "").replace(" (Elegant Serif)", "").replace(" (Sleek Mono)", "")}

                    </MenuItem>

                  ))}

                </Select>

              </FormControl>



              {/* Font Size Dropdown */}

              <FormControl size="small" sx={{ width: 70 }}>

                <Select

                  value={editForm.fontSize || 13}

                  onChange={(e) => setEditForm(f => ({ ...f, fontSize: Number(e.target.value) }))}

                  sx={{ background: "#fff", fontSize: 12, height: 32, fontWeight: 700 }}

                >

                  {[8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32].map(sz => (

                    <MenuItem key={sz} value={sz} sx={{ fontSize: 12, fontWeight: 700 }}>

                      {sz}

                    </MenuItem>

                  ))}

                </Select>

              </FormControl>



              {/* Bold Toggle Button */}

              <IconButton

                size="small"

                onClick={() => setEditForm(f => ({ ...f, fontWeight: f.fontWeight === "bold" ? "normal" : "bold" }))}

                sx={{

                  width: 32, height: 32, borderRadius: 1,

                  background: editForm.fontWeight === "bold" ? "#e0f2fe" : "#f0f0f0",

                  color: editForm.fontWeight === "bold" ? "#0284c7" : "#555",

                  border: editForm.fontWeight === "bold" ? "1.5px solid #0284c7" : "1.5px solid #ccc",

                  "&:hover": { background: editForm.fontWeight === "bold" ? "#bae6fd" : "#e5e5e5" }

                }}

              >

                <Typography fontSize={13} fontWeight="900">B</Typography>

              </IconButton>



              {/* Italic Toggle Button */}

              <IconButton

                size="small"

                onClick={() => setEditForm(f => ({ ...f, fontStyle: f.fontStyle === "italic" ? "normal" : "italic" }))}

                sx={{

                  width: 32, height: 32, borderRadius: 1,

                  background: editForm.fontStyle === "italic" ? "#e0f2fe" : "#f0f0f0",

                  color: editForm.fontStyle === "italic" ? "#0284c7" : "#555",

                  border: editForm.fontStyle === "italic" ? "1.5px solid #0284c7" : "1.5px solid #ccc",

                  "&:hover": { background: editForm.fontStyle === "italic" ? "#bae6fd" : "#e5e5e5" }

                }}

              >

                <Typography fontSize={13} fontWeight="800" fontStyle="italic">I</Typography>

              </IconButton>

            </Stack>



            {/* Axis / Labels / Body Row */}

            <Typography fontSize={11} fontWeight={700} color="text.secondary" mb={0.5}>Axis & Labels (Body)</Typography>



            <Stack direction="row" spacing={1} alignItems="center">

              {/* Font Family Dropdown */}

              <FormControl size="small" sx={{ flex: 1, minWidth: 150 }}>

                <Select

                  value={editForm.bodyFontFamily || ""}

                  onChange={(e) => setEditForm(f => ({ ...f, bodyFontFamily: e.target.value }))}

                  displayEmpty

                  sx={{ background: "#fff", fontSize: 12, height: 32, fontWeight: 700 }}

                >

                  <MenuItem value="" sx={{ fontSize: 12, fontWeight: 700 }}><em>Default Font</em></MenuItem>

                  {FONT_FAMILIES.map(font => (

                    <MenuItem key={font.value} value={font.value} sx={{ fontFamily: font.value || "inherit", fontSize: 12, fontWeight: 700 }}>

                      {font.label.replace(" (Modern Sans)", "").replace(" (Clean & Bold)", "").replace(" (Elegant Serif)", "").replace(" (Sleek Mono)", "")}

                    </MenuItem>

                  ))}

                </Select>

              </FormControl>



              {/* Font Size Dropdown */}

              <FormControl size="small" sx={{ width: 70 }}>

                <Select

                  value={editForm.bodyFontSize || 10}

                  onChange={(e) => setEditForm(f => ({ ...f, bodyFontSize: Number(e.target.value) }))}

                  sx={{ background: "#fff", fontSize: 12, height: 32, fontWeight: 700 }}

                >

                  {[8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20].map(sz => (

                    <MenuItem key={sz} value={sz} sx={{ fontSize: 12, fontWeight: 700 }}>

                      {sz}

                    </MenuItem>

                  ))}

                </Select>

              </FormControl>



              {/* Bold Toggle Button */}

              <IconButton

                size="small"

                onClick={() => setEditForm(f => ({ ...f, bodyFontWeight: f.bodyFontWeight === "bold" ? "normal" : "bold" }))}

                sx={{

                  width: 32, height: 32, borderRadius: 1,

                  background: editForm.bodyFontWeight === "bold" ? "#e0f2fe" : "#f0f0f0",

                  color: editForm.bodyFontWeight === "bold" ? "#0284c7" : "#555",

                  border: editForm.bodyFontWeight === "bold" ? "1.5px solid #0284c7" : "1.5px solid #ccc",

                  "&:hover": { background: editForm.bodyFontWeight === "bold" ? "#bae6fd" : "#e5e5e5" }

                }}

              >

                <Typography fontSize={13} fontWeight="900">B</Typography>

              </IconButton>



              {/* Italic Toggle Button */}

              <IconButton

                size="small"

                onClick={() => setEditForm(f => ({ ...f, bodyFontStyle: f.bodyFontStyle === "italic" ? "normal" : "italic" }))}

                sx={{

                  width: 32, height: 32, borderRadius: 1,

                  background: editForm.bodyFontStyle === "italic" ? "#e0f2fe" : "#f0f0f0",

                  color: editForm.bodyFontStyle === "italic" ? "#0284c7" : "#555",

                  border: editForm.bodyFontStyle === "italic" ? "1.5px solid #0284c7" : "1.5px solid #ccc",

                  "&:hover": { background: editForm.bodyFontStyle === "italic" ? "#bae6fd" : "#e5e5e5" }

                }}

              >

                <Typography fontSize={13} fontWeight="800" fontStyle="italic">I</Typography>

              </IconButton>

            </Stack>

          </Box>
        </Box>
      </Box>
    )}
    {activeSettingCategory === 'CONDITIONAL' && (
      <Box sx={{ display: "flex", flexDirection: "column" }}>
        <Box sx={{ p: 2, borderBottom: "1px solid #eaeaea", display: "flex", alignItems: "center", gap: 1.5, bgcolor: "#fafafa" }}>
          <FormatColorFill sx={{ fontSize: 20, color: "text.secondary" }} />
          <Typography fontSize={14} fontWeight={800} textTransform="uppercase" color="text.secondary" letterSpacing={1}>Conditional Formatting</Typography>
        </Box>
        <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 2.5 }}>
          
          <Box sx={{ background: "#fafafa", borderRadius: 2, p: 1.5, border: "1px solid #eee", mt: 0.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
              <Typography fontSize={11} fontWeight={800} textTransform="uppercase" color="text.disabled" letterSpacing={1}>🎨 Formatting Rules</Typography>
              <Button size="small" variant="outlined" startIcon={<Add />} onClick={() => {
                const next = [...(editForm.conditionalFormats || []), { type: "simple", col: "", op: "=", val: "", color: "#ff4757", target: "text" }];
                setEditForm(f => ({ ...f, conditionalFormats: next }));
              }} sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, fontSize: 11, py: 0.2 }}>
                Add Rule
              </Button>
            </Stack>

            {(editForm.conditionalFormats || []).map((rule, i) => (
              <Box key={i} sx={{ background: "#fff", p: 1.5, borderRadius: 2, border: "1px solid #eee", mb: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography fontSize={11} fontWeight={800} color="text.secondary">Rule {i+1}</Typography>
                    <Select size="small" value={rule.type} onChange={e => {
                      const next = [...editForm.conditionalFormats];
                      next[i].type = e.target.value;
                      if(e.target.value === "gradient" && !next[i].minColor) {
                        next[i].minColor = "#ffffff";
                        next[i].maxColor = "#ff4757";
                        next[i].minVal = "";
                        next[i].maxVal = "";
                      }
                      setEditForm(f => ({ ...f, conditionalFormats: next }));
                    }} sx={{ fontSize: 11, height: 24, '.MuiSelect-select': { py: 0, px: 1 } }}>
                      <MenuItem value="simple" sx={{ fontSize: 11 }}>Simple Match</MenuItem>
                      <MenuItem value="gradient" sx={{ fontSize: 11 }}>Gradient / Heatmap</MenuItem>
                      <MenuItem value="databar" sx={{ fontSize: 11 }}>Data Bar</MenuItem>
                    </Select>
                  </Stack>
                  <IconButton size="small" onClick={() => {
                    const next = [...editForm.conditionalFormats];
                    next.splice(i, 1);
                    setEditForm(f => ({ ...f, conditionalFormats: next }));
                  }} sx={{ color: "#bbb", p: 0.3 }}><DeleteOutline sx={{ fontSize: 14 }} /></IconButton>
                </Stack>

                <Stack spacing={1}>
                  <Select size="small" value={rule.col} onChange={e => {
                      const next = [...editForm.conditionalFormats];
                      next[i].col = e.target.value;
                      setEditForm(f => ({ ...f, conditionalFormats: next }));
                    }} sx={{ fontSize: 12, background: "#fbfbfb" }} displayEmpty>
                    <MenuItem value=""><em>Select Column...</em></MenuItem>
                    {editForm?.measure && (
                      <MenuItem value={editForm.measure} sx={{ fontWeight: 800, color: "primary.main", background: "#f0f7ff" }}>
                        🎯 Measure: {editForm.agg ? editForm.agg.toUpperCase() + '(' + editForm.measure + ')' : editForm.measure}
                      </MenuItem>
                    )}
                    {editForm?.dimension && (
                      <MenuItem value={editForm.dimension} sx={{ fontWeight: 800, color: "primary.main", background: "#f0f7ff" }}>
                        📊 Dimension: {editForm.dimension}
                      </MenuItem>
                    )}
                    {file?.columns?.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    {Object.keys(file?.calc_fields || {}).map(c => <MenuItem key={c} value={c}>fx: {c}</MenuItem>)}
                  </Select>

                  {rule.type === "simple" && (
                    <Stack direction="row" spacing={1}>
                      <Select size="small" value={rule.op} onChange={e => {
                        const next = [...editForm.conditionalFormats];
                        next[i].op = e.target.value;
                        setEditForm(f => ({ ...f, conditionalFormats: next }));
                      }} sx={{ flex: 1, fontSize: 12, background: "#fbfbfb" }}>
                        <MenuItem value="=">=</MenuItem>
                        <MenuItem value="!=">!=</MenuItem>
                        <MenuItem value=">">&gt;</MenuItem>
                        <MenuItem value="<">&lt;</MenuItem>
                        <MenuItem value=">=">&gt;=</MenuItem>
                        <MenuItem value="<=">&lt;=</MenuItem>
                        <MenuItem value="contains">contains</MenuItem>
                        <MenuItem value="between">between</MenuItem>
                      </Select>
                      <TextField size="small" placeholder={rule.op === "between" ? "Min" : "Value"} value={rule.val || ""} onChange={e => {
                        const next = [...editForm.conditionalFormats];
                        next[i].val = e.target.value;
                        setEditForm(f => ({ ...f, conditionalFormats: next }));
                      }} sx={{ flex: 2, background: "#fbfbfb", "& input": { fontSize: 12, py: 0.8 } }} />
                      {rule.op === "between" && (
                        <TextField size="small" placeholder="Max" value={rule.val2 || ""} onChange={e => {
                          const next = [...editForm.conditionalFormats];
                          next[i].val2 = e.target.value;
                          setEditForm(f => ({ ...f, conditionalFormats: next }));
                        }} sx={{ flex: 2, background: "#fbfbfb", "& input": { fontSize: 12, py: 0.8 } }} />
                      )}
                    </Stack>
                  )}

                  {rule.type === "gradient" && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <TextField size="small" placeholder="Min" value={rule.minVal || ""} onChange={e => {
                        const next = [...editForm.conditionalFormats];
                        next[i].minVal = e.target.value;
                        setEditForm(f => ({ ...f, conditionalFormats: next }));
                      }} sx={{ flex: 1, background: "#fbfbfb", "& input": { fontSize: 12, py: 0.8 } }} />
                      <input type="color" value={rule.minColor || "#ffffff"} onChange={e => {
                        const next = [...editForm.conditionalFormats];
                        next[i].minColor = e.target.value;
                        setEditForm(f => ({ ...f, conditionalFormats: next }));
                      }} style={{ border: 'none', width: 24, height: 24, cursor: 'pointer', padding: 0 }} />
                      <Typography fontSize={12} color="text.secondary">to</Typography>
                      <TextField size="small" placeholder="Max" value={rule.maxVal || ""} onChange={e => {
                        const next = [...editForm.conditionalFormats];
                        next[i].maxVal = e.target.value;
                        setEditForm(f => ({ ...f, conditionalFormats: next }));
                      }} sx={{ flex: 1, background: "#fbfbfb", "& input": { fontSize: 12, py: 0.8 } }} />
                      <input type="color" value={rule.maxColor || "#ff4757"} onChange={e => {
                        const next = [...editForm.conditionalFormats];
                        next[i].maxColor = e.target.value;
                        setEditForm(f => ({ ...f, conditionalFormats: next }));
                      }} style={{ border: 'none', width: 24, height: 24, cursor: 'pointer', padding: 0 }} />
                    </Stack>
                  )}

                  {rule.type === "databar" && (
                    <Stack direction="row" spacing={1} alignItems="center">
                       <Typography fontSize={11} fontWeight={600} color="text.secondary" sx={{ flex: 1 }}>Bar Color:</Typography>
                       <input type="color" value={rule.color || "#4cd137"} onChange={e => {
                        const next = [...editForm.conditionalFormats];
                        next[i].color = e.target.value;
                        setEditForm(f => ({ ...f, conditionalFormats: next }));
                      }} style={{ border: 'none', width: 28, height: 28, cursor: 'pointer', padding: 0 }} />
                    </Stack>
                  )}

                  {rule.type === "simple" && (
                    <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
                      <Select size="small" value={rule.target || "text"} onChange={e => {
                        const next = [...editForm.conditionalFormats];
                        next[i].target = e.target.value;
                        setEditForm(f => ({ ...f, conditionalFormats: next }));
                      }} sx={{ flex: 1, fontSize: 11, height: 28, background: "#fbfbfb" }}>
                        <MenuItem value="text" sx={{ fontSize: 11 }}>Text Color</MenuItem>
                        <MenuItem value="bg" sx={{ fontSize: 11 }}>Background Color</MenuItem>
                        <MenuItem value="row" sx={{ fontSize: 11 }}>Entire Row Background</MenuItem>
                      </Select>
                      <input type="color" value={rule.color || "#ff4757"} onChange={e => {
                        const next = [...editForm.conditionalFormats];
                        next[i].color = e.target.value;
                        setEditForm(f => ({ ...f, conditionalFormats: next }));
                      }} style={{ border: 'none', width: 28, height: 28, cursor: 'pointer', padding: 0 }} />
                    </Stack>
                  )}
                </Stack>
              </Box>
            ))}

            {(!editForm.conditionalFormats || editForm.conditionalFormats.length === 0) && (
              <Typography fontSize={11} color="text.secondary" textAlign="center" py={2}>
                No rules defined. Click "Add Rule" to begin.
              </Typography>
            )}
          </Box>

        </Box>
      </Box>
    )}
  </Card>
  <Box sx={{ mt: 2 }}>
    {/* Error Message */}

          {editError && (

            <Typography color="error" fontSize={12} sx={{ mt: 1, fontWeight: 700 }}>

              ⚠️ {editError}

            </Typography>

          )}
  </Box>
</Box>
)}
</Box>
        <Box sx={{ p: 2, borderTop: "1px solid #eaeaea", bgcolor: "#fff", display: "flex", gap: 1, justifyContent: "flex-end" }}>
          <Button onClick={() => { setEditingChart(null); setActiveSettingCategory(null); }} color="inherit" sx={{ fontWeight: 600 }}>Cancel</Button>
          <Button
            disabled={editLoading}
            onClick={async () => {
              setEditLoading(true);
              setEditError("");
              try {
                let chartData = editingChart.data;
                let xKey = editingChart.xKey;
                let yKey = editingChart.yKey;

                if (editForm.type !== 'TextWidget' && editForm.type !== 'IframeWidget') {
                  const { data } = await axios.post(`${API}/build_chart`, {
                    file_id: fileId,
                    dimension: editForm.dimension,
                    measure: editForm.measure,
                    agg: editForm.agg,
                    chart_type: editForm.type,
                    group_by: editForm.groupByCol || undefined,
                    filters: editForm.filters,
                    advanced_filters: editForm.advancedFilters,
                    parameters: parameterValues,
                    time_grouping: editForm.timeGrouping,
                    limit: editForm.limit,
                    label_col: editForm.labelCol
                  });

                  if (data.error) {
                    setEditError(data.error);
                    setEditLoading(false);
                    return;
                  }
                  
                  chartData = data.data;
                  xKey = data.xKey || "label";
                  yKey = data.yKey || "value";
                }

                const updatedForm = {
                  ...editForm,
                  data: chartData,
                  xKey: xKey,
                  yKey: yKey,
                  _groupByCol: editForm.groupByCol,
                  _pieLabelMode: editForm.pieLabelMode,
                  _showXAxis: editForm.showXAxis,
                  _showYAxis: editForm.showYAxis,
                  _secondaryNumberFormat: editForm.secondaryNumberFormat,
                  _showTooltip: editForm.showTooltip,
                  _tooltipBgColor: editForm.tooltipBgColor,
                  _tooltipTextColor: editForm.tooltipTextColor,
                  _tooltipBorderColor: editForm.tooltipBorderColor,
                  _targetLineValue: editForm.targetLineValue,
                  _targetLineLabel: editForm.targetLineLabel,
                  _targetLineColor: editForm.targetLineColor,
                  _conditionalFormats: editForm.conditionalFormats || [],
                  _onClickAction: editForm.onClickAction,
                  _onClickTarget: editForm.onClickTarget,
                };

                const next = { ...chartOverrides, [editingChart.id]: updatedForm };
                setChartOverrides(next);
                localStorage.setItem(`chart_overrides_${lk}`, JSON.stringify(next));
                setEditingChart(null);
                setActiveSettingCategory(null);
              } catch (err) {
                setEditError("Failed to update chart. Please verify column selection and filters.");
              } finally {
                setEditLoading(false);
              }
            }}
            variant="contained"
            sx={{ background: R, color: "#fff", fontWeight: 700, borderRadius: 2 }}
          >
            {editLoading ? <CircularProgress size={16} color="inherit" /> : "Save Changes"}
          </Button>
        </Box>
      </Drawer>

      {/* Editing KPI Dialog */}
      <Drawer anchor="right" PaperProps={{ sx: { width: { xs: "100vw", sm: 420 }, bgcolor: "#fafafa" } }} open={!!editingKpi} onClose={() => { setEditingKpi(null); setActiveKpiSettingCategory(null); }}  >
                <Box sx={{ p: 2, px: 3, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #eaeaea", bgcolor: "#fff", fontWeight: 800, fontSize: 16 }}>
          {activeKpiSettingCategory ? (
            <Button size="small" startIcon={<ArrowBack />} onClick={() => setActiveKpiSettingCategory(null)} sx={{ textTransform: "none", color: "text.secondary", fontWeight: 700, ml: -1 }}>Back to Categories</Button>
          ) : "Customize KPI Card"}
          <IconButton size="small" onClick={() => { setEditingKpi(null); setActiveKpiSettingCategory(null); }}><Close /></IconButton>
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, p: 3, overflowY: "auto", flex: 1, overflowX: "hidden" }}>
          {!activeKpiSettingCategory ? (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <SettingCard icon={<Assessment />} title="Data Configuration" onClick={() => setActiveKpiSettingCategory("data")} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <SettingCard icon={<FilterAlt />} title="Filters & Parameters" onClick={() => setActiveKpiSettingCategory("filters")} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <SettingCard icon={<ColorLens />} title="Colors & Theming" onClick={() => setActiveKpiSettingCategory("colors")} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <SettingCard icon={<SpaceBar />} title="Typography & Spacing" onClick={() => setActiveKpiSettingCategory("layout")} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <SettingCard icon={<FormatColorFill />} title="Conditional Formatting" onClick={() => setActiveKpiSettingCategory("cond")} />
              </Grid>
            </Grid>
          ) : (
            <>
              {activeKpiSettingCategory === "data" && (
                <>
                  <TextField label="KPI Label" variant="outlined" size="small" fullWidth
            value={editKpiForm.label} onChange={(e) => setEditKpiForm(f => ({ ...f, label: e.target.value }))} sx={{ mt: 1 }} />
          <TextField label="Subtitle" variant="outlined" size="small" fullWidth placeholder="e.g. Based on Date Selection"
            value={editKpiForm.subtitle || ""} onChange={(e) => setEditKpiForm(f => ({ ...f, subtitle: e.target.value }))} />
                  {/* Icon Selection */}
                  <Box sx={{ background: "#fafafa", borderRadius: 2, p: 1.5, border: "1px solid #eee" }}>
            <Typography fontSize={11} fontWeight={800} textTransform="uppercase" color="text.disabled" letterSpacing={1} mb={1}>✨ Icon</Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
              {KPI_ICONS.map(ic => {
                const isSelected = (editKpiForm.icon || "None") === ic.name;
                return (
                  <Chip key={ic.name}
                    label={ic.name === "None" ? "None" : ""}
                    icon={ic.icon ? <ic.icon /> : null}
                    size="small"
                    clickable
                    onClick={() => setEditKpiForm(f => ({ ...f, icon: ic.name }))}
                    sx={{
                      width: ic.name === "None" ? "auto" : 32,
                      height: 32,
                      "& .MuiChip-label": { display: ic.name === "None" ? "block" : "none", px: 1, fontSize: 12, fontWeight: 700 },
                      "& .MuiChip-icon": { m: "0 auto !important", display: ic.name === "None" ? "none" : "block" },
                      background: isSelected ? "#1a1a2e" : "#fff",
                      color: isSelected ? "#fff" : "#444",
                      "& .MuiSvgIcon-root": { color: isSelected ? "#fff" : "#666", fontSize: 18 },
                      border: isSelected ? "1.5px solid #1a1a2e" : "1.5px solid #ddd",
                      "&:hover": { borderColor: "#1a1a2e" }
                    }}
                  />
                );
              })}
            </Stack>
                  </Box>
                  <Box sx={{ background: "#fafafa", borderRadius: 2, p: 1.5, border: "1px solid #eee", mt: 2 }}>
                    <Typography fontSize={11} fontWeight={800} textTransform="uppercase" color="text.disabled" letterSpacing={1} mb={1}>🔗 Click Action</Typography>
                    <FormControl size="small" fullWidth>
                      <Select
                        value={editKpiForm.onClickAction || "none"}
                        onChange={(e) => setEditKpiForm(f => ({ ...f, onClickAction: e.target.value }))}
                      >
                        <MenuItem value="none">None (Read Only)</MenuItem>
                        <MenuItem value="filter">Filter Dashboard (Default)</MenuItem>
                        <MenuItem value="navigate">Navigate to Tab</MenuItem>
                      </Select>
                    </FormControl>
                    {(editKpiForm.onClickAction === "navigate") && (
                      <FormControl size="small" fullWidth sx={{ mt: 1.5 }}>
                        <Select
                          value={editKpiForm.onClickTarget || ""}
                          onChange={(e) => setEditKpiForm(f => ({ ...f, onClickTarget: e.target.value }))}
                          displayEmpty
                        >
                          <MenuItem value="" disabled>Select Target Tab...</MenuItem>
                          {dashboardTabs.map(t => (
                            <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  </Box>
                  {/* Formatting */}
                  
                </>
              )}
              {activeKpiSettingCategory === "filters" && (
                <Box sx={{ display: "flex", flexDirection: "column" }}>
                  <Card sx={{ borderRadius: 4, border: "1px solid #eaeaea", boxShadow: "0px 4px 20px rgba(0,0,0,0.02)", bgcolor: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    <Box sx={{ p: 2, px: 3, borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 1.5 }}>
                      <FilterAlt sx={{ fontSize: 22, color: "#64748b" }} />
                      <Typography fontSize={14} fontWeight={800} textTransform="uppercase" color="#64748b" letterSpacing={1}>Filters & Parameters</Typography>
                    </Box>
                    <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 3 }}>
                      <Box sx={{ borderRadius: 6, border: "1px solid #f1f5f9", p: 2.5 }}>
                        <Stack direction="row" spacing={1.5} alignItems="center" mb={2}>
                          <Search sx={{ fontSize: 18, color: "#94a3b8" }} />
                          <Typography fontSize={12} fontWeight={800} textTransform="uppercase" color="#94a3b8" letterSpacing={1}>Advanced Filters</Typography>
                        </Stack>

                        <Stack spacing={1.5}>
                          {(editKpiForm.advancedFilters || []).map((flt, i) => (
                            <Stack direction="row" spacing={1} key={i} alignItems="center">
                              <Select size="small" value={flt.col} onChange={e => {
                                  const next = [...editKpiForm.advancedFilters];
                                  next[i].col = e.target.value;
                                  setEditKpiForm(f => ({ ...f, advancedFilters: next }));
                                }} sx={{ flex: 2, fontSize: 12, background: "#fff" }} displayEmpty>
                                <MenuItem value=""><em>Select Column...</em></MenuItem>
                                {file?.columns?.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                              </Select>
                              
                              <Select size="small" value={flt.op} onChange={e => {
                                  const next = [...editKpiForm.advancedFilters];
                                  next[i].op = e.target.value;
                                  setEditKpiForm(f => ({ ...f, advancedFilters: next }));
                                }} sx={{ flex: 1, fontSize: 12, background: "#fff" }}>
                                <MenuItem value="=">=</MenuItem>
                                <MenuItem value="!=">!=</MenuItem>
                                <MenuItem value=">">&gt;</MenuItem>
                                <MenuItem value="<">&lt;</MenuItem>
                                <MenuItem value=">=">&gt;=</MenuItem>
                                <MenuItem value="<=">&lt;=</MenuItem>
                                <MenuItem value="contains">contains</MenuItem>
                              </Select>
                              
                              <Select size="small" value={(flt.val && flt.val.startsWith("@")) ? flt.val : "CUSTOM"} onChange={e => {
                                  const next = [...editKpiForm.advancedFilters];
                                  if (e.target.value === "CUSTOM") next[i].val = "";
                                  else next[i].val = e.target.value;
                                  setEditKpiForm(f => ({ ...f, advancedFilters: next }));
                                }} sx={{ flex: (flt.val && flt.val.startsWith("@")) ? 2 : 1.2, fontSize: 12, background: "#fff" }} displayEmpty>
                                {parameters.map(p => <MenuItem key={p.name} value={`@${p.name}`}>@{p.name}</MenuItem>)}
                                <MenuItem value="CUSTOM"><em>Unlinked</em></MenuItem>
                              </Select>

                              {!(flt.val && flt.val.startsWith("@")) && (
                                <TextField size="small" placeholder="Custom Value" value={flt.val || ""} onChange={e => {
                                  const next = [...editKpiForm.advancedFilters];
                                  next[i].val = e.target.value;
                                  setEditKpiForm(f => ({ ...f, advancedFilters: next }));
                                }} sx={{ flex: 2, background: "#fff" }} InputProps={{ sx: { fontSize: 12 } }} />
                              )}

                              <IconButton size="small" color="error" onClick={() => {
                                const next = [...editKpiForm.advancedFilters];
                                next.splice(i, 1);
                                setEditKpiForm(f => ({ ...f, advancedFilters: next }));
                              }}>
                                <DeleteOutline sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Stack>
                          ))}

                          {(!editKpiForm.advancedFilters || editKpiForm.advancedFilters.length === 0) && (
                            <Typography fontSize={11} color="text.secondary" textAlign="center" py={2}>
                              No filters defined. Click "Add Filter" to begin.
                            </Typography>
                          )}

                          <Button size="small" variant="outlined" startIcon={<Add />} onClick={() => {
                            const next = [...(editKpiForm.advancedFilters || []), { col: "", op: "=", val: "" }];
                            setEditKpiForm(f => ({ ...f, advancedFilters: next }));
                          }} sx={{ alignSelf: "flex-start", mt: 1, borderRadius: 8, textTransform: "none", color: "#8b5cf6", borderColor: "#c4b5fd", fontWeight: 700, px: 2 }}>
                            Add Filter
                          </Button>
                        </Stack>
                      </Box>
                    </Box>
                  </Card>
                </Box>
              )}
              {activeKpiSettingCategory === "colors" && (
                <>
                  {/* Colors */}
                  <Box sx={{ background: "#fafafa", borderRadius: 2, p: 1.5, border: "1px solid #eee" }}>
            <Typography fontSize={11} fontWeight={800} textTransform="uppercase" color="text.disabled" letterSpacing={1} mb={1}>🎨 Colors</Typography>
            {[
              { key: "accentColor", label: "Top Border", placeholder: "#c52626" },
              { key: "valueColor", label: "Value", placeholder: "#c52626" },
              { key: "labelColor", label: "Label Text", placeholder: "#333" },
              { key: "bgColor", label: "Background", placeholder: "#FFFDF5" },
            ].map(({ key, label, placeholder }) => (
              <Stack key={key} direction="row" spacing={1} alignItems="center" mb={0.8}>
                <Typography fontSize={12} fontWeight={700} color="text.secondary" sx={{ minWidth: 85 }}>{label}</Typography>
                <Box sx={{ width: 22, height: 22, borderRadius: 1, border: "1.5px solid #ddd", background: editKpiForm[key] || placeholder, flexShrink: 0 }} />
                <TextField size="small" placeholder={placeholder} value={editKpiForm[key] || ""}
                  onChange={(e) => setEditKpiForm(f => ({ ...f, [key]: e.target.value }))}
                  sx={{ width: 95, "& input": { fontSize: 11, fontWeight: 700, fontFamily: "monospace", py: 0.4 } }} />
                <IconButton size="small" onClick={() => setEditKpiForm(f => ({ ...f, [key]: "" }))} sx={{ color: "#bbb" }}><DeleteOutline sx={{ fontSize: 13 }} /></IconButton>
              </Stack>
            ))}
            <Stack direction="row" spacing={0.4} flexWrap="wrap" gap={0.4} mt={0.5}>
              {[...(PALETTES[paletteName] || PALETTES["DashForge"]), "#FFFDF5", "#F5F5F5", "#FFF0F0", "#F0FFF4", "#F0F4FF", "#FFF8E1"].map((c, i) => (
                <Tooltip key={i} title={`Click: border · Shift: bg`} placement="top">
                  <Box onClick={(e) => {
                    if (e.shiftKey) setEditKpiForm(f => ({ ...f, bgColor: c }));
                    else setEditKpiForm(f => ({ ...f, accentColor: c, valueColor: c }));
                  }}
                    sx={{
                      width: 20, height: 20, borderRadius: "4px", background: c, cursor: "pointer",
                      border: (editKpiForm.accentColor === c || editKpiForm.bgColor === c) ? "2px solid #1a1a2e" : `1.5px solid ${c === "#FFFDF5" || c === "#F5F5F5" ? "#ddd" : "transparent"}`,
                      "&:hover": { transform: "scale(1.15)" }, transition: "transform 0.1s"
                    }} />
                </Tooltip>
              ))}
            </Stack>
          </Box>
                </>
              )}
              {activeKpiSettingCategory === "layout" && (
                <>
                  {/* Layout & Features */}
                  <Box sx={{ background: "#fafafa", borderRadius: 2, p: 1.5, border: "1px solid #eee" }}>
            <Typography fontSize={11} fontWeight={800} textTransform="uppercase" color="text.disabled" letterSpacing={1} mb={1}>⚙️ Layout</Typography>
            <Typography fontSize={12} fontWeight={700} color="text.secondary">Text Alignment</Typography>
            <Stack direction="row" spacing={0.5} mt={0.5} mb={1}>
              {[{ v: "left", l: "◀ Left" }, { v: "center", l: "◆ Center" }, { v: "right", l: "▶ Right" }].map(opt => (
                <Chip key={opt.v} label={opt.l} size="small" clickable
                  onClick={() => setEditKpiForm(f => ({ ...f, textAlign: opt.v }))}
                  sx={{
                    fontWeight: 700, fontSize: 11,
                    background: (editKpiForm.textAlign || "center") === opt.v ? "#1a1a2e" : "#f0f0f0",
                    color: (editKpiForm.textAlign || "center") === opt.v ? "#fff" : "#444",
                    border: (editKpiForm.textAlign || "center") === opt.v ? "1.5px solid #a78bfa" : "1.5px solid transparent",
                  }} />
              ))}
            </Stack>

            <Typography fontSize={12} fontWeight={700} color="text.secondary">Value Size</Typography>
            <Stack direction="row" spacing={0.5} mt={0.5} mb={1}>
              {[{ v: 24, l: "Small" }, { v: 32, l: "Medium" }, { v: 42, l: "Large" }, { v: 56, l: "XL" }].map(opt => (
                <Chip key={opt.v} label={opt.l} size="small" clickable
                  onClick={() => setEditKpiForm(f => ({ ...f, valueFontSize: opt.v }))}
                  sx={{
                    fontWeight: 700, fontSize: 11,
                    background: (editKpiForm.valueFontSize || 32) === opt.v ? "#1a1a2e" : "#f0f0f0",
                    color: (editKpiForm.valueFontSize || 32) === opt.v ? "#fff" : "#444",
                    border: (editKpiForm.valueFontSize || 32) === opt.v ? "1.5px solid #a78bfa" : "1.5px solid transparent",
                  }} />
              ))}
            </Stack>

            <FormControlLabel
              control={<Switch size="small" checked={editKpiForm.showStats !== false}
                onChange={(e) => setEditKpiForm(f => ({ ...f, showStats: e.target.checked }))} />}
              label={<Typography fontSize={12} fontWeight={700}>Show Total / Min / Max Stats</Typography>} />
            <FormControlLabel
              control={<Switch size="small" checked={editKpiForm.hasPadding !== false}
                onChange={(e) => setEditKpiForm(f => ({ ...f, hasPadding: e.target.checked }))} />}
              label={<Typography fontSize={12} fontWeight={700}>Enable Padding</Typography>} />
            <FormControlLabel
              control={<Switch size="small" checked={editKpiForm.roundedCorners !== false}
                onChange={(e) => setEditKpiForm(f => ({ ...f, roundedCorners: e.target.checked }))} />}
              label={<Typography fontSize={12} fontWeight={700}>Rounded Corners</Typography>} />
            <Typography fontSize={12} fontWeight={700} color="text.secondary" mt={1}>Borders</Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" mt={0.5}>
              {[
                { k: "borderTop", l: "Top" },
                { k: "borderRight", l: "Right" },
                { k: "borderBottom", l: "Bottom" },
                { k: "borderLeft", l: "Left" }
              ].map(opt => (
                <FormControlLabel
                  key={opt.k}
                  control={<Checkbox size="small" checked={editKpiForm[opt.k] !== false}
                    onChange={(e) => setEditKpiForm(f => ({ ...f, [opt.k]: e.target.checked }))} />}
                  label={<Typography fontSize={11} fontWeight={700}>{opt.l}</Typography>} />
              ))}
            </Stack>

            <Typography fontSize={12} fontWeight={700} color="text.secondary" mt={1}>Outer Gap (px)</Typography>
            <Stack direction="row" spacing={1} mt={0.5}>
              {[
                { k: "gapTop", l: "Top" },
                { k: "gapRight", l: "Right" },
                { k: "gapBottom", l: "Bottom" },
                { k: "gapLeft", l: "Left" }
              ].map(opt => (
                <TextField key={opt.k} label={opt.l} size="small" type="number"
                  value={editKpiForm[opt.k] || 0}
                  onChange={(e) => setEditKpiForm(f => ({ ...f, [opt.k]: Number(e.target.value) }))}
                  InputLabelProps={{ shrink: true, sx: { fontSize: 13, fontWeight: 600 } }}
                  sx={{ width: 65, "& input": { fontSize: 13, py: 0.6, textAlign: "center", fontWeight: 700 } }} />
              ))}
            </Stack>

            {(editKpiForm.borderTop !== false || editKpiForm.borderRight !== false || editKpiForm.borderBottom !== false || editKpiForm.borderLeft !== false) && (
              <Stack spacing={0.5} mt={0.8}>
                <Typography fontSize={12} fontWeight={700} color="text.secondary">Border Color</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ width: 24, height: 24, borderRadius: 1, border: "1.5px solid #ddd", background: editKpiForm.borderColor || "#eeeeee", flexShrink: 0 }} />
                  <TextField size="small" placeholder="#eeeeee" value={editKpiForm.borderColor || ""}
                    onChange={(e) => setEditKpiForm(f => ({ ...f, borderColor: e.target.value }))}
                    sx={{ width: 110, "& input": { fontSize: 11, fontFamily: "monospace", py: 0.4 } }} />
                  <input type="color" value={editKpiForm.borderColor || "#eeeeee"}
                    onChange={(e) => setEditKpiForm(f => ({ ...f, borderColor: e.target.value }))}
                    style={{ width: 28, height: 28, border: "none", padding: 0, cursor: "pointer", borderRadius: 4 }} />
                  <IconButton size="small" onClick={() => setEditKpiForm(f => ({ ...f, borderColor: "" }))} sx={{ color: "#bbb" }}><DeleteOutline sx={{ fontSize: 13 }} /></IconButton>
                </Stack>
                <Stack direction="row" spacing={0.4} flexWrap="wrap" gap={0.4}>
                  {["#eeeeee", "#f0f0f0", "#d0d0d0", "#c52626", "#1565C0", "#449042", "#F57C00", "#6A1B9A", "#1a1a2e", "#000"].map((c, i) => (
                    <Box key={i} onClick={() => setEditKpiForm(f => ({ ...f, borderColor: c }))}
                      sx={{
                        width: 20, height: 20, borderRadius: "4px", background: c, cursor: "pointer",
                        border: editKpiForm.borderColor === c ? "2px solid #1a1a2e" : "1.5px solid transparent",
                        "&:hover": { transform: "scale(1.15)" }, transition: "transform 0.1s"
                      }} />
                  ))}
                </Stack>
              </Stack>
            )}
          </Box>
                </>
              )}
              {activeKpiSettingCategory === "cond" && (
                <Box sx={{ display: "flex", flexDirection: "column" }}>
                  <Card sx={{ borderRadius: 4, border: "1px solid #eaeaea", boxShadow: "0px 4px 20px rgba(0,0,0,0.02)", bgcolor: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    <Box sx={{ p: 2, px: 3, borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 1.5 }}>
                      <ColorLens sx={{ fontSize: 22, color: "#64748b" }} />
                      <Typography fontSize={14} fontWeight={800} textTransform="uppercase" color="#64748b" letterSpacing={1}>Conditional Formatting</Typography>
                    </Box>
                    <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 3 }}>
                      <Box sx={{ borderRadius: 6, border: "1px solid #f1f5f9", p: 2.5 }}>
                        <Stack direction="row" spacing={1.5} alignItems="center" mb={2}>
                          <SpaceBar sx={{ fontSize: 18, color: "#94a3b8" }} />
                          <Typography fontSize={12} fontWeight={800} textTransform="uppercase" color="#94a3b8" letterSpacing={1}>Formatting Rules</Typography>
                        </Stack>

                        {(editKpiForm.conditionalFormats || []).map((rule, i) => (
                          <Box key={i} sx={{ background: "#fff", p: 1.5, borderRadius: 2, border: "1px solid #eee", mb: 1.5 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                              <Stack direction="row" alignItems="center" spacing={1}>
                                <Typography fontSize={11} fontWeight={800} color="text.secondary">Rule {i+1}</Typography>
                              </Stack>
                              <IconButton size="small" onClick={() => {
                                const next = [...editKpiForm.conditionalFormats];
                                next.splice(i, 1);
                                setEditKpiForm(f => ({ ...f, conditionalFormats: next }));
                              }} sx={{ color: "#bbb", p: 0.3 }}><DeleteOutline sx={{ fontSize: 14 }} /></IconButton>
                            </Stack>

                            <Stack spacing={1}>
                              <Select size="small" value={rule.col} onChange={e => {
                                  const next = [...editKpiForm.conditionalFormats];
                                  next[i].col = e.target.value;
                                  setEditKpiForm(f => ({ ...f, conditionalFormats: next }));
                                }} sx={{ fontSize: 12, background: "#fbfbfb" }} displayEmpty>
                                <MenuItem value=""><em>Select Column...</em></MenuItem>
                                {editKpiForm.config?.measure && (
                                  <MenuItem value={editKpiForm.config?.measure} sx={{ fontWeight: 800, color: "primary.main", background: "#f0f7ff" }}>
                                    🎯 Measure: {editKpiForm.config?.agg ? editKpiForm.config.agg.toUpperCase() + '(' + editKpiForm.config.measure + ')' : editKpiForm.config?.measure}
                                  </MenuItem>
                                )}
                                {file?.columns?.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                              </Select>

                              <Stack direction="row" spacing={1}>
                                <Select size="small" value={rule.op} onChange={e => {
                                  const next = [...editKpiForm.conditionalFormats];
                                  next[i].op = e.target.value;
                                  setEditKpiForm(f => ({ ...f, conditionalFormats: next }));
                                }} sx={{ flex: 1, fontSize: 12, background: "#fbfbfb" }}>
                                  <MenuItem value="=">=</MenuItem>
                                  <MenuItem value="!=">!=</MenuItem>
                                  <MenuItem value=">">&gt;</MenuItem>
                                  <MenuItem value="<">&lt;</MenuItem>
                                  <MenuItem value=">=">&gt;=</MenuItem>
                                  <MenuItem value="<=">&lt;=</MenuItem>
                                  <MenuItem value="contains">contains</MenuItem>
                                  <MenuItem value="between">between</MenuItem>
                                </Select>
                                <TextField size="small" placeholder={rule.op === "between" ? "Min" : "Value"} value={rule.val || ""} onChange={e => {
                                  const next = [...editKpiForm.conditionalFormats];
                                  next[i].val = e.target.value;
                                  setEditKpiForm(f => ({ ...f, conditionalFormats: next }));
                                }} sx={{ flex: 2, background: "#fbfbfb", "& input": { fontSize: 12, py: 0.8 } }} />
                                {rule.op === "between" && (
                                  <TextField size="small" placeholder="Max" value={rule.val2 || ""} onChange={e => {
                                    const next = [...editKpiForm.conditionalFormats];
                                    next[i].val2 = e.target.value;
                                    setEditKpiForm(f => ({ ...f, conditionalFormats: next }));
                                  }} sx={{ flex: 2, background: "#fbfbfb", "& input": { fontSize: 12, py: 0.8 } }} />
                                )}
                              </Stack>

                              <Stack direction="row" spacing={1}>
                                <Select size="small" value={rule.target || "text"} onChange={e => {
                                  const next = [...editKpiForm.conditionalFormats];
                                  next[i].target = e.target.value;
                                  setEditKpiForm(f => ({ ...f, conditionalFormats: next }));
                                }} sx={{ flex: 1, fontSize: 12, background: "#fbfbfb" }}>
                                  <MenuItem value="text">Value Text</MenuItem>
                                  <MenuItem value="bg">Background</MenuItem>
                                  <MenuItem value="border">Border</MenuItem>
                                </Select>
                                
                                <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: 1 }}>
                                  <Box sx={{ width: 22, height: 22, borderRadius: 1, background: rule.color || "#ff4757", border: "1px solid #ddd" }} />
                                  <input type="color" value={rule.color || "#ff4757"} onChange={e => {
                                    const next = [...editKpiForm.conditionalFormats];
                                    next[i].color = e.target.value;
                                    setEditKpiForm(f => ({ ...f, conditionalFormats: next }));
                                  }} style={{ width: 28, height: 28, padding: 0, border: "none", cursor: "pointer", borderRadius: 4 }} />
                                </Box>
                              </Stack>
                            </Stack>
                          </Box>
                        ))}

                        {(!editKpiForm.conditionalFormats || editKpiForm.conditionalFormats.length === 0) && (
                          <Typography fontSize={11} color="text.secondary" textAlign="center" py={2}>
                            No rules defined. Click "Add Rule" to begin.
                          </Typography>
                        )}

                        <Button size="small" variant="outlined" startIcon={<Add />} onClick={() => {
                          const next = [...(editKpiForm.conditionalFormats || []), { type: "simple", col: "", op: "=", val: "", color: "#ff4757", target: "text" }];
                          setEditKpiForm(f => ({ ...f, conditionalFormats: next }));
                        }} sx={{ alignSelf: "flex-start", mt: 1, borderRadius: 8, textTransform: "none", color: "#8b5cf6", borderColor: "#c4b5fd", fontWeight: 700, px: 2 }}>
                          Add Rule
                        </Button>

                      </Box>
                    </Box>
                  </Card>
                </Box>
              )}
            </>
          )}
        </Box>
        <Box sx={{ p: 2, borderTop: "1px solid #eaeaea", bgcolor: "#fff", display: "flex", gap: 1, justifyContent: "flex-end" }}>
          <Button onClick={() => { setEditingKpi(null); setActiveKpiSettingCategory(null); }} color="inherit" sx={{ fontWeight: 600 }}>Cancel</Button>
          <Button onClick={async () => {
            if (editKpiForm.config) {
              setEditLoading(true);
              try {
                const { data } = await axios.post(`${API}/build_kpi`, {
                  file_id: fileId,
                  measure: editKpiForm.config.measure,
                  label: editKpiForm.config.label,
                  agg: editKpiForm.config.agg,
                  filters: editKpiForm.filters || {},
                  advanced_filters: editKpiForm.advancedFilters || [],
                  parameters: parameterValues
                });
                const updatedForm = {
                  ...editKpiForm,
                  total: data.total,
                  avg: data.avg,
                  min: data.min,
                  max: data.max,
                  count: data.count,
                  count_dist: data.count_dist,
                  _raw_avg: data._raw_avg,
                  _raw_total: data._raw_total,
                  _raw_min: data._raw_min,
                  _raw_max: data._raw_max
                };
                const next = { ...kpiOverrides, [editingKpi._origLabel]: updatedForm };
                setKpiOverrides(next);
                localStorage.setItem(`kpi_overrides_${lk}`, JSON.stringify(next));
                setEditingKpi(null);
                setActiveKpiSettingCategory(null);
              } catch (err) {
                setEditError("Failed to update KPI. Please verify filters.");
              } finally {
                setEditLoading(false);
              }
            } else {
              const next = { ...kpiOverrides, [editingKpi._origLabel]: editKpiForm };
              setKpiOverrides(next);
              localStorage.setItem(`kpi_overrides_${lk}`, JSON.stringify(next));
              setEditingKpi(null);
            }
          }} variant="contained" sx={{ background: R, color: "#fff", fontWeight: 700, borderRadius: 2 }}>
            {editLoading ? <CircularProgress size={16} color="inherit" /> : "Save Changes"}
          </Button>
        </Box>
      </Drawer>

      {/* Builder Modal */}
      <BuilderModal
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        file={file}
        fileId={fileId}
        slots={activeSlots}
        pieColors={activePieColors}
        onPin={(item) => {
          if (item._kpiPin) {
            const current = [...pinnedKpis];
            const newItem = { ...item, id: item.id || `kpi_pin_${Math.random().toString(36).slice(2, 7)}`, tabId: activeTabId };
            current.push(newItem);
            localStorage.setItem(`pinned_kpis_${lk}`, JSON.stringify(current));
            setPinnedKpis(current);
          } else {
            const currentPinned = [...pinnedCharts];
            const newItem = { ...item, id: item.id || `chart_pin_${Math.random().toString(36).slice(2, 7)}`, tabId: activeTabId };
            currentPinned.push(newItem);
            localStorage.setItem(`pinned_charts_${lk}`, JSON.stringify(currentPinned));
            setPinnedCharts(currentPinned);
          }
          setBuilderOpen(false);
          setIsSaved(false);
        }}
      />

      <ScheduleModal open={scheduleOpen} onClose={() => setScheduleOpen(false)} fileId={fileId} />
      <DictionaryModal
        open={dictionaryOpen}
        onClose={async () => {
          setDictionaryOpen(false);
          try {
            const { data } = await axios.get(`${API}/dashboards/${fileId}`);
            if (data && onUpdateFile) onUpdateFile(data);
          } catch (e) {
            console.error("Failed to refresh dashboard metadata", e);
          }
        }}
        fileId={fileId}
      />

      <FloatingChat fileId={fileId} />

      {/* Header Customize Dialog */}
      <Drawer anchor="right" PaperProps={{ sx: { width: { xs: "100vw", sm: 420 }, bgcolor: "#fafafa" } }} open={editingHeader} onClose={() => setEditingHeader(false)}  >
        <Box sx={{ p: 2, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #eaeaea", bgcolor: "#fff" }}>Customize Header</Box>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, p: 3, overflowY: "auto", flex: 1 }}>
          <TextField
            label="Title Override"
            size="small"
            value={editHeaderForm.title || ""}
            onChange={e => setEditHeaderForm(p => ({ ...p, title: e.target.value }))}
            placeholder={file?.title || file?.filename}
          />
          <Stack direction="row" spacing={2}>
            <FormControl size="small" fullWidth>
              <InputLabel>Alignment</InputLabel>
              <Select
                value={editHeaderForm.align || "left"}
                label="Alignment"
                onChange={e => setEditHeaderForm(p => ({ ...p, align: e.target.value }))}
              >
                <MenuItem value="left">Left</MenuItem>
                <MenuItem value="center">Center</MenuItem>
                <MenuItem value="right">Right</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Font Family</InputLabel>
              <Select
                value={editHeaderForm.fontFamily || ""}
                label="Font Family"
                onChange={e => setEditHeaderForm(p => ({ ...p, fontFamily: e.target.value }))}
              >
                <MenuItem value="">Default</MenuItem>
                <MenuItem value="Inter, sans-serif">Inter</MenuItem>
                <MenuItem value="Roboto, sans-serif">Roboto</MenuItem>
                <MenuItem value="Outfit, sans-serif">Outfit</MenuItem>
                <MenuItem value="monospace">Monospace</MenuItem>
                <MenuItem value="serif">Serif</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Font Size (px)"
              size="small"
              type="number"
              fullWidth
              value={editHeaderForm.fontSize || ""}
              onChange={e => setEditHeaderForm(p => ({ ...p, fontSize: e.target.value }))}
              placeholder="34"
            />
            <FormControl size="small" fullWidth>
              <InputLabel>Font Weight</InputLabel>
              <Select
                value={editHeaderForm.fontWeight || ""}
                label="Font Weight"
                onChange={e => setEditHeaderForm(p => ({ ...p, fontWeight: e.target.value }))}
              >
                <MenuItem value="">Default</MenuItem>
                <MenuItem value={400}>Normal (400)</MenuItem>
                <MenuItem value={600}>Semi-Bold (600)</MenuItem>
                <MenuItem value={700}>Bold (700)</MenuItem>
                <MenuItem value={900}>Black (900)</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Text Color"
              size="small"
              fullWidth
              value={editHeaderForm.color || ""}
              onChange={e => setEditHeaderForm(p => ({ ...p, color: e.target.value }))}
              placeholder="#222"
            />
            <TextField
              label="Background Color"
              size="small"
              fullWidth
              value={editHeaderForm.bgColor || ""}
              onChange={e => setEditHeaderForm(p => ({ ...p, bgColor: e.target.value }))}
              placeholder="transparent"
            />
          </Stack>
          <FormControlLabel
            control={
              <Switch
                checked={editHeaderForm.hideBorder || false}
                onChange={e => setEditHeaderForm(p => ({ ...p, hideBorder: e.target.checked }))}
              />
            }
            label="Hide Bottom Border"
          />

          <Box sx={{ mt: 1, pt: 2, borderTop: "1px solid #eee" }}>
            <FormControlLabel
              control={
                <Switch
                  checked={editHeaderForm.showBackButton !== false} // Default true
                  onChange={e => setEditHeaderForm(p => ({ ...p, showBackButton: e.target.checked }))}
                />
              }
              label={
                <Typography fontWeight={700} fontSize={14}>
                  Show Back Button on Custom Tabs
                </Typography>
              }
            />
            {editHeaderForm.showBackButton !== false && (
              <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Back Icon</InputLabel>
                  <Select
                    value={editHeaderForm.backButtonIcon || "arrow"}
                    label="Back Icon"
                    onChange={e => setEditHeaderForm(p => ({ ...p, backButtonIcon: e.target.value }))}
                  >
                    <MenuItem value="arrow">Arrow (Default)</MenuItem>
                    <MenuItem value="chevron">Chevron</MenuItem>
                    <MenuItem value="keyboard">Backspace</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="Icon Color"
                  size="small"
                  fullWidth
                  value={editHeaderForm.backButtonColor || ""}
                  onChange={e => setEditHeaderForm(p => ({ ...p, backButtonColor: e.target.value }))}
                  placeholder="#222"
                />
              </Stack>
            )}
          </Box>
        </Box>
        <Box sx={{ p: 2, borderTop: "1px solid #eaeaea", bgcolor: "#fff", display: "flex", gap: 1, justifyContent: "flex-end" }}>
          <Button onClick={() => setEditingHeader(false)} color="inherit" sx={{ fontWeight: 600 }}>Cancel</Button>
          <Button
            onClick={() => {
              const newConfig = { ...headerConfig, ...editHeaderForm };
              setHeaderConfig(newConfig);
              localStorage.setItem(`header_config_${lk}`, JSON.stringify(newConfig));
              setIsSaved(false);
              setEditingHeader(false);
            }}
            variant="contained"
            sx={{ fontWeight: 600, borderRadius: 2 }}
          >
            Apply
          </Button>
        </Box>
      </Drawer>

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
            onKeyDown={(e) => e.key === "Enter" && handleRenameDashboard()}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRenameOpen(false)} color="inherit" disabled={renameLoading} sx={{ textTransform: "none", fontWeight: 700 }}>
            Cancel
          </Button>
          <Button onClick={handleRenameDashboard} variant="contained" disabled={renameLoading || !renameVal.trim()} sx={{ background: R, "&:hover": { background: "#a01e1e" }, textTransform: "none", fontWeight: 700 }}>
            {renameLoading ? <CircularProgress size={20} color="inherit" /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Filter Modal */}
      <Drawer anchor="right" PaperProps={{ sx: { width: { xs: "100vw", sm: 420 }, bgcolor: "#fafafa" } }} open={Boolean(editingFilter)} onClose={() => setEditingFilter(null)}   >
        <Box sx={{ p: 2, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #eaeaea", bgcolor: "#fff" }}>
          <span>Edit Filter Widget</span>
          <IconButton onClick={() => setEditingFilter(null)} size="small"><Close /></IconButton>
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, p: 3, overflowY: "auto", flex: 1 }}>
          <Box sx={{ background: "#fff", borderRadius: 2, p: 2, border: "1px solid #eee", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
            <Typography fontSize={11} fontWeight={800} textTransform="uppercase" color="text.disabled" letterSpacing={1} mb={2}>Widget Header</Typography>
            <Stack spacing={2}>
              <TextField label="Title Override" size="small" fullWidth value={editFilterForm.title || ""} onChange={e => setEditFilterForm(f => ({ ...f, title: e.target.value }))}
                placeholder={editFilterForm.col}
              />
              <Stack direction="row" spacing={2}>
                <TextField label="Title Font Size" size="small" type="number" value={editFilterForm.fontSize || 13} onChange={e => setEditFilterForm(f => ({ ...f, fontSize: Number(e.target.value) }))} sx={{ width: 120 }} />
                <FormControl size="small" sx={{ width: 150 }}>
                  <InputLabel>Title Align</InputLabel>
                  <Select value={editFilterForm.textAlign || "left"} onChange={e => setEditFilterForm(f => ({ ...f, textAlign: e.target.value }))} label="Title Align">
                    <MenuItem value="left">Left</MenuItem>
                    <MenuItem value="center">Center</MenuItem>
                    <MenuItem value="right">Right</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </Stack>
          </Box>
          <Box sx={{ background: "#fff", borderRadius: 2, p: 2, border: "1px solid #eee", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
            <Typography fontSize={11} fontWeight={800} textTransform="uppercase" color="text.disabled" letterSpacing={1} mb={2}>Colors & Styling</Typography>
            <Stack direction="row" spacing={2} mb={2}>
              <TextField label="Background Color" size="small" fullWidth value={editFilterForm.bgColor || "#ffffff"} onChange={e => setEditFilterForm(f => ({ ...f, bgColor: e.target.value }))} />
              <TextField label="Accent Color" size="small" fullWidth value={editFilterForm.accentColor || ""} onChange={e => setEditFilterForm(f => ({ ...f, accentColor: e.target.value }))} placeholder="e.g. #c52626" />
            </Stack>
            <Stack direction="row" spacing={3} flexWrap="wrap">
              <FormControlLabel control={<Switch checked={editFilterForm.hasPadding !== false} onChange={e => setEditFilterForm(f => ({ ...f, hasPadding: e.target.checked }))} />} label={<Typography fontSize={13} fontWeight={600}>Has Padding</Typography>} />
              <FormControlLabel control={<Switch checked={editFilterForm.hasBorder !== false} onChange={e => setEditFilterForm(f => ({ ...f, hasBorder: e.target.checked }))} />} label={<Typography fontSize={13} fontWeight={600}>Has Border</Typography>} />
              <FormControlLabel control={<Switch checked={editFilterForm.roundedCorners !== false} onChange={e => setEditFilterForm(f => ({ ...f, roundedCorners: e.target.checked }))} />} label={<Typography fontSize={13} fontWeight={600}>Rounded Corners</Typography>} />
            </Stack>
          </Box>
        </Box>
        <Box sx={{ p: 2, borderTop: "1px solid #eaeaea", bgcolor: "#fff", display: "flex", gap: 1, justifyContent: "flex-end" }}>
          <Button onClick={() => setEditingFilter(null)} color="inherit" sx={{ fontWeight: 600 }}>Cancel</Button>
          <Button onClick={() => {
            const next = { ...filterOverrides, [editingFilter]: editFilterForm };
            setFilterOverrides(next);
            localStorage.setItem(`filter_overrides_${lk}`, JSON.stringify(next));
            setEditingFilter(null);
          }} variant="contained" sx={{ background: R, color: "#fff", fontWeight: 700, borderRadius: 2 }}>Save Changes</Button>
        </Box>
      </Drawer>

      <ParameterModal
        open={parameterModalOpen}
        columns={file?.columns || []}
        onClose={() => setParameterModalOpen(false)}
        parameters={parameters}
        onSave={(newParams) => {
          setParameters(newParams);
          setParameterModalOpen(false);
          // Auto-initialize empty values for new parameters
          const nextVals = { ...parameterValues };
          newParams.forEach(p => {
            if (!(p.name in nextVals)) {
              nextVals[p.name] = p.defaultValue;
            }
          });
          setParameterValues(nextVals);
          localStorage.setItem(`parameters_${lk}`, JSON.stringify(newParams));
          localStorage.setItem(`parameter_values_${lk}`, JSON.stringify(nextVals));
        }}
      />
      <Menu
        anchorEl={trendMenuAnchor}
        open={Boolean(trendMenuAnchor)}
        onClose={() => setTrendMenuAnchor(null)}
      >
        {["auto", "year", "quarter", "month", "date", "weekday", "hour"].map((t) => (
          <MenuItem
            key={t}
            selected={(trendActiveChart?._timeGrouping || trendActiveChart?.config?.time_grouping || "auto") === t}
            onClick={() => handleTrendChange(t)}
            sx={{ fontSize: 13, textTransform: "capitalize", minWidth: 120 }}
          >
            {t === "auto" ? "Default (Auto)" : t}
          </MenuItem>
        ))}
      </Menu>

      <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={() => setSnackbarOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnackbarOpen(false)} severity="error" sx={{ width: '100%', fontWeight: 700, borderRadius: 2 }}>
          {snackbarMsg}
        </Alert>
      </Snackbar>

      <DrilldownDrawer
        open={drilldownOpen}
        onClose={() => setDrilldownOpen(false)}
        fileId={fileId}
        filterCol={filterCol}
        filterVal={filterVal}
        crossFilterCol={activeCrossFilter?.col}
        crossFilterVal={activeCrossFilter?.val}
      />
    </Stack>
  );
};

export default OverviewTab;



