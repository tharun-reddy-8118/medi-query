import {
  AppBar, Toolbar, Tabs, Tab, Box, Stack,
  Typography, Avatar, Chip, IconButton, Tooltip,
  Drawer, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Divider, Paper, Button,
  useMediaQuery,
} from "@mui/material";
import {
  Home, Chat, AutoGraph, TableChart,
  MonitorHeart, Menu as MenuIcon, Close, Logout, Person, AdminPanelSettings, FolderOpen, Settings
} from "@mui/icons-material";
import { G } from "../constants";
import { useTheme } from "@mui/material/styles";
import WorkspaceSettingsModal from "./WorkspaceSettingsModal";
import { useState, useEffect } from "react";

const R = "#c52626";
const GR = "#449042";

const navItems = [
  { id: "home", icon: <Home />, label: "Overview" },
  { id: "ask", icon: <Chat />, label: "Ask AI" },
  //{ id: "forecast", icon: <AutoGraph />, label: "Forecast" },
];

const TopNav = ({ tab, setTab, file, user, onLogout, onCloseFile, mobileOpen, setMobileOpen }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [brandLogo, setBrandLogo] = useState("");
  const [brandColor, setBrandColor] = useState(R);

  const loadBrand = () => {
    setBrandLogo(localStorage.getItem("brand_logo") || "");
    setBrandColor(localStorage.getItem("brand_color") || R);
  };

  useEffect(() => {
    loadBrand();
    window.addEventListener("brand_update", loadBrand);
    return () => window.removeEventListener("brand_update", loadBrand);
  }, []);

  const initials = user?.name
    ? user.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  // Dynamic nav items based on role
  const currentNavItems = [...navItems];
  if (user?.role === "admin") {
    currentNavItems.push({ id: "users", icon: <AdminPanelSettings />, label: "Users" });
  }

  return (
    <AppBar position="sticky" elevation={0} sx={{
      background: "rgba(255,255,255,0.93)",
      backdropFilter: "blur(20px)",
      borderBottom: "1.5px solid rgba(108,99,255,0.1)",
      color: "text.primary",
      width: "100%"
    }}>
      <Toolbar sx={{ px: { xs: 2, sm: 3 }, gap: 1, minHeight: { xs: 60, sm: 68 }, width: "100%" }}>

        {/* Logo */}
        <Stack direction="row" alignItems="center" spacing={1} sx={{ flexShrink: 0, mr: 2 }}>


          <Avatar
            src={brandLogo || "/health_logo.png"}
            sx={{
              width: 46,
              height: 46,
              flexShrink: 0,

              p: "4px",
              background: "transparent",
              "& img": {
                objectFit: "contain"
              }
            }}
          />

          <Typography fontWeight={900} fontSize={17}
            sx={{ color: brandColor, whiteSpace: "nowrap", display: { xs: "none", sm: "block" } }}>
            Medi<Box component="span" sx={{ color: "#329144" }}>Query</Box>
          </Typography>
        </Stack>

        {/* Desktop tabs */}
        {!isMobile && (
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{
            "& .MuiTabs-indicator": { height: 3, borderRadius: "3px 3px 0 0", background: brandColor },
            "& .MuiTabs-flexContainer": { gap: 0 },
            minHeight: 60,
          }}>
            {currentNavItems.map(({ id, icon, label }) => (
              <Tab key={id} value={id} icon={icon} iconPosition="start" label={label}
                sx={{ color: "text.secondary", "&.Mui-selected": { color: brandColor }, gap: 0.5, px: 2.5 }} />
            ))}
          </Tabs>
        )}

        <Box sx={{ flex: 1 }} />

        {/* File badge — lg+ only */}
        {file && (
          <Stack direction="row" alignItems="center" spacing={1} sx={{ display: { xs: "none", lg: "flex" }, flexShrink: 0 }}>
            <Chip
              icon={<TableChart sx={{ fontSize: 16, color: "#449042 !important" }} />}
              label={`${file.filename}  ·  ${file.rows?.toLocaleString()} rows`}
              sx={{
                background: "#EEF0FF", color: "#449042",
                fontWeight: 700, fontSize: 11, maxWidth: 300,
              }}
            />
            <Tooltip title="Switch Dataset">
              <IconButton size="small" onClick={onCloseFile}
                sx={{ color: "text.disabled", "&:hover": { color: R, background: `${R}10` } }}>
                <FolderOpen sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        )}

        {/* User avatar + logout */}
        {user && (
          <Stack direction="row" alignItems="center" spacing={1} sx={{ ml: 1 }}>
            <Tooltip title={`${user.name} (${user.email})`} placement="bottom">
              <Avatar sx={{
                width: 34, height: 34,
                background: `linear-gradient(135deg,${GR},#6ab868)`,
                fontSize: 13, fontWeight: 800,
                cursor: "pointer",
                boxShadow: `0 2px 8px ${GR}40`,
              }}>
                {initials}
              </Avatar>
            </Tooltip>
            <Tooltip title="Workspace Settings">
              <IconButton size="small" onClick={() => setSettingsOpen(true)}
                sx={{ color: "text.disabled", "&:hover": { color: brandColor, background: `${brandColor}10` } }}>
                <Settings sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Logout">
              <IconButton size="small" onClick={onLogout}
                sx={{ color: "text.disabled", "&:hover": { color: R, background: `${R}10` } }}>
                <Logout sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        )}

        {/* Mobile hamburger */}
        {isMobile && (
          <IconButton onClick={() => setMobileOpen(true)} sx={{ color: "#449042" }}>
            <MenuIcon />
          </IconButton>
        )}
      </Toolbar>

      {/* Mobile Drawer */}
      <Drawer anchor="right" open={mobileOpen} onClose={() => setMobileOpen(false)}
        PaperProps={{ sx: { width: 260, background: "#F4F2FF", borderRadius: "20px 0 0 20px", p: 2 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography fontWeight={800} color="primary.main">Menu</Typography>
          <IconButton onClick={() => setMobileOpen(false)}><Close /></IconButton>
        </Stack>

        {/* User card in drawer */}
        {user && (
          <Paper elevation={0} sx={{
            p: 2, borderRadius: 3, background: "#fff",
            border: `1.5px solid ${GR}25`, mb: 2,
          }}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Avatar sx={{
                width: 36, height: 36,
                background: `linear-gradient(135deg,${GR},#6ab868)`,
                fontSize: 14, fontWeight: 800,
              }}>
                {initials}
              </Avatar>
              <Stack sx={{ minWidth: 0, flex: 1 }}>
                <Typography fontSize={13} fontWeight={800} noWrap>{user.name}</Typography>
                <Typography fontSize={10} color="text.disabled" noWrap>{user.email}</Typography>
              </Stack>
            </Stack>
          </Paper>
        )}

        <List disablePadding>
          {currentNavItems.map(({ id, icon, label }) => (
            <ListItem key={id} disablePadding>
              <ListItemButton
                selected={tab === id}
                onClick={() => { setTab(id); setMobileOpen(false); }}
                sx={{
                  borderRadius: 3, mb: 0.5,
                  "&.Mui-selected": {
                    background: "#bf3733", color: "#fff",
                    "& .MuiListItemIcon-root": { color: "#fff" }
                  }
                }}>
                <ListItemIcon sx={{ minWidth: 36, color: "primary.main" }}>{icon}</ListItemIcon>
                <ListItemText primary={label} primaryTypographyProps={{ fontWeight: 700 }} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        {file && (
          <>
            <Divider sx={{ my: 2 }} />
            <Paper elevation={0} sx={{
              p: 2, borderRadius: 3, background: "#fff",
              border: "1.5px solid rgba(108,99,255,0.15)"
            }}>
              <Typography fontSize={10} color="primary.main" fontWeight={800}
                textTransform="uppercase" letterSpacing={1} mb={0.5}>Active Dataset</Typography>
              <Typography fontSize={12} fontWeight={700} noWrap>{file.filename}</Typography>
              <Typography fontSize={11} color="text.secondary" mb={1.5}>
                {file.rows?.toLocaleString()} rows · {file.columns?.length} cols
              </Typography>
              <Button fullWidth size="small" variant="outlined" startIcon={<FolderOpen />}
                onClick={() => { onCloseFile(); setMobileOpen(false); }}
                sx={{ color: R, borderColor: `${R}40`, borderRadius: 2, textTransform: "none", fontWeight: 700 }}>
                Switch Dataset
              </Button>
            </Paper>
          </>
        )}

        {/* Logout button in drawer */}
        {user && onLogout && (
          <>
            <Divider sx={{ my: 2 }} />
            <Button fullWidth startIcon={<Logout />} onClick={onLogout}
              sx={{
                color: R, fontWeight: 700, borderRadius: 3, textTransform: "none",
                "&:hover": { background: `${R}10` }
              }}>
              Sign Out
            </Button>
          </>
        )}
      </Drawer>

      <WorkspaceSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </AppBar>
  );
};

export default TopNav;
