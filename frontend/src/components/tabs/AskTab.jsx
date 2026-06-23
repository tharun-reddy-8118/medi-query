import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import {
  Stack, Typography, Avatar, Box,
  IconButton, Tooltip, Chip, Divider, Button,
} from "@mui/material";
import {
  Psychology, Send, ContentCopy, Check,
  AutoAwesome, DeleteOutline, BoltOutlined,
  KeyboardReturn, TableChart, HistoryOutlined,
  AddComment, DeleteForeverOutlined, ChatBubbleOutline,
  TipsAndUpdates, AccessTimeOutlined, CodeOutlined,
  Mic, MicNone, PushPin,
} from "@mui/icons-material";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer, Cell
} from "recharts";
import { API } from "../../constants";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

// ── Brand ─────────────────────────────────────────────────────────────────────
const R  = "#c52626";
const G  = "#449042";
const RG = "linear-gradient(135deg,#c52626,#e05555)";
const GG = "linear-gradient(135deg,#449042,#6ab868)";

const SUGGESTED = [
  { q: "Summarise this dataset",                emoji: "📋", accent: R },
  { q: "What are the key insights?",            emoji: "💡", accent: "#d97706" },
  { q: "Show the top 5 rows by value",          emoji: "🏆", accent: G },
  { q: "Identify trends over time",             emoji: "📈", accent: "#0284c7" },
  { q: "Which category has the highest total?", emoji: "🔢", accent: "#7c3aed" },
  { q: "Are there any anomalies or outliers?",  emoji: "🔍", accent: "#0891b2" },
];

const ts    = () => new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
const uid   = () => Math.random().toString(36).slice(2, 10);
const STORE = "mediinsight_chat_history";
const MAX   = 50;

const WELCOME = "Hey! 👋 I'm your AI data analyst. Ask me anything about your data — summaries, trends, comparisons, or anomalies.";

// ── localStorage hook ─────────────────────────────────────────────────────────
const useChatHistory = () => {
  const load = () => {
    try { return JSON.parse(localStorage.getItem(STORE) || "[]"); }
    catch { return []; }
  };
  const save = (sessions) => {
    try { localStorage.setItem(STORE, JSON.stringify(sessions.slice(0, MAX))); }
    catch {}
  };

  const [sessions, setSessions] = useState(load);

  const upsertSession = useCallback((session) => {
    setSessions(prev => {
      const idx = prev.findIndex(s => s.id === session.id);
      let next;
      if (idx >= 0) {
        next = [...prev];
        next[idx] = session;
      } else {
        next = [session, ...prev];
      }
      // Sort by updatedAt desc, cap at MAX
      next = next.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX);
      save(next);
      return next;
    });
  }, []);

  const deleteSession = useCallback((id) => {
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id);
      save(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setSessions([]);
    try { localStorage.removeItem(STORE); } catch {}
  }, []);

  return { sessions, upsertSession, deleteSession, clearAll };
};

// ── Date grouping ─────────────────────────────────────────────────────────────
const groupByDate = (sessions) => {
  const now   = Date.now();
  const DAY   = 86400000;
  const today = [], yesterday = [], older = [];
  sessions.forEach(s => {
    const diff = now - s.updatedAt;
    if (diff < DAY)       today.push(s);
    else if (diff < 2*DAY) yesterday.push(s);
    else                   older.push(s);
  });
  return [
    ...(today.length     ? [{ label: "Today",     items: today }]     : []),
    ...(yesterday.length ? [{ label: "Yesterday", items: yesterday }] : []),
    ...(older.length     ? [{ label: "Earlier",   items: older }]     : []),
  ];
};

// ── Markdown renderer ─────────────────────────────────────────────────────────
const inlineFormat = (text) =>
  text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**"))
      return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`"))
      return <Box key={i} component="code" sx={{
        background: "rgba(197,38,38,0.08)", color: R,
        px: 0.7, py: 0.1, borderRadius: 1,
        fontFamily: "monospace", fontSize: 12.5,
      }}>{p.slice(1, -1)}</Box>;
    return p;
  });

const renderMd = (text) => {
  const lines = text.split("\n");
  const result = [];
  let list = [];
  const flush = (k) => {
    if (!list.length) return;
    result.push(
      <Box key={"L"+k} component="ul" sx={{ m: 0, pl: 2.5 }}>
        {list.map((li, j) => (
          <Box key={j} component="li" sx={{ mb: 0.4 }}>
            <Typography component="span" fontSize={13.5} lineHeight={1.75}>{inlineFormat(li)}</Typography>
          </Box>
        ))}
      </Box>
    );
    list = [];
  };
  lines.forEach((line, i) => {
    const n = line.match(/^\d+\.\s+(.+)/), b = line.match(/^[-•]\s+(.+)/);
    if (n || b) { list.push(n ? n[1] : b[1]); }
    else {
      flush(i);
      if (!line.trim()) result.push(<Box key={i} sx={{ height: 5 }} />);
      else result.push(
        <Typography key={i} component="div" fontSize={13.5} lineHeight={1.8}>
          {inlineFormat(line)}
        </Typography>
      );
    }
  });
  flush("e");
  return result;
};

// ── CopyBtn ───────────────────────────────────────────────────────────────────
const CopyBtn = ({ text }) => {
  const [ok, setOk] = useState(false);
  return (
    <Tooltip title={ok ? "Copied!" : "Copy"} placement="top">
      <IconButton size="small"
        onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 2000); }}
        sx={{ p: 0.35, opacity: 0.4, color: "#888", "&:hover": { opacity: 1, color: R }, transition: "all 0.15s" }}>
        {ok ? <Check sx={{ fontSize: 13 }} /> : <ContentCopy sx={{ fontSize: 13 }} />}
      </IconButton>
    </Tooltip>
  );
};

// ── Message Bubble ────────────────────────────────────────────────────────────
const InlineChart = ({ title, data, fileId, layoutKey }) => {
  if (!data || data.length < 2) return null;
  const cols = Object.keys(data[0] || {});
  if (cols.length < 2) return null;
  const cCat = cols[0];
  const cVal = cols[1];

  const [pinned, setPinned] = useState(false);

  const pinChart = () => {
    const lk = layoutKey || fileId;
    const chartDef = {
      id: `ai_pin_${Math.random().toString(36).slice(2, 7)}`,
      type: "bar",
      title: title || "AI Insight",
      data: data,
      xKey: cCat,
      yKey: cVal,
      size: "half"
    };
    const current = JSON.parse(localStorage.getItem(`pinned_charts_${lk}`) || "[]");
    current.push(chartDef);
    localStorage.setItem(`pinned_charts_${lk}`, JSON.stringify(current));
    setPinned(true);
  };

  return (
    <Box sx={{ mt: 2, pt: 1.5, borderTop: "1.5px dashed rgba(197,38,38,0.15)", position: "relative" }}>
      <Tooltip title={pinned ? "Pinned! ✓" : "Pin to Dashboard"} placement="top">
        <IconButton size="small" onClick={pinChart} sx={{ position: "absolute", top: 10, right: 0, color: pinned ? "#4caf50" : "text.secondary", "&:hover": { color: R, background: `${R}10` } }}>
          <PushPin sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
      <Typography fontSize={11} fontWeight={800} color="text.secondary" textTransform="uppercase" mb={1} ml={1}>
        📊 {title || "Chart"}
      </Typography>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis dataKey={cCat} tick={{ fontSize: 9, fill: "#aaa" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fill: "#aaa" }} axisLine={false} tickLine={false} />
          <RTooltip contentStyle={{ borderRadius: 8, fontSize: 11, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
          <Bar dataKey={cVal} fill={R} radius={[4, 4, 0, 0]} maxBarSize={30}>
            {data.map((_, i) => <Cell key={i} fill={R} opacity={1 - i * 0.05} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
};

const Bubble = ({ m, isLatest, onSuggestClick, file, fileId }) => {
  const isUser = m.role === "user";
  const [showSql, setShowSql] = useState(false);

  // Dynamic Suggestions logic
  const getSuggestions = () => {
    if (!file || file.doc_mode) return [];
    const numCols = file.numeric_columns || [];
    const catCols = file.columns?.filter(c => !numCols.includes(c) && !file.date_columns?.includes(c)) || [];
    const dateCols = file.date_columns || [];
    
    const suggestions = [];
    if (numCols.length > 0) suggestions.push(`What is the total ${numCols[0]}?`);
    if (catCols.length > 0 && numCols.length > 0) suggestions.push(`Show me ${numCols[0]} by ${catCols[0]}`);
    if (dateCols.length > 0 && numCols.length > 0) suggestions.push(`What is the trend of ${numCols[0]} over ${dateCols[0]}?`);
    
    return suggestions.length > 0 ? suggestions : ["Give me a summary of this data", "What are the key insights?"];
  };
  return (
    <Stack direction="row" justifyContent={isUser ? "flex-end" : "flex-start"}
      alignItems="flex-end" spacing={1.2}
      sx={{ animation: "floatUp 0.28s ease both", "&:hover .act": { opacity: 1 } }}>
      {!isUser && (
        <Avatar sx={{ width: 30, height: 30, background: RG, flexShrink: 0, mb: "2px" }}>
          <Psychology sx={{ fontSize: 16 }} />
        </Avatar>
      )}
      <Stack alignItems={isUser ? "flex-end" : "flex-start"} spacing={0.4}
        sx={{ maxWidth: { xs: "82%", md: "72%" } }}>
        <Box sx={{
          px: 2, py: 1.5,
          borderRadius: isUser ? "18px 4px 18px 18px" : "4px 18px 18px 18px",
          background: isUser ? RG : "#fff",
          border: isUser ? "none" : `1.5px solid rgba(197,38,38,${isLatest ? "0.2" : "0.1"})`,
          boxShadow: isUser ? `0 5px 18px ${R}28` : "0 2px 14px rgba(0,0,0,0.055)",
        }}>
          {isUser
            ? <Typography fontSize={13.5} lineHeight={1.75} fontWeight={600} color="#fff">{m.text}</Typography>
            : <Stack spacing={0.2}>{renderMd(m.text)}</Stack>}
            
          {!isUser && m.result_data && m.result_data.length > 0 && <InlineChart title={m.sql?.replace(/\n/g," ")} data={m.result_data} fileId={fileId} layoutKey={file?.layout_key} />}
          
          {!isUser && m.sql && (
             <Box sx={{ mt: 1.5 }}>
               <Button size="small" onClick={() => setShowSql(!showSql)} startIcon={<CodeOutlined sx={{ fontSize: 12 }}/>}
                  sx={{ color: "text.disabled", fontSize: 10, fontWeight: 700, p: 0, minWidth: 0, '&:hover': { background: "transparent", color: R } }}>
                 {showSql ? "Hide Query" : "Explain Query"}
               </Button>
               {showSql && (
                 <Box sx={{ mt: 1, p: 1.5, background: "#1E1B4B", borderRadius: 2, overflowX: "auto" }}>
                   <Typography component="pre" fontSize={11} fontFamily="monospace" color="#A5B4FC" sx={{ m: 0 }}>
                     {m.sql}
                   </Typography>
                 </Box>
               )}
             </Box>
          )}
        </Box>
        <Stack direction="row" alignItems="center" spacing={0.5} className="act"
          sx={{ px: 0.5, opacity: 0, transition: "opacity 0.2s" }}>
          <Typography fontSize={10} color="text.disabled">{m.time}</Typography>
          {!isUser && <CopyBtn text={m.text} />}
        </Stack>
      </Stack>
      {isUser && (
        <Avatar sx={{ width: 30, height: 30, background: GG, flexShrink: 0, mb: "2px", fontSize: 14 }}>👤</Avatar>
      )}
    </Stack>
  );
};

// ── Typing dots ───────────────────────────────────────────────────────────────
const Typing = () => (
  <Stack direction="row" alignItems="flex-end" spacing={1.2}>
    <Avatar sx={{ width: 30, height: 30, background: RG, flexShrink: 0 }}>
      <Psychology sx={{ fontSize: 16 }} />
    </Avatar>
    <Box sx={{ px: 2, py: 1.4, borderRadius: "4px 18px 18px 18px",
      border: "1.5px solid rgba(197,38,38,0.12)", background: "#fff" }}>
      <Stack direction="row" spacing={0.55}>
        {[0,1,2].map(d => (
          <Box key={d} sx={{ width: 6.5, height: 6.5, borderRadius: "50%", background: R,
            animation: `dotPulse 1.3s ${d*0.2}s ease infinite` }} />
        ))}
      </Stack>
    </Box>
  </Stack>
);

// ── Auto-resize textarea ──────────────────────────────────────────────────────
const AutoTextarea = ({ value, onChange, onSend, disabled, placeholder }) => {
  const ref = useRef();
  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.height = "auto";
    ref.current.style.height = Math.min(ref.current.scrollHeight, 140) + "px";
  }, [value]);
  return (
    <textarea ref={ref} value={value} rows={1} disabled={disabled}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }}}
      style={{
        flex: 1, resize: "none", outline: "none", border: "none",
        background: "transparent", fontFamily: "'Nunito', sans-serif",
        fontSize: 13.5, lineHeight: 1.65, color: "inherit",
        overflow: "hidden", padding: 0,
      }} />
  );
};

// ── Sidebar toggle pill ───────────────────────────────────────────────────────
const SideTab = ({ icon, label, active, onClick }) => (
  <Box onClick={onClick} sx={{
    flex: 1, py: 0.8, textAlign: "center", cursor: "pointer", borderRadius: 2,
    background: active ? R : "transparent",
    transition: "all 0.18s",
    "&:hover": { background: active ? R : `${R}10` },
  }}>
    <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.6}>
      <Box sx={{ color: active ? "#fff" : "text.secondary", display: "flex" }}>{icon}</Box>
      <Typography fontSize={11.5} fontWeight={700} color={active ? "#fff" : "text.secondary"}>{label}</Typography>
    </Stack>
  </Box>
);

// ── Session list item ─────────────────────────────────────────────────────────
const SessionItem = ({ session, active, onLoad, onDelete }) => {
  const [hover, setHover] = useState(false);
  const date = new Date(session.updatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  return (
    <Box
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      sx={{
        px: 1.5, py: 1.1, borderRadius: "10px", cursor: "pointer",
        background: active ? `${R}0f` : hover ? `${R}06` : "transparent",
        border: `1.5px solid ${active ? R+"30" : "transparent"}`,
        transition: "all 0.15s",
        position: "relative",
      }}
      onClick={() => onLoad(session)}
    >
      <Stack direction="row" alignItems="flex-start" spacing={1}>
        <ChatBubbleOutline sx={{ fontSize: 13, color: active ? R : "text.disabled", mt: 0.3, flexShrink: 0 }} />
        <Stack flex={1} spacing={0.2} sx={{ minWidth: 0 }}>
          <Typography fontSize={12} fontWeight={700} noWrap
            sx={{ color: active ? R : "text.primary", maxWidth: "100%" }}>
            {session.title}
          </Typography>
          <Stack direction="row" alignItems="center" spacing={0.8}>
            <Typography fontSize={10} color="text.disabled" noWrap sx={{ flex: 1 }}>
              {session.filename}
            </Typography>
            <Typography fontSize={10} color="text.disabled" flexShrink={0}>{date}</Typography>
          </Stack>
          <Typography fontSize={10} color="text.disabled">
            {Math.floor(session.messageCount / 2)} Q&amp;A{Math.floor(session.messageCount / 2) !== 1 ? "s" : ""}
          </Typography>
        </Stack>
        {hover && (
          <IconButton size="small"
            onClick={e => { e.stopPropagation(); onDelete(session.id); }}
            sx={{ p: 0.3, color: "text.disabled", "&:hover": { color: R }, flexShrink: 0 }}>
            <DeleteOutline sx={{ fontSize: 13 }} />
          </IconButton>
        )}
      </Stack>
    </Box>
  );
};

// ── Suggest pill ──────────────────────────────────────────────────────────────
const SuggestPill = ({ q, emoji, accent, onClick }) => (
  <Box onClick={() => onClick(q)} sx={{
    px: 1.5, py: 1, borderRadius: "10px", cursor: "pointer",
    border: `1.5px solid ${accent}18`, background: `${accent}07`,
    transition: "all 0.16s",
    "&:hover": { background: `${accent}12`, borderColor: `${accent}35`, transform: "translateX(3px)" },
  }}>
    <Stack direction="row" spacing={1.1} alignItems="center">
      <Typography fontSize={14} lineHeight={1}>{emoji}</Typography>
      <Typography fontSize={12} fontWeight={700} lineHeight={1.35} sx={{ color: accent }}>{q}</Typography>
    </Stack>
  </Box>
);

// ════════════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════════════
const AskTab = ({ fileId, file }) => {
  const { sessions, upsertSession, deleteSession, clearAll } = useChatHistory();

  // Active session id + messages
  const [sessionId, setSessionId] = useState(uid);
  const [messages,  setMessages]  = useState([{ role: "ai", text: WELCOME, time: ts() }]);
  const [input,     setInput]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [listening, setListening] = useState(false);
  const [sidePanel, setSidePanel] = useState("history"); // "history" | "suggest"

  const bottomRef = useRef();
  const theme = useTheme();
  const isMobile  = useMediaQuery(theme.breakpoints.down("md"));

  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Browser does not support Speech Recognition.");
    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onstart = () => setListening(true);
    rec.onresult = (e) => setInput(Array.from(e.results).map(r => r[0].transcript).join(""));
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
  }, []);

  // Auto-scroll
  useEffect(() => {
    const id = setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    return () => clearTimeout(id);
  }, [messages, loading]);

  // Auto-save current session whenever messages change (skip welcome-only)
  useEffect(() => {
    const userMsgs = messages.filter(m => m.role === "user");
    if (!userMsgs.length) return;
    upsertSession({
      id:           sessionId,
      title:        userMsgs[0].text.slice(0, 52) + (userMsgs[0].text.length > 52 ? "…" : ""),
      fileId:       fileId,
      filename:     file?.filename || "Unknown file",
      messages:     messages,
      messageCount: messages.length,
      createdAt:    messages[0]?._ts || Date.now(),
      updatedAt:    Date.now(),
    });
  }, [messages]);

  const send = useCallback(async (q) => {
    const question = (typeof q === "string" ? q : input).trim();
    if (!question || loading) return;
    setInput("");
    setMessages(m => [...m, { role: "user", text: question, time: ts() }]);
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/ask`, { question, file_id: fileId, history: messages.slice(1) });
      setMessages(m => [...m, { role: "ai", text: data.answer, time: ts(), sql: data.sql, result_data: data.result_data }]);
    } catch (e) {
      if (e.response?.status === 429) {
        setMessages(m => [...m, { role: "ai", text: "I'm receiving too many requests right now (Rate limit exceeded). Please wait a moment before asking again.", time: ts() }]);
      } else {
        setMessages(m => [...m, { role: "ai", text: "Sorry, I couldn't get an answer. Could you try rephrasing?", time: ts() }]);
      }
    } finally { setLoading(false); }
  }, [input, loading, fileId]);

  // Start a brand-new session
  const newChat = () => {
    setSessionId(uid());
    setMessages([{ role: "ai", text: WELCOME, time: ts() }]);
    setInput("");
  };

  // Restore a past session
  const loadSession = (s) => {
    setSessionId(s.id);
    setMessages(s.messages);
  };

  const aiCount   = messages.filter(m => m.role === "ai").length - 1;
  const lastAIIdx = messages.map(m => m.role).lastIndexOf("ai");
  const groups    = useMemo(() => groupByDate(sessions), [sessions]);

  return (
    <Stack direction={{ xs: "column", md: "row" }}
      sx={{ height: "calc(100vh - 68px)", width: "100%", overflow: "hidden" }}>

      {/* ════════ SIDEBAR ════════ */}
      {!isMobile && (
        <Stack sx={{
          width: 275, flexShrink: 0,
          background: "rgba(255,255,255,0.8)",
          backdropFilter: "blur(18px)",
          borderRight: "1.5px solid rgba(197,38,38,0.09)",
          overflow: "hidden",
        }}>

          {/* Brand header */}
          <Stack sx={{ p: 2.5, pb: 2, borderBottom: "1.5px solid rgba(197,38,38,0.07)" }}>
            <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
              <Box sx={{
                width: 34, height: 34, borderRadius: 2.5, background: RG,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 4px 12px ${R}35`, flexShrink: 0,
              }}>
                <Psychology sx={{ fontSize: 19, color: "#fff" }} />
              </Box>
              <Stack flex={1} spacing={0}>
                <Typography fontWeight={900} fontSize={14.5} color="#1E1B4B">AI Analyst</Typography>
                <Typography fontSize={10.5} color="text.disabled">Powered by Groq LLM</Typography>
              </Stack>
              {/* New chat button */}
              <Tooltip title="New chat">
                <IconButton size="small" onClick={newChat}
                  sx={{ background: `${G}12`, color: G, border: `1.5px solid ${G}22`,
                    borderRadius: 2, "&:hover": { background: G, color: "#fff" }, transition: "all 0.18s" }}>
                  <AddComment sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Stack>

            {/* File context pill */}
            {file && (
              <Box sx={{ p: 1.2, borderRadius: 2.5, background: G+"0c", border: `1.5px solid ${G}20` }}>
                <Stack direction="row" spacing={0.9} alignItems="flex-start">
                  <TableChart sx={{ fontSize: 13, color: G, mt: 0.25, flexShrink: 0 }} />
                  <Stack spacing={0.1}>
                    <Typography fontSize={10} fontWeight={800} color={G}
                      textTransform="uppercase" letterSpacing={0.7}>Active dataset</Typography>
                    <Typography fontSize={12} fontWeight={700} noWrap
                      sx={{ maxWidth: 155, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {file.filename || "Uploaded file"}
                    </Typography>
                    <Typography fontSize={10.5} color="text.disabled">
                      {file.rows?.toLocaleString() ?? "?"} rows · {file.columns?.length ?? "?"} cols
                    </Typography>
                  </Stack>
                </Stack>
              </Box>
            )}

            {/* Panel toggle */}
            <Stack direction="row" spacing={0.5} mt={2}
              sx={{ background: "rgba(197,38,38,0.06)", borderRadius: 2.5, p: 0.5 }}>
              <SideTab icon={<HistoryOutlined sx={{ fontSize: 14 }} />} label="History"
                active={sidePanel === "history"} onClick={() => setSidePanel("history")} />
              {/* <SideTab icon={<AutoAwesome sx={{ fontSize: 14 }} />} label="Suggest"
                active={sidePanel === "suggest"} onClick={() => setSidePanel("suggest")} /> */}
            </Stack>
          </Stack>

          {/* Panel content */}
          <Stack flex={1} sx={{
            overflowY: "auto",
            "&::-webkit-scrollbar": { width: 3 },
            "&::-webkit-scrollbar-thumb": { background: R+"22", borderRadius: 4 },
          }}>

            {/* ── HISTORY PANEL ── */}
            {sidePanel === "history" && (
              <Stack spacing={0} sx={{ p: 1.5 }}>
                {sessions.length === 0 ? (
                  <Stack alignItems="center" spacing={1.5} sx={{ pt: 5, pb: 4 }}>
                    <Box sx={{
                      width: 52, height: 52, borderRadius: 3,
                      background: "rgba(197,38,38,0.07)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <HistoryOutlined sx={{ fontSize: 26, color: R + "80" }} />
                    </Box>
                    <Stack alignItems="center" spacing={0.5}>
                      <Typography fontSize={13} fontWeight={700} color="text.secondary">
                        No history yet
                      </Typography>
                      <Typography fontSize={11.5} color="text.disabled" textAlign="center" lineHeight={1.5}>
                        Your conversations will appear here after you send your first message
                      </Typography>
                    </Stack>
                  </Stack>
                ) : (
                  <>
                    {groups.map(({ label, items }) => (
                      <Stack key={label} spacing={0.4} mb={1.5}>
                        <Stack direction="row" alignItems="center" spacing={0.7} sx={{ px: 0.5, mb: 0.5 }}>
                          <AccessTimeOutlined sx={{ fontSize: 11, color: "text.disabled" }} />
                          <Typography fontSize={10.5} fontWeight={800} textTransform="uppercase"
                            letterSpacing={1} color="text.disabled">{label}</Typography>
                        </Stack>
                        {items.map(s => (
                          <SessionItem key={s.id} session={s}
                            active={s.id === sessionId}
                            onLoad={loadSession}
                            onDelete={deleteSession} />
                        ))}
                      </Stack>
                    ))}

                    {/* Clear all */}
                    <Box sx={{ pt: 1, borderTop: "1.5px solid rgba(197,38,38,0.07)" }}>
                      <Button
                        fullWidth size="small"
                        startIcon={<DeleteForeverOutlined sx={{ fontSize: 14 }} />}
                        onClick={clearAll}
                        sx={{
                          color: "text.disabled", fontSize: 11.5, fontWeight: 700,
                          borderRadius: 2, py: 0.8,
                          "&:hover": { background: `${R}0a`, color: R },
                        }}>
                        Clear all history
                      </Button>
                    </Box>
                  </>
                )}
              </Stack>
            )}

            {/* ── SUGGEST PANEL ── */}
            {sidePanel === "suggest" && (
              <Stack spacing={2} sx={{ p: 2 }}>
                <Stack spacing={0.9}>
                  <Stack direction="row" alignItems="center" spacing={0.7}>
                    <AutoAwesome sx={{ fontSize: 12, color: R }} />
                    <Typography fontSize={10.5} fontWeight={800} textTransform="uppercase"
                      letterSpacing={1} color="text.disabled">Try asking</Typography>
                  </Stack>
                  {SUGGESTED.map(s => <SuggestPill key={s.q} {...s} onClick={send} />)}
                </Stack>

                <Divider sx={{ borderColor: "rgba(197,38,38,0.07)" }} />

                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" spacing={0.7}>
                    <BoltOutlined sx={{ fontSize: 12, color: G }} />
                    <Typography fontSize={10.5} fontWeight={800} textTransform="uppercase"
                      letterSpacing={1} color="text.disabled">Tips</Typography>
                  </Stack>
                  {[
                    ["Name the column", "for precise answers"],
                    ["Ask for breakdowns", "by month, category or region"],
                    ["Request rankings", "top 5, bottom 3, highest…"],
                    ["Works with", "Excel, CSV, PDF & Word docs"],
                  ].map(([b, r]) => (
                    <Stack key={b} direction="row" spacing={0.9} alignItems="flex-start">
                      <Box sx={{ width: 3, height: 3, borderRadius: "50%", background: G,
                        flexShrink: 0, mt: 0.9 }} />
                      <Typography fontSize={11.5} lineHeight={1.55} color="text.secondary">
                        <strong>{b}</strong> {r}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            )}
          </Stack>
        </Stack>
      )}

      {/* ════════ CHAT PANEL ════════ */}
      <Stack sx={{
        flex: 1, minWidth: 0, overflow: "hidden",
        background: "linear-gradient(175deg,#FFF8F8 0%,#FAFAFA 55%,#F5FFF5 100%)",
      }}>

        {/* Top bar */}
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{
          px: { xs: 2, sm: 3 }, py: 1.3,
          borderBottom: "1.5px solid rgba(197,38,38,0.09)",
          background: "rgba(255,255,255,0.88)",
          backdropFilter: "blur(14px)",
          flexShrink: 0,
        }}>
          <Box sx={{ width: 7.5, height: 7.5, borderRadius: "50%", background: G,
            boxShadow: `0 0 0 2.5px ${G}30`, animation: "dotPulse 2.5s ease infinite" }} />
          <Typography fontSize={12} fontWeight={700} color="text.secondary">AI online</Typography>

          {/* Current session title */}
          {messages.filter(m => m.role === "user").length > 0 && (
            <Typography fontSize={12} color="text.disabled" noWrap
              sx={{ flex: 1, mx: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
              {messages.find(m => m.role === "user")?.text?.slice(0, 45)}…
            </Typography>
          )}
          <Box flex={1} />

          {aiCount > 0 && (
            <Chip label={`${aiCount} answer${aiCount !== 1 ? "s" : ""}`} size="small" sx={{
              background: R+"0f", color: R, fontWeight: 700, fontSize: 11,
              border: `1.5px solid ${R}20`, height: 24,
            }} />
          )}

          {/* Mobile: new chat */}
          {isMobile && (
            <Tooltip title="New chat">
              <IconButton size="small" onClick={newChat}
                sx={{ color: G, "&:hover": { background: G+"14" } }}>
                <AddComment sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}

          {messages.length > 1 && (
            <Tooltip title="Clear this chat">
              <IconButton size="small"
                onClick={() => { newChat(); }}
                sx={{ color: "text.disabled", "&:hover": { color: R } }}>
                <DeleteOutline sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
        </Stack>

        {/* Mobile suggestion chips */}
        {isMobile && (
          <Box sx={{ px: 2, pt: 1.5, pb: 1, overflowX: "auto", flexShrink: 0,
            "&::-webkit-scrollbar": { display: "none" } }}>
            <Stack direction="row" spacing={0.8} sx={{ minWidth: "max-content" }}>
              {SUGGESTED.map(({ q, emoji, accent }) => (
                <Chip key={q} label={`${emoji} ${q}`} clickable onClick={() => send(q)} size="small"
                  sx={{
                    background: accent+"10", color: accent,
                    border: `1.5px solid ${accent}22`, fontWeight: 700, fontSize: 11,
                    "&:hover": { background: accent, color: "#fff" }, transition: "all 0.18s",
                  }} />
              ))}
            </Stack>
          </Box>
        )}

        {/* Messages */}
        <Stack flex={1} overflow="auto" spacing={2.2} sx={{
          px: { xs: 2, sm: 3 }, pt: 2.5, pb: 2,
          "&::-webkit-scrollbar": { width: 4 },
          "&::-webkit-scrollbar-thumb": { background: R+"18", borderRadius: 4 },
        }}>
          {messages.map((m, i) => (
            <Bubble key={i} m={m} isLatest={i === lastAIIdx && m.role === "ai"} onSuggestClick={send} file={file} fileId={fileId} />
          ))}
          {loading && <Typing />}
          <Box ref={bottomRef} />
        </Stack>

        {/* Input bar */}
        <Box sx={{
          flexShrink: 0, px: { xs: 2, sm: 3 }, pt: 1, pb: 2,
          borderTop: "1.5px solid rgba(197,38,38,0.09)",
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(14px)",
        }}>
          <Box sx={{
            display: "flex", alignItems: "flex-end", gap: 1.2,
            px: 2, py: 1.2, borderRadius: 1, border: "1.5px solid",
            borderColor: input.trim() ? R+"45" : "rgba(197,38,38,0.16)",
            background: "#fff",
            boxShadow: input.trim() ? `0 4px 20px ${R}12, 0 0 0 3px ${R}08` : "0 2px 10px rgba(0,0,0,0.04)",
            transition: "all 0.2s",
          }}>
            <AutoTextarea value={input} onChange={setInput} onSend={send}
              disabled={loading} placeholder={listening ? "Listening..." : "Ask anything about your data…"} />
            <IconButton onClick={startListening} disabled={loading} sx={{
              width: 38, height: 38, borderRadius: 2.5, flexShrink: 0,
              color: listening ? R : "text.secondary",
              background: listening ? R+"12" : "transparent",
              "&:hover": { color: R, background: R+"12" }
            }}>
              {listening ? <Mic /> : <MicNone />}
            </IconButton>
            <IconButton onClick={send} disabled={loading || !input.trim()} sx={{
              width: 38, height: 38, borderRadius: 2.5, flexShrink: 0,
              background: input.trim() ? RG : R+"09",
              color: input.trim() ? "#fff" : R,
              boxShadow: input.trim() ? `0 4px 14px ${R}35` : "none",
              transition: "all 0.18s",
              "&:hover:not(.Mui-disabled)": {
                background: input.trim() ? "linear-gradient(135deg,#a01e1e,#c52626)" : R+"14",
                transform: "scale(1.06)",
              },
              "&.Mui-disabled": { background: "rgba(0,0,0,0.04)", color: "rgba(0,0,0,0.22)" },
            }}>
              <Send sx={{ fontSize: 17 }} />
            </IconButton>
          </Box>
          <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5} mt={0.9}>
            <KeyboardReturn sx={{ fontSize: 11, color: "text.disabled" }} />
            <Typography fontSize={10.5} color="text.disabled">
              Enter to send · Shift+Enter for new line
            </Typography>
          </Stack>
        </Box>

      </Stack>
    </Stack>
  );
};

export default AskTab;