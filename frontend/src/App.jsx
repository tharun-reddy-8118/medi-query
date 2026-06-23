import { useState, useEffect } from "react";
import { ThemeProvider, CssBaseline, Box } from "@mui/material";
import axios from "axios";

import { getTheme }     from "./theme";
import { G, API }     from "./constants";
import FontLoader     from "./components/FontLoader";
import BlobBg         from "./components/BlobBg";
import TopNav         from "./components/TopNav";
import DashboardsList from "./components/DashboardsList";
import UploadScreen   from "./components/UploadScreen";
import AuthScreen     from "./components/AuthScreen";
import OverviewTab    from "./components/tabs/OverviewTab";
import AskTab         from "./components/tabs/AskTab";
import ForecastTab    from "./components/tabs/ForecastTab";
import UsersTab       from "./components/tabs/UsersTab";
import ErrorBoundary  from "./components/ErrorBoundary";

// ── Axios interceptor: attach JWT token to all requests ──────────────────────
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("mq_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default function App() {
  const [user, setUser]           = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [fileData,   setFileData]   = useState(null);
  const [tab,        setTab]        = useState("home");
  const [mobileOpen, setMobileOpen] = useState(false);
  
  // Theming state
  const [appTheme, setAppTheme] = useState(() => getTheme(localStorage.getItem("brand_color") || "#6C63FF", localStorage.getItem("brand_font") || "'Nunito', sans-serif"));

  // Check for existing session on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("mq_user");
    const storedToken = localStorage.getItem("mq_token");
    if (storedUser && storedToken) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem("mq_user");
        localStorage.removeItem("mq_token");
      }
    }
    setAuthChecked(true);

    const handleBrandUpdate = () => {
      setAppTheme(getTheme(localStorage.getItem("brand_color") || "#6C63FF", localStorage.getItem("brand_font") || "'Nunito', sans-serif"));
    };
    window.addEventListener("brand_update", handleBrandUpdate);
    return () => window.removeEventListener("brand_update", handleBrandUpdate);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("mq_token");
    localStorage.removeItem("mq_user");
    setUser(null);
    setFileData(null);
    setTab("home");
  };

  // Wait for auth check
  if (!authChecked) return null;

  // Auth gate
  if (!user) {
    return (
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <FontLoader />
        <AuthScreen onAuth={(u) => setUser(u)} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <FontLoader />

      <Box sx={{ minHeight: "100vh", background: G.page, position: "relative", width: "100%", overflowX: "hidden" }}>
        <BlobBg />
        <Box sx={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", minHeight: "100vh", width: "100%" }}>

          <TopNav
            tab={tab}
            setTab={setTab}
            file={fileData}
            user={user}
            onLogout={handleLogout}
            onCloseFile={() => { setFileData(null); setTab("home"); }}
            mobileOpen={mobileOpen}
            setMobileOpen={setMobileOpen}
          />

          <Box sx={{ flex: 1, width: "100%", overflow: tab === "ask" ? "hidden" : "auto" }}>
            <ErrorBoundary>
              {tab === "users" && <UsersTab currentUser={user} />}
              {tab !== "users" && tab !== "upload" && !fileData && (
                <DashboardsList 
                  currentUser={user}
                  onSelectDashboard={d => { setFileData(d); setTab("home"); }} 
                  onNew={() => setTab("upload")} 
                />
              )}
              {tab === "upload" && !fileData && <UploadScreen onUpload={d => { setFileData(d); setTab("home"); }} />}
              {tab === "home"     && fileData && <OverviewTab file={fileData} fileId={fileData.file_id} onUpdateFile={setFileData} currentUser={user} />}
              {tab === "ask"      && fileData && <AskTab      file={fileData} fileId={fileData.file_id} />}
              {tab === "forecast" && fileData && <ForecastTab file={fileData} fileId={fileData.file_id} />}
            </ErrorBoundary>
          </Box>

        </Box>
      </Box>
    </ThemeProvider>
  );
}
