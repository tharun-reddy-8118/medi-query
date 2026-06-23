import { useState, useRef, useEffect } from "react";
import axios from "axios";
import {
  Stack, Typography, Avatar, Box,
  IconButton, Tooltip, Paper, Slide, Fab, CircularProgress, Zoom, Button
} from "@mui/material";
import {
  Psychology, Send, Close, ChatBubbleOutline, CodeOutlined, KeyboardReturn
} from "@mui/icons-material";
import { API } from "../constants";

const R  = "#c52626";
const RG = "linear-gradient(135deg,#c52626,#e05555)";

const ts = () => new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

const inlineFormat = (text) =>
  text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`"))
      return <Box key={i} component="code" sx={{
        background: "rgba(197,38,38,0.08)", color: R,
        px: 0.7, py: 0.1, borderRadius: 1, fontFamily: "monospace", fontSize: 12.5,
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

const Bubble = ({ m }) => {
  const isUser = m.role === "user";
  const [showSql, setShowSql] = useState(false);

  return (
    <Stack direction="row" justifyContent={isUser ? "flex-end" : "flex-start"} alignItems="flex-end" spacing={1.2} sx={{ animation: "floatUp 0.28s ease both" }}>
      {!isUser && (
        <Avatar sx={{ width: 26, height: 26, background: RG, flexShrink: 0, mb: "2px" }}>
          <Psychology sx={{ fontSize: 14 }} />
        </Avatar>
      )}
      <Stack alignItems={isUser ? "flex-end" : "flex-start"} spacing={0.4} sx={{ maxWidth: "85%" }}>
        <Box sx={{
          px: 1.5, py: 1.2,
          borderRadius: isUser ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
          background: isUser ? RG : "#f4f4f5",
          color: isUser ? "#fff" : "#1a1a2e",
          boxShadow: isUser ? `0 4px 12px ${R}28` : "none",
        }}>
          {isUser
            ? <Typography fontSize={13} lineHeight={1.5} fontWeight={600}>{m.text}</Typography>
            : <Stack spacing={0.2}>{renderMd(m.text)}</Stack>}
          
          {!isUser && m.sql && (
             <Box sx={{ mt: 1 }}>
               <Button size="small" onClick={() => setShowSql(!showSql)} startIcon={<CodeOutlined sx={{ fontSize: 11 }}/>}
                  sx={{ color: "text.disabled", fontSize: 9, fontWeight: 700, p: 0, minWidth: 0, '&:hover': { background: "transparent", color: R } }}>
                 {showSql ? "Hide SQL" : "View SQL"}
               </Button>
               {showSql && (
                 <Box sx={{ mt: 0.5, p: 1, background: "#1E1B4B", borderRadius: 1.5, overflowX: "auto" }}>
                   <Typography component="pre" fontSize={10} fontFamily="monospace" color="#A5B4FC" sx={{ m: 0 }}>
                     {m.sql}
                   </Typography>
                 </Box>
               )}
             </Box>
          )}
        </Box>
      </Stack>
    </Stack>
  );
};

export default function FloatingChat({ fileId }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([{ role: "ai", text: "Hey! I'm your AI Copilot. Ask me anything about this dashboard." }]);
  const bottomRef = useRef();

  useEffect(() => {
    if (open) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [messages, open, loading]);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    const newMsgs = [...messages, { role: "user", text: q }];
    setMessages(newMsgs);
    setLoading(true);

    try {
      const { data } = await axios.post(`${API}/ask`, { question: q, file_id: fileId, history: newMsgs.slice(1) });
      setMessages([...newMsgs, { role: "ai", text: data.answer, sql: data.sql }]);
    } catch (e) {
      if (e.response?.status === 429) {
        setMessages([...newMsgs, { role: "ai", text: "I'm receiving too many requests right now (Rate limit exceeded). Please wait a moment before asking again." }]);
      } else {
        setMessages([...newMsgs, { role: "ai", text: "Sorry, I couldn't process that. Try rephrasing?" }]);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Slide direction="up" in={open} mountOnEnter unmountOnExit>
        <Paper elevation={24} sx={{
          position: "fixed", bottom: 84, right: 24, width: 360, height: 500,
          borderRadius: 3, display: "flex", flexDirection: "column", overflow: "hidden",
          border: "1px solid rgba(0,0,0,0.08)", zIndex: 9999
        }}>
          {/* Header */}
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ background: RG, px: 2, py: 1.5, color: "#fff" }}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Avatar sx={{ width: 30, height: 30, background: "rgba(255,255,255,0.2)" }}><Psychology fontSize="small" /></Avatar>
              <Typography fontWeight={800} fontSize={14}>Data Copilot</Typography>
            </Stack>
            <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: "#fff" }}>
              <Close fontSize="small" />
            </IconButton>
          </Stack>

          {/* Chat Body */}
          <Stack flex={1} overflow="auto" spacing={2} sx={{ p: 2, background: "#fafafa" }}>
            {messages.map((m, i) => <Bubble key={i} m={m} />)}
            {loading && (
              <Stack direction="row" alignItems="flex-end" spacing={1.2}>
                <Avatar sx={{ width: 26, height: 26, background: RG, flexShrink: 0 }}><Psychology sx={{ fontSize: 14 }} /></Avatar>
                <Box sx={{ px: 2, py: 1.4, borderRadius: "4px 16px 16px 16px", background: "#f4f4f5" }}>
                  <CircularProgress size={12} sx={{ color: R }} />
                </Box>
              </Stack>
            )}
            <Box ref={bottomRef} />
          </Stack>

          {/* Input */}
          <Box sx={{ p: 1.5, background: "#fff", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
            <Box sx={{ display: "flex", alignItems: "center", background: "#f5f5f5", borderRadius: 3, px: 2, py: 0.5 }}>
              <input 
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") send(); }}
                disabled={loading}
                placeholder="Ask a question..."
                style={{ flex: 1, border: "none", background: "transparent", outline: "none", padding: "10px 0", fontSize: 14, fontFamily: "inherit" }}
              />
              <IconButton onClick={send} disabled={!input.trim() || loading} size="small" sx={{ color: input.trim() ? R : "text.disabled" }}>
                <Send fontSize="small" />
              </IconButton>
            </Box>
            <Typography fontSize={9} color="text.disabled" textAlign="center" mt={0.5}>Press Enter to send</Typography>
          </Box>
        </Paper>
      </Slide>

      {/* FAB */}
      <Zoom in={true}>
        <Fab 
          color="primary" 
          onClick={() => setOpen(!open)}
          sx={{ position: "fixed", bottom: 24, right: 24, background: RG, "&:hover": { background: "#a01e1e" }, zIndex: 9999 }}
        >
          {open ? <Close /> : <ChatBubbleOutline />}
        </Fab>
      </Zoom>
    </>
  );
}
