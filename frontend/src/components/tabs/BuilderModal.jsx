import { useState, useEffect } from "react";
import axios from "axios";
import {
  Dialog, Slide, AppBar, Toolbar, IconButton, Typography,
  Button, Box, Stack, Divider, Select, MenuItem,
  FormControl, InputLabel, CircularProgress, Chip, Tabs, Tab,
  TextField, Card, CardContent, Checkbox, ListItemText,
  FormControlLabel, Switch
} from "@mui/material";
import {
  Close, DragIndicator, Insights, PushPin, AutoGraph, Speed,
  FormatAlignLeft, FormatAlignCenter, FormatAlignRight, AutoFixHigh,
  Palette, DeleteOutline
} from "@mui/icons-material";
import { ChartCard } from "./OverviewTab";
import React from 'react';
import { API } from "../../constants";

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const BUILDER_LABEL_ALIGNS = [
  { value: "horizontal", label: "Horizontal", icon: <FormatAlignLeft sx={{ fontSize: 14 }} /> },
  { value: "angled", label: "45° Angled", icon: <FormatAlignCenter sx={{ fontSize: 14, transform: "rotate(-45deg)" }} /> },
  { value: "vertical", label: "Vertical", icon: <FormatAlignRight sx={{ fontSize: 14, transform: "rotate(-90deg)" }} /> },
];

const BuilderModal = ({ open, onClose, file, fileId, onPin, slots, pieColors }) => {
  const getErrorMessage = (err, defaultMsg) => {
    const detail = err?.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail.map(d => `${d.loc ? d.loc.join(".") : ""}: ${d.msg}`).join(", ");
    }
    if (detail && typeof detail === "object") {
      return JSON.stringify(detail);
    }
    return err?.message || defaultMsg;
  };

  const [xCol, setXCol] = useState(null);   // Dimension
  const [extraCols, setExtraCols] = useState([]); // Extra Dimensions (For Tables)
  const [yCol, setYCol] = useState(null);   // Measure (optional for pie/COUNT)
  const [groupByCol, setGroupByCol] = useState(null); // Group By (Optional for Multiline/Grouped Bar)
  const [agg, setAgg] = useState("SUM");
  const [chartType, setChartType] = useState("bar");
  const [builderLabelAlign, setBuilderLabelAlign] = useState("horizontal");
  const [chartLimit, setChartLimit] = useState(10);

  const [labelCol, setLabelCol] = useState(null);
  const [labelAgg, setLabelAgg] = useState("MAX");

  // Custom Chart Style states
  const [chartTitle, setChartTitle] = useState("");
  const [chartColor, setChartColor] = useState("");
  const [headerColor, setHeaderColor] = useState("");
  const [textColor, setTextColor] = useState("");
  const [bgColor, setBgColor] = useState("");
  const [chartMapRegion, setChartMapRegion] = useState("usa");
  const [gaugeTarget, setGaugeTarget] = useState(100);
  const [pieSliceColors, setPieSliceColors] = useState({});
  const [pieLabelMode, setPieLabelMode] = useState("percent");
  const [hasPadding, setHasPadding] = useState(true);
  const [hasBorder, setHasBorder] = useState(true);
  const [roundedCorners, setRoundedCorners] = useState(true);

  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [chartPrompt, setChartPrompt] = useState("");
  const [chartFilters, setChartFilters] = useState({});
  const [timeGrouping, setTimeGrouping] = useState("none");
  const isDateCol = file?.date_columns?.includes(xCol);

  // KPI tab state
  const [activeTab, setActiveTab] = useState(0);
  const [kpiCol, setKpiCol] = useState("");
  const [kpiLabel, setKpiLabel] = useState("");
  const [kpiAgg, setKpiAgg] = useState("ALL");
  const [kpiPreview, setKpiPreview] = useState(null);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpiError, setKpiError] = useState("");
  const [kpiPrompt, setKpiPrompt] = useState("");
  const [kpiFilters, setKpiFilters] = useState({});
  const [availableFilterValues, setAvailableFilterValues] = useState({});

  const loadFilterValues = (col, isKpi = false) => {
    axios.get(`${API}/column_values/${fileId}/${encodeURIComponent(col)}`)
      .then(({ data }) => {
        setAvailableFilterValues(prev => ({ ...prev, [col]: data.values }));
        if (isKpi) {
          setKpiFilters(prev => ({ ...prev, [col]: data.values }));
          setKpiPreview(null);
        } else {
          setChartFilters(prev => ({ ...prev, [col]: data.values }));
        }
      })
      .catch(err => console.error("Failed to load filter values", err));
  };

  const renderFilterInput = (k, v, isKpi) => {
    const list = availableFilterValues[k] || [];
    const selected = Array.isArray(v) ? v : (v ? [v] : []);
    const isAllSelected = selected.length === list.length;

    const setSelected = (nextVal) => {
      if (isKpi) {
        setKpiFilters(prev => ({ ...prev, [k]: nextVal }));
        setKpiPreview(null);
      } else {
        setChartFilters(prev => ({ ...prev, [k]: nextVal }));
      }
    };

    const handleToggleAll = (e) => {
      e.stopPropagation();
      if (isAllSelected) {
        setSelected([]);
      } else {
        setSelected(list);
      }
    };

    const handleToggleValue = (val) => {
      if (selected.includes(val)) {
        setSelected(selected.filter(x => x !== val));
      } else {
        setSelected([...selected, val]);
      }
    };

    return (
      <Stack key={k} direction="row" spacing={1} alignItems="center" sx={{ width: "100%" }}>
        <Chip label={k} size="small" onDelete={() => {
          if (isKpi) {
            const nf = { ...kpiFilters }; delete nf[k]; setKpiFilters(nf); setKpiPreview(null);
          } else {
            const nf = { ...chartFilters }; delete nf[k]; setChartFilters(nf);
          }
        }} sx={{ maxWidth: 100, fontSize: 10, fontWeight: 700 }} />
        <FormControl size="small" sx={{ flex: 1, minWidth: 120 }}>
          <Select
            multiple
            value={selected}
            displayEmpty
            renderValue={(selectedList) => {
              if (selectedList.length === list.length) return "All selected";
              if (selectedList.length === 0) return "None selected";
              return selectedList.slice(0, 2).join(", ") + (selectedList.length > 2 ? "..." : "");
            }}
            sx={{ background: "#fff", "& .MuiSelect-select": { fontSize: 12, py: 0.5, px: 1, height: 20, display: "flex", alignItems: "center" } }}
          >
            <MenuItem onClick={handleToggleAll} sx={{ py: 0.5, fontWeight: 700 }}>
              <Checkbox size="small" checked={isAllSelected} indeterminate={selected.length > 0 && selected.length < list.length} />
              <ListItemText primary="Select All" primaryTypographyProps={{ fontSize: 12, fontWeight: 700 }} />
            </MenuItem>
            {list.map(val => {
              const isChecked = selected.includes(val);
              return (
                <MenuItem key={val} onClick={() => handleToggleValue(val)} sx={{ py: 0.5 }}>
                  <Checkbox size="small" checked={isChecked} />
                  <ListItemText primary={val} primaryTypographyProps={{ fontSize: 12 }} />
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>
      </Stack>
    );
  };

  const dimensions = file?.columns?.filter(c => !file?.numeric_columns?.includes(c)) || [];
  const measures = file?.numeric_columns || [];

  useEffect(() => {
    if (open) {
      setXCol(null);
      setYCol(null);
      setAgg("SUM");
      setChartType("bar");
      setBuilderLabelAlign("horizontal");
      setPreview(null);
      setError("");
      setChartPrompt("");
      setChartFilters({});
      setTimeGrouping("none");

      setActiveTab(0);
      setKpiCol("");
      setKpiLabel("");
      setKpiAgg("ALL");
      setKpiPreview(null);
      setKpiError("");
      setKpiPrompt("");
      setKpiFilters({});
      setAvailableFilterValues({});
      setChartLimit(10);

      // Reset style settings
      setChartTitle("");
      setChartColor("");
      setHeaderColor("");
      setTextColor("");
      setBgColor("");
      setPieSliceColors({});
      setPieLabelMode("percent");
      setHasPadding(true);
      setHasBorder(true);
      setRoundedCorners(true);
    }
  }, [open]);

  // Regrow/reset title and custom colors when columns change
  useEffect(() => {
    setChartTitle("");
    setPieSliceColors({});
  }, [xCol, yCol, agg, chartType]);

  // Prefill title from preview when it loads
  useEffect(() => {
    if (preview) {
      setChartTitle(preview.title || "");
    }
  }, [preview]);

  useEffect(() => {
    if (chartType === "pie") {
      setChartLimit(10);
    } else {
      setChartLimit(40);
    }
  }, [chartType]);

  const fetchKpi = (col, label, agg = "ALL", filters = kpiFilters) => {
    if (!col) return;
    setKpiLoading(true); setKpiError(""); setKpiPreview(null);
    axios.post(`${API}/build_kpi`, { file_id: fileId, measure: col, label: label || col, agg, filters })
      .then(({ data }) => setKpiPreview({ 
        ...data, 
        label: label || col,
        _kpiPin: true,
        filters: filters,
        config: {
          measure: col,
          label: label || col,
          agg: agg
        }
      }))
      .catch(err => setKpiError(getErrorMessage(err, "Failed to build KPI.")))
      .finally(() => setKpiLoading(false));
  };

  const buildKpiWithAi = () => {
    if (!kpiPrompt.trim()) return;
    setKpiLoading(true); setKpiError(""); setKpiPreview(null);
    axios.post(`${API}/build_kpi`, { file_id: fileId, prompt: kpiPrompt.trim(), measure: "", label: "", agg: "ALL" })
      .then(({ data }) => {
        // Need to update the UI drop zone states to reflect AI's choice
        // But the endpoint only returns label, agg_mode, etc. We'll set what we can.
        // Let's assume the endpoint returns _origLabel = col name roughly, but we can't be sure of raw column name.
        // It's okay, the preview is what matters most for pinning.
        if (data.filters) setKpiFilters(data.filters);
        setKpiPreview({ ...data, _kpiPin: true });
      })
      .catch(err => setKpiError(getErrorMessage(err, "Failed to build KPI with AI.")))
      .finally(() => setKpiLoading(false));
  };

  const canBuild = !!xCol;

  const buildWithAi = () => {
    if (!chartPrompt.trim()) return;
    setLoading(true); setError(""); setPreview(null);
    axios.post(`${API}/build_chart`, {
      file_id: fileId,
      prompt: chartPrompt.trim(),
      dimension: xCol || "",
      measure: yCol || "",
      agg: yCol ? agg : "COUNT",
      chart_type: chartType,
      limit: chartLimit,
      label_col: labelCol || undefined,
      label_agg: labelCol ? labelAgg : undefined,
      group_by: groupByCol || undefined,
      map_region: chartMapRegion || undefined
    }).then(({ data }) => {
      if (data.error) setError(data.error);
      else {
        if (data.config) {
          setXCol(data.config.dimension);
          if (data.config.measure && data.config.measure !== data.config.dimension && data.config.agg !== "COUNT") {
            setYCol(data.config.measure);
          } else if (data.config.agg === "COUNT" && data.config.measure !== data.config.dimension) {
            setYCol(data.config.measure);
          }
          setAgg(data.config.agg);
          setChartType(data.config.chart_type);
          if (data.config.filters) setChartFilters(data.config.filters);
          if (data.config.time_grouping) setTimeGrouping(data.config.time_grouping);
          if (data.config.limit) setChartLimit(data.config.limit);
        }
        setPreview(data);
      }
    }).catch(err => {
      setError(getErrorMessage(err, "Failed to build chart with AI."));
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!canBuild) return;
    setLoading(true);
    setError("");
    setPreview(null);
    axios.post(`${API}/build_chart`, {
      file_id: fileId,
      dimension: xCol,
      measure: yCol || xCol,          // backend ignores when COUNT is used
      agg: yCol ? agg : "COUNT",      // no measure → always COUNT
      chart_type: chartType,
      filters: chartFilters,
      time_grouping: timeGrouping,
      limit: chartLimit,
      label_col: labelCol || undefined,
      label_agg: labelCol ? labelAgg : undefined,
      group_by: groupByCol || undefined,
      map_region: chartMapRegion || undefined,
      gauge_target: gaugeTarget,
      extra_cols: chartType === "table" ? extraCols : undefined
    }).then(({ data }) => {
      if (data.error) setError(data.error);
      else setPreview(data);
    }).catch(err => {
      setError(getErrorMessage(err, "Failed to build chart."));
    }).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xCol, yCol, agg, chartType, fileId, chartFilters, timeGrouping, labelCol, labelAgg, extraCols]);

  const DraggableField = ({ col, type }) => (
    <Box
      draggable
      onDragStart={e => {
        e.dataTransfer.setData("type", type);
        e.dataTransfer.setData("col", col);
      }}
      sx={{
        p: 1.2, mb: 1, borderRadius: 1.5,
        background: type === 'dim' ? "#e3f2fd" : "#e8f5e9",
        border: `1.5px solid ${type === 'dim' ? "#bbdefb" : "#c8e6c9"}`,
        color: type === 'dim' ? "#1565c0" : "#2e7d32",
        display: "flex", alignItems: "center", gap: 1,
        cursor: "grab", "&:active": { cursor: "grabbing" },
        fontSize: 12, fontWeight: 700,
        userSelect: "none",
        transition: "box-shadow 0.15s",
        "&:hover": { boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }
      }}
    >
      <DragIndicator sx={{ fontSize: 14, opacity: 0.5 }} />
      {col}
    </Box>
  );

  const DropZone = ({ label, hint, value, type, onDrop, onClear, optional }) => {
    const [isDragOver, setIsDragOver] = React.useState(false);
    const getColors = () => {
      if (!value) return { border: optional ? "#ccc" : "#ddd", bg: "#f9f9f9", text: "text.secondary" };
      if (type === 'dim') return { border: "#1565c0", bg: "#e3f2fd", text: "#1565c0" };
      if (type === 'measure') return { border: "#2e7d32", bg: "#e8f5e9", text: "#2e7d32" };
      return { border: "#6a1b9a", bg: "#f3e5f5", text: "#6a1b9a" };
    };
    const colors = getColors();
    return (
      <Box
        onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={e => {
          e.preventDefault();
          setIsDragOver(false);
          const col = e.dataTransfer.getData("col");
          onDrop(col);
        }}
        sx={{
          flex: 1, minHeight: 68, borderRadius: 2,
          border: `2px ${isDragOver ? "solid" : "dashed"} ${isDragOver ? "#fbc02d" : colors.border}`,
          background: isDragOver ? "#fffde7" : colors.bg,
          display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, py: 1,
          transition: "border-color 0.2s, background 0.2s, border-style 0.2s"
        }}
      >
        <Stack sx={{ overflow: "hidden" }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <Typography fontSize={10} fontWeight={800} color="text.disabled" textTransform="uppercase">
              {label}
            </Typography>
            {optional && !value && (
              <Chip label="optional" size="small" sx={{ height: 14, fontSize: 9, fontWeight: 800, opacity: 0.5 }} />
            )}
          </Stack>
          {value ? (
            <Typography fontSize={14} fontWeight={800} color={colors.text} noWrap sx={{ textOverflow: "ellipsis" }}>
              {value}
            </Typography>
          ) : (
            <Typography fontSize={12} color="text.secondary">{hint}</Typography>
          )}
        </Stack>
        {value && (
          <IconButton size="small" onClick={onClear} sx={{ color: "text.secondary" }}>
            <Close sx={{ fontSize: 16 }} />
          </IconButton>
        )}
      </Box>
    );
  };

  const decoratedPreview = preview ? {
    ...preview,
    title: chartTitle || preview.title,
    type: chartType,
    mapRegion: chartMapRegion || "usa",
    _colorOverride: chartColor || null,
    _headerColor: headerColor || null,
    _textColor: textColor || null,
    _bgColor: bgColor || null,
    _pieColors: Object.keys(pieSliceColors).length > 0 ? pieSliceColors : null,
    _pieLabelMode: pieLabelMode || null,
    _hasPadding: hasPadding !== false,
    _hasBorder: hasBorder !== false,
    _roundedCorners: roundedCorners !== false,
    _gaugeTarget: gaugeTarget,
    _extraCols: extraCols,
  } : null;

  return (
    <Dialog fullScreen open={open} onClose={onClose} TransitionComponent={Transition}>
      <AppBar sx={{ position: 'relative', background: "#1a1a2e" }} elevation={0}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={onClose} aria-label="close">
            <Close />
          </IconButton>
          <AutoGraph sx={{ mr: 1.5, color: "#a78bfa" }} />
          <Typography sx={{ ml: 1, flex: 1, fontWeight: 800, letterSpacing: 0.5 }} variant="h6">
            Builder Canvas
          </Typography>
          <Button
            disabled={activeTab === 0 ? !preview : !kpiPreview}
            variant="contained"
            onClick={() => onPin(activeTab === 0 ? decoratedPreview : kpiPreview)}
            startIcon={<PushPin />}
            sx={{ background: "#4caf50", color: "#fff", fontWeight: 800, borderRadius: 2, "&:hover": { background: "#388e3c" } }}
          >
            Pin to Dashboard
          </Button>
        </Toolbar>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          TextColor="inherit"
          TabIndicatorProps={{ style: { background: "#a78bfa" } }}
          sx={{ px: 2, minHeight: 40, "& .MuiTab-root": { color: "rgba(255,255,255,0.6)", fontWeight: 700, minHeight: 40, "&.Mui-selected": { color: "#fff" } } }}
        >
          <Tab icon={<AutoGraph sx={{ fontSize: 16 }} />} iconPosition="start" label="Build Chart" />
          <Tab icon={<Speed sx={{ fontSize: 16 }} />} iconPosition="start" label="Build KPI Card" />
        </Tabs>
      </AppBar>

      <Stack direction="row" sx={{ height: "calc(100vh - 112px)" }}>
        {/* LEFT SIDEBAR — always visible */}

        {/* ── Left Sidebar ── */}
        <Box sx={{ width: 240, minWidth: 240, borderRight: "1px solid #eee", overflowY: "auto", p: 2, background: "#fafafa" }}>
          <Typography fontSize={11} fontWeight={800} color="#1565c0" textTransform="uppercase" mb={1.5}>
            Abc  Dimensions
          </Typography>
          {dimensions.length === 0
            ? <Typography fontSize={12} color="text.secondary">No categories found</Typography>
            : dimensions.map(d => <DraggableField key={d} col={d} type="dim" />)
          }

          <Divider sx={{ my: 2.5 }} />

          <Typography fontSize={11} fontWeight={800} color="#2e7d32" textTransform="uppercase" mb={1.5}>
            #   Measures
          </Typography>
          {measures.length === 0
            ? <Typography fontSize={12} color="text.secondary">No numeric columns</Typography>
            : measures.map(m => <DraggableField key={m} col={m} type="measure" />)
          }
        </Box>

        {/* ── Canvas (Charts Tab) ── */}
        {activeTab === 0 && (
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", background: "#f0f2f5" }}>

            {/* AI Input Row */}
            <Box sx={{ p: 2, background: "#fff", borderBottom: "1px solid #ddd" }}>
              <Stack direction="row" spacing={2}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Ask AI to build a chart (e.g. 'Show me average revenue by department')"
                  value={chartPrompt}
                  onChange={e => setChartPrompt(e.target.value)}
                  disabled={loading}
                  onKeyDown={(e) => { if (e.key === "Enter") buildWithAi(); }}
                  InputProps={{
                    startAdornment: <AutoFixHigh sx={{ color: "#c52626", mr: 1, opacity: 0.7 }} />
                  }}
                />
                <Button variant="contained" onClick={buildWithAi} disabled={loading || !chartPrompt.trim()} sx={{ whiteSpace: "nowrap", background: "#1a1a2e" }}>
                  Generate
                </Button>
              </Stack>
            </Box>

            {/* Drop Zones + Config Row */}
            <Box sx={{ p: 3, background: "#fff", borderBottom: "1px solid #ddd" }}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>

                <DropZone
                  label={chartType === "pie" ? "Category (Slice by)" : (chartType === "table" ? "Primary Column" : "Columns / X-Axis")}
                  hint="Drag a Dimension here"
                  value={xCol}
                  type="dim"
                  onDrop={col => setXCol(col)}
                  onClear={() => { setXCol(null); setPreview(null); }}
                />

                {chartType === "table" && extraCols.map((c, i) => (
                  <DropZone
                    key={`extracol_${i}`}
                    label={`Extra Column ${i+1}`}
                    hint="Drag another Dimension"
                    value={c}
                    type="dim"
                    onDrop={col => {
                      const next = [...extraCols];
                      next[i] = col;
                      setExtraCols(next);
                    }}
                    onClear={() => {
                      setExtraCols(prev => prev.filter((_, idx) => idx !== i));
                      setPreview(null);
                    }}
                  />
                ))}
                {chartType === "table" && extraCols.length < 5 && (
                  <DropZone
                    label="Add Column"
                    hint="Drag a Dimension"
                    value={null}
                    type="dim"
                    optional
                    onDrop={col => {
                      if (!extraCols.includes(col) && col !== xCol) {
                        setExtraCols([...extraCols, col]);
                        setPreview(null);
                      }
                    }}
                    onClear={() => {}}
                  />
                )}

                <DropZone
                  label={chartType === "pie" ? "Measure (Slice size)" : "Rows / Y-Axis"}
                  hint={chartType === "pie"
                    ? "Drag a Measure — or leave empty for COUNT"
                    : "Drag a Measure here (or leave empty for COUNT)"}
                  value={yCol}
                  type="measure"
                  optional
                  onDrop={col => setYCol(col)}
                  onClear={() => { setYCol(null); }}
                />

                {(chartType === "line" || chartType === "bar" || chartType === "hbar" || chartType === "area") && (
                  <DropZone
                    label="Group By / Legend"
                    hint="Drag Dimension for Multi-line"
                    value={groupByCol}
                    type="dim"
                    optional
                    onDrop={col => setGroupByCol(col)}
                    onClear={() => setGroupByCol(null)}
                  />
                )}

                <DropZone
                  label="Sec. Label"
                  hint="Drag to add label"
                  value={labelCol}
                  type="any"
                  optional
                  onDrop={col => setLabelCol(col)}
                  onClear={() => setLabelCol(null)}
                />

                <DropZone
                  label="Chart Title"
                  hint="Drag any column to name"
                  value={chartTitle}
                  type="any"
                  optional
                  onDrop={col => setChartTitle(col)}
                  onClear={() => setChartTitle("")}
                />

                <Stack flex={1} spacing={1} minWidth={180}>
                  <DropZone
                    label="Add Filter"
                    hint="Drag Dimensions here"
                    value={null}
                    type="dim"
                    optional
                    onDrop={col => {
                      setChartFilters(prev => ({ ...prev, [col]: [] }));
                      loadFilterValues(col, false);
                    }}
                    onClear={() => { }}
                  />
                  {Object.keys(chartFilters).length > 0 && (
                    <Stack spacing={1} sx={{ mt: 1 }}>
                      {Object.entries(chartFilters).map(([k, v]) => renderFilterInput(k, v, false))}
                    </Stack>
                  )}
                </Stack>
              </Stack>

              <Stack direction="row" spacing={2} mt={2.5} flexWrap="wrap">
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel sx={{ fontSize: 13, fontWeight: 700 }}>Aggregation</InputLabel>
                  <Select
                    value={yCol ? agg : "COUNT"}
                    label="Aggregation"
                    disabled={!yCol}
                    onChange={e => setAgg(e.target.value)}
                    sx={{ fontSize: 13, fontWeight: 700, background: "#fff" }}
                  >
                    <MenuItem value="SUM">SUM</MenuItem>
                    <MenuItem value="AVG">AVERAGE</MenuItem>
                    <MenuItem value="COUNT">COUNT</MenuItem>
                    <MenuItem value="COUNT_DISTINCT">COUNT DISTINCT</MenuItem>
                    <MenuItem value="MIN">MIN</MenuItem>
                    <MenuItem value="MAX">MAX</MenuItem>
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel sx={{ fontSize: 13, fontWeight: 700 }}>Chart Type</InputLabel>
                  <Select value={chartType} label="Chart Type" onChange={e => { setChartType(e.target.value); setPreview(null); }} sx={{ fontSize: 13, fontWeight: 700, background: "#fff" }}>
                    <MenuItem value="bar">Vertical Bar</MenuItem>
                    <MenuItem value="hbar">Horizontal Bar</MenuItem>
                    <MenuItem value="line">Line Graph</MenuItem>
                    <MenuItem value="area">Area Graph</MenuItem>
                    <MenuItem value="pie">🍕 Pie / Donut</MenuItem>
                    <MenuItem value="treemap">🔲 Tree Map</MenuItem>
                    <MenuItem value="radar">🕸️ Radar Chart</MenuItem>
                    <MenuItem value="progress">📊 Progress Bar Table</MenuItem>
                    <MenuItem value="gauge">⏱️ Gauge Chart</MenuItem>
                    <MenuItem value="table">📋 Multi-Column Table</MenuItem>
                    <MenuItem value="map">🗺️ Map (Choropleth)</MenuItem>
                  </Select>
                </FormControl>

                {chartType === "map" && (
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel sx={{ fontSize: 13, fontWeight: 700 }}>Map Region</InputLabel>
                    <Select value={chartMapRegion || "usa"} label="Map Region" onChange={e => { setChartMapRegion(e.target.value); setPreview(null); }} sx={{ fontSize: 13, fontWeight: 700, background: "#fff" }}>
                      <MenuItem value="usa">USA</MenuItem>
                      <MenuItem value="world">World</MenuItem>
                      <MenuItem value="india">India</MenuItem>
                    </Select>
                  </FormControl>
                )}

                {chartType === "gauge" && (
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel sx={{ fontSize: 13, fontWeight: 700 }}>Gauge Target</InputLabel>
                    <OutlinedInput
                      type="number"
                      value={gaugeTarget}
                      onChange={e => { setGaugeTarget(Number(e.target.value)); setPreview(null); }}
                      label="Gauge Target"
                      sx={{ fontSize: 13, fontWeight: 700, background: "#fff", height: 40 }}
                    />
                  </FormControl>
                )}

                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel sx={{ fontSize: 13, fontWeight: 700 }}>Label Agg</InputLabel>
                  <Select
                    value={labelCol ? labelAgg : "MAX"}
                    label="Label Agg"
                    disabled={!labelCol}
                    onChange={e => setLabelAgg(e.target.value)}
                    sx={{ fontSize: 13, fontWeight: 700, background: "#fff" }}
                  >
                    <MenuItem value="MAX">TEXT (Auto)</MenuItem>
                    <MenuItem value="SUM">SUM</MenuItem>
                    <MenuItem value="AVG">AVERAGE</MenuItem>
                    <MenuItem value="MIN">MIN</MenuItem>
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel sx={{ fontSize: 13, fontWeight: 700 }}>Slices / Rows Limit</InputLabel>
                  <Select
                    value={chartLimit}
                    label="Slices / Rows Limit"
                    onChange={e => setChartLimit(Number(e.target.value))}
                    sx={{ fontSize: 13, fontWeight: 700, background: "#fff" }}
                  >
                    <MenuItem value={5}>5 slices/rows</MenuItem>
                    <MenuItem value={10}>10 slices/rows</MenuItem>
                    <MenuItem value={15}>15 slices/rows</MenuItem>
                    <MenuItem value={20}>20 slices/rows</MenuItem>
                    <MenuItem value={30}>30 slices/rows</MenuItem>
                    <MenuItem value={40}>40 slices/rows</MenuItem>
                    <MenuItem value={50}>50 slices/rows</MenuItem>
                    <MenuItem value={100}>100 slices/rows</MenuItem>
                  </Select>
                </FormControl>

                {isDateCol && (
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel sx={{ fontSize: 13, fontWeight: 700 }}>Time Trend</InputLabel>
                    <Select value={timeGrouping} label="Time Trend" onChange={e => { setTimeGrouping(e.target.value); setPreview(null); }} sx={{ fontSize: 13, fontWeight: 700, background: "#fff" }}>
                      <MenuItem value="none">Auto (None)</MenuItem>
                      <MenuItem value="hour">Hour</MenuItem>
                      <MenuItem value="weekday">Weekday</MenuItem>
                      <MenuItem value="day">Day</MenuItem>
                      <MenuItem value="month">Month</MenuItem>
                      <MenuItem value="quarter">Quarter</MenuItem>
                      <MenuItem value="year">Year</MenuItem>
                    </Select>
                  </FormControl>
                )}

                {/* Label Alignment Toggle */}
                <Stack spacing={0.5}>
                  <Typography fontSize={10} fontWeight={800} color="text.disabled" textTransform="uppercase">Label Align</Typography>
                  <Stack direction="row" spacing={0.4}>
                    {BUILDER_LABEL_ALIGNS.map(la => (
                      <Chip
                        key={la.value}
                        icon={la.icon}
                        label={la.label}
                        size="small"
                        clickable
                        onClick={() => setBuilderLabelAlign(la.value)}
                        sx={{
                          fontWeight: 700, fontSize: 10,
                          background: builderLabelAlign === la.value ? "#1a1a2e" : "#f0f0f0",
                          color: builderLabelAlign === la.value ? "#fff" : "#444",
                          border: builderLabelAlign === la.value ? "1.5px solid #a78bfa" : "1.5px solid transparent",
                          "& .MuiChip-icon": { color: builderLabelAlign === la.value ? "#fff" : "#888" },
                        }}
                      />
                    ))}
                  </Stack>
                </Stack>
              </Stack>
            </Box>

            {/* Canvas Output */}
            <Box sx={{ flex: 1, p: 4, display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto" }}>
              {loading ? (
                <Stack alignItems="center" spacing={2}>
                  <CircularProgress sx={{ color: "#a78bfa" }} />
                  <Typography fontSize={13} color="text.secondary">Building chart...</Typography>
                </Stack>
              ) : error ? (
                <Stack alignItems="center" spacing={1.5}>
                  <Typography color="error" fontWeight={700} fontSize={15}>⚠️ {error}</Typography>
                  <Typography fontSize={12} color="text.secondary">Try a different column combination or aggregation.</Typography>
                </Stack>
              ) : preview ? (
                <Box sx={{ width: "100%", maxWidth: 860, height: 420 }}>
                  <ChartCard chart={decoratedPreview} idx={0} slots={slots} pieColors={pieColors} labelAlign={builderLabelAlign} />
                </Box>
              ) : (
                <Stack alignItems="center" spacing={2} sx={{ opacity: 0.45 }}>
                  <Insights sx={{ fontSize: 72 }} />
                  <Typography fontSize={17} fontWeight={700}>
                    {chartType === "pie" ? "Drop a Dimension + optional Measure" : "Drag columns into the drop zones above"}
                  </Typography>
                  <Typography fontSize={13} color="text.secondary">
                    {chartType === "pie"
                      ? "Leave Measure empty for record COUNT per slice, or drag a numeric column to aggregate."
                      : "X-Axis: Category  ·  Y-Axis: Numeric measure"}
                  </Typography>
                </Stack>
              )}
            </Box>
          </Box>
        )}

        {/* ── Right Customization Sidebar ── */}
        {activeTab === 0 && preview && (
          <Box sx={{ width: 280, minWidth: 280, borderLeft: "1px solid #eee", overflowY: "auto", p: 2.5, background: "#fafafa", display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography fontSize={12} fontWeight={800} color="text.disabled" textTransform="uppercase" letterSpacing={1} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Palette sx={{ fontSize: 15, color: "#a78bfa" }} /> Customize Styling
            </Typography>
            
            {/* Title override */}
            <Box>
              <Typography fontSize={12} fontWeight={700} color="text.secondary" mb={0.5}>Chart Title</Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="e.g. Visit Type Distribution"
                value={chartTitle}
                onChange={e => setChartTitle(e.target.value)}
                sx={{ background: "#fff" }}
              />
            </Box>

            {/* Theme Colors */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              <Typography fontSize={10} fontWeight={800} textTransform="uppercase" color="text.disabled">Colors</Typography>
              
              {/* Accent Color picker */}
              <Box>
                <Typography fontSize={12} fontWeight={700} color="text.secondary" mb={0.5}>Accent Color</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ width: 20, height: 20, borderRadius: 0.5, border: "1.5px solid #ddd", background: chartColor || "#000", flexShrink: 0 }} />
                  <TextField size="small" placeholder="#1a1a2e" value={chartColor}
                    onChange={(e) => setChartColor(e.target.value)}
                    sx={{ flex: 1, "& input": { fontSize: 11, fontFamily: "monospace", py: 0.4 } }} />
                  <input type="color" value={chartColor || "#1a1a2e"}
                    onChange={(e) => setChartColor(e.target.value)}
                    style={{ width: 28, height: 28, border: "none", padding: 0, cursor: "pointer", borderRadius: 4 }} />
                  <IconButton size="small" onClick={() => setChartColor("")} sx={{ color: "#bbb" }}><DeleteOutline sx={{ fontSize: 14 }} /></IconButton>
                </Stack>
              </Box>

              {/* Title / Header Color */}
              <Box>
                <Typography fontSize={12} fontWeight={700} color="text.secondary" mb={0.5}>Title Color</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ width: 20, height: 20, borderRadius: 0.5, border: "1.5px solid #ddd", background: headerColor || "#000", flexShrink: 0 }} />
                  <TextField size="small" placeholder="Default" value={headerColor}
                    onChange={(e) => setHeaderColor(e.target.value)}
                    sx={{ flex: 1, "& input": { fontSize: 11, fontFamily: "monospace", py: 0.4 } }} />
                  <input type="color" value={headerColor || "#1a1a2e"}
                    onChange={(e) => setHeaderColor(e.target.value)}
                    style={{ width: 28, height: 28, border: "none", padding: 0, cursor: "pointer", borderRadius: 4 }} />
                  <IconButton size="small" onClick={() => setHeaderColor("")} sx={{ color: "#bbb" }}><DeleteOutline sx={{ fontSize: 14 }} /></IconButton>
                </Stack>
              </Box>

              {/* Text Labels Color */}
              <Box>
                <Typography fontSize={12} fontWeight={700} color="text.secondary" mb={0.5}>Label Color</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ width: 20, height: 20, borderRadius: 0.5, border: "1.5px solid #ddd", background: textColor || "#000", flexShrink: 0 }} />
                  <TextField size="small" placeholder="Default" value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    sx={{ flex: 1, "& input": { fontSize: 11, fontFamily: "monospace", py: 0.4 } }} />
                  <input type="color" value={textColor || "#666666"}
                    onChange={(e) => setTextColor(e.target.value)}
                    style={{ width: 28, height: 28, border: "none", padding: 0, cursor: "pointer", borderRadius: 4 }} />
                  <IconButton size="small" onClick={() => setTextColor("")} sx={{ color: "#bbb" }}><DeleteOutline sx={{ fontSize: 14 }} /></IconButton>
                </Stack>
              </Box>

              {/* Background Color */}
              <Box>
                <Typography fontSize={12} fontWeight={700} color="text.secondary" mb={0.5}>Background Color</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ width: 20, height: 20, borderRadius: 0.5, border: "1.5px solid #ddd", background: bgColor || "#fff", flexShrink: 0 }} />
                  <TextField size="small" placeholder="Default" value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    sx={{ flex: 1, "& input": { fontSize: 11, fontFamily: "monospace", py: 0.4 } }} />
                  <input type="color" value={bgColor || "#ffffff"}
                    onChange={(e) => setBgColor(e.target.value)}
                    style={{ width: 28, height: 28, border: "none", padding: 0, cursor: "pointer", borderRadius: 4 }} />
                  <IconButton size="small" onClick={() => setBgColor("")} sx={{ color: "#bbb" }}><DeleteOutline sx={{ fontSize: 14 }} /></IconButton>
                </Stack>
              </Box>
            </Box>

            {["bar", "hbar", "line", "area", "pie"].includes(chartType) && (
              <Box>
                <Typography fontSize={12} fontWeight={700} color="text.secondary" mb={0.5}>Data Label Mode</Typography>
                <FormControl size="small" fullWidth>
                  <Select
                    value={pieLabelMode}
                    onChange={(e) => setPieLabelMode(e.target.value)}
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

            {/* Layout Toggles */}
            <Box>
              <Typography fontSize={10} fontWeight={800} textTransform="uppercase" color="text.disabled" mb={1}>Layout</Typography>
              <Stack spacing={0.5}>
                <FormControlLabel
                  control={<Switch size="small" checked={hasPadding} onChange={e => setHasPadding(e.target.checked)} />}
                  label={<Typography fontSize={12} fontWeight={700}>Padding</Typography>} />
                <FormControlLabel
                  control={<Switch size="small" checked={hasBorder} onChange={e => setHasBorder(e.target.checked)} />}
                  label={<Typography fontSize={12} fontWeight={700}>Borders</Typography>} />
                <FormControlLabel
                  control={<Switch size="small" checked={roundedCorners} onChange={e => setRoundedCorners(e.target.checked)} />}
                  label={<Typography fontSize={12} fontWeight={700}>Rounded Corners</Typography>} />
              </Stack>
            </Box>

            {/* Category Color Overrides */}
            {["pie", "bar", "hbar"].includes(chartType) && preview?.data && (
              <Box>
                <Typography fontSize={10} fontWeight={800} textTransform="uppercase" color="text.disabled" mb={1}>
                  {chartType === "pie" ? "Slice" : "Bar"} Colors Override
                </Typography>
                <Stack spacing={1} sx={{ maxHeight: 220, overflowY: "auto", pr: 0.5 }}>
                  {preview.data.map((row, i) => {
                    const label = row.label;
                    const defaultColor = pieColors[i % pieColors.length];
                    const currentColor = pieSliceColors[label] || "";
                    return (
                      <Stack key={label} direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                        <Typography fontSize={11} fontWeight={700} color="text.secondary" sx={{ noWrap: true, textOverflow: "ellipsis", overflow: "hidden", maxWidth: 100 }}>
                          {label}
                        </Typography>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Box sx={{ width: 14, height: 14, borderRadius: 0.5, border: "1px solid #ddd", background: currentColor || defaultColor }} />
                          <TextField
                            size="small"
                            placeholder={defaultColor}
                            value={currentColor}
                            onChange={(e) => {
                              const val = e.target.value;
                              setPieSliceColors(prev => ({ ...prev, [label]: val }));
                            }}
                            sx={{ width: 75, "& input": { fontSize: 10, fontFamily: "monospace", py: 0.2, px: 0.5 } }}
                          />
                          <input
                            type="color"
                            value={currentColor || defaultColor}
                            onChange={(e) => {
                              const val = e.target.value;
                              setPieSliceColors(prev => ({ ...prev, [label]: val }));
                            }}
                            style={{ width: 18, height: 18, border: "none", padding: 0, cursor: "pointer", borderRadius: 4 }}
                          />
                          <IconButton
                            size="small"
                            onClick={() => {
                              const next = { ...pieSliceColors };
                              delete next[label];
                              setPieSliceColors(next);
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
            )}
          </Box>
        )}

        {/* ── KPI Builder Tab ── */}
        {activeTab === 1 && (
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", background: "#f0f2f5" }}>

            {/* AI Input Row */}
            <Box sx={{ p: 2, background: "#fff", borderBottom: "1px solid #ddd" }}>
              <Stack direction="row" spacing={2}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Ask AI to build a KPI card (e.g. 'Show me average revenue')"
                  value={kpiPrompt}
                  onChange={e => setKpiPrompt(e.target.value)}
                  disabled={kpiLoading}
                  onKeyDown={(e) => { if (e.key === "Enter") buildKpiWithAi(); }}
                  InputProps={{
                    startAdornment: <AutoFixHigh sx={{ color: "#449042", mr: 1, opacity: 0.7 }} />
                  }}
                />
                <Button variant="contained" onClick={buildKpiWithAi} disabled={kpiLoading || !kpiPrompt.trim()} sx={{ whiteSpace: "nowrap", background: "#1a1a2e" }}>
                  Generate
                </Button>
              </Stack>
            </Box>

            {/* Config Row */}
            <Box sx={{ p: 3, background: "#fff", borderBottom: "1px solid #ddd" }}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems="flex-start">

                {/* Drag drop zone */}
                <Box
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const col = e.dataTransfer.getData("col"); if (col) { setKpiCol(col); setKpiLabel(col); } }}
                  sx={{
                    flex: 1, minHeight: 72, borderRadius: 2,
                    border: `2px dashed ${kpiCol ? "#2e7d32" : "#ddd"}`,
                    background: kpiCol ? "#e8f5e9" : "#f9f9f9",
                    display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, py: 1.5,
                    transition: "border-color 0.2s, background 0.2s"
                  }}
                >
                  <Stack>
                    <Typography fontSize={10} fontWeight={800} color="text.disabled" textTransform="uppercase">Measure Column</Typography>
                    {kpiCol
                      ? <Typography fontSize={15} fontWeight={800} color="#2e7d32">{kpiCol}</Typography>
                      : <Typography fontSize={13} color="text.secondary">Drag a green Measure here...</Typography>}
                  </Stack>
                  {kpiCol && <IconButton size="small" onClick={() => { setKpiCol(""); setKpiPreview(null); }}><Close sx={{ fontSize: 16 }} /></IconButton>}
                </Box>

                <Stack spacing={1} minWidth={200}>
                  <DropZone
                    label="Add Filter"
                    hint="Drag Dimensions here"
                    value={null}
                    type="dim"
                    optional
                    onDrop={col => {
                      setKpiFilters(prev => ({ ...prev, [col]: [] }));
                      loadFilterValues(col, true);
                    }}
                    onClear={() => { }}
                  />
                  {Object.keys(kpiFilters).length > 0 && (
                    <Stack spacing={1} sx={{ mt: 1 }}>
                      {Object.entries(kpiFilters).map(([k, v]) => renderFilterInput(k, v, true))}
                    </Stack>
                  )}
                </Stack>

                {/* Aggregation chips */}
                <Stack spacing={1} minWidth={200}>
                  <Typography fontSize={11} fontWeight={800} color="text.disabled" textTransform="uppercase">Aggregation</Typography>
                  <Stack direction="row" flexWrap="wrap" gap={0.8}>
                    {[
                      { v: "ALL", l: "All Stats" },
                      { v: "SUM", l: "SUM" },
                      { v: "AVG", l: "AVG" },
                      { v: "COUNT", l: "COUNT" },
                      { v: "COUNT_DISTINCT", l: "COUNT DISTINCT" },
                      { v: "MIN", l: "MIN" },
                      { v: "MAX", l: "MAX" },
                    ].map(opt => (
                      <Chip key={opt.v} label={opt.l} clickable onClick={() => setKpiAgg(opt.v)} sx={{
                        fontWeight: 800, fontSize: 11,
                        background: kpiAgg === opt.v ? "#1a1a2e" : "#f0f0f0",
                        color: kpiAgg === opt.v ? "#fff" : "#444",
                        border: kpiAgg === opt.v ? "2px solid #a78bfa" : "2px solid transparent",
                      }} />
                    ))}
                  </Stack>
                </Stack>

                {/* Label + Preview */}
                <Stack spacing={1} minWidth={200} sx={{ flex: 1 }}>
                  <DropZone
                    label="KPI Label / Title"
                    hint="Drag a column or type below"
                    value={kpiLabel}
                    type="any"
                    optional
                    onDrop={col => setKpiLabel(col)}
                    onClear={() => setKpiLabel("")}
                  />
                  <TextField label="Custom Label Override" size="small" value={kpiLabel}
                    onChange={e => setKpiLabel(e.target.value)} sx={{ background: "#fff", borderRadius: 1 }} />
                  <Button variant="contained" disabled={!kpiCol || kpiLoading}
                    onClick={() => fetchKpi(kpiCol, kpiLabel, kpiAgg)}
                    sx={{ background: "#1a1a2e", color: "#fff", fontWeight: 800, borderRadius: 2 }}>
                    {kpiLoading ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : "Preview KPI"}
                  </Button>
                </Stack>
              </Stack>
            </Box>

            {/* Preview area */}
            <Box sx={{ flex: 1, p: 4, overflow: "auto" }}>
              {kpiError && <Typography color="error" fontWeight={700} mb={2}>⚠️ {kpiError}</Typography>}
              {kpiLoading && <Stack alignItems="center" mt={8}><CircularProgress /></Stack>}
              {!kpiLoading && kpiPreview && (
                <Box sx={{ background: "#fff", borderRadius: 2, p: 3, border: "1px solid #ddd" }}>
                  <Typography fontWeight={800} fontSize={13} color="text.secondary" textTransform="uppercase" mb={2}>KPI Preview — {kpiPreview.label}</Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2} flexWrap="wrap">
                    {[
                      { key: "total", lbl: kpiPreview.total_label || "Total" },
                      { key: "avg", lbl: "Average" },
                      { key: "min", lbl: "Min" },
                      { key: "max", lbl: "Max" },
                      { key: "count", lbl: "Count" },
                      { key: "count_dist", lbl: "Unique" },
                    ].filter(r => kpiPreview[r.key] && kpiPreview[r.key] !== "—").map(({ key, lbl }, i) => (
                      <Card key={key} elevation={0} sx={{ flex: 1, minWidth: 110, borderRadius: 2, border: "1.5px solid #f0f0f0", overflow: "hidden" }}>
                        <Box sx={{ background: `linear-gradient(135deg,hsl(${i * 55},68%,48%),hsl(${i * 55 + 25},68%,38%))`, px: 2, py: 0.8 }}>
                          <Typography fontSize={11} fontWeight={800} color="#fff" textTransform="uppercase">{lbl}</Typography>
                        </Box>
                        <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                          <Typography fontSize={20} fontWeight={900}>{kpiPreview[key]}</Typography>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                </Box>
              )}
              {!kpiLoading && !kpiPreview && !kpiError && (
                <Stack alignItems="center" spacing={2} sx={{ opacity: 0.4, mt: 8 }}>
                  <Speed sx={{ fontSize: 72 }} />
                  <Typography fontSize={17} fontWeight={700}>Drag a Measure column from the sidebar</Typography>
                  <Typography fontSize={13} color="text.secondary">Then pick an aggregation and click Preview KPI.</Typography>
                </Stack>
              )}
            </Box>
          </Box>
        )}
      </Stack>
    </Dialog>
  );
};

export default BuilderModal;

