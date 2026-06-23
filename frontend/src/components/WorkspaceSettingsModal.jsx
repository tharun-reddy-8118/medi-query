import { useState, useEffect } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Stack, Box, IconButton, Tooltip
} from "@mui/material";
import { Close, Palette, Image as ImageIcon } from "@mui/icons-material";

const PRESET_COLORS = [
  "#c52626", "#1565C0", "#00897B", "#449042", "#F57C00", "#6A1B9A", "#4E79A7", "#1a1a2e"
];

const PRESET_FONTS = [
  { name: "Nunito", value: "'Nunito', sans-serif" },
  { name: "Inter", value: "'Inter', sans-serif" },
  { name: "Roboto", value: "'Roboto', sans-serif" },
  { name: "Outfit", value: "'Outfit', sans-serif" },
  { name: "Open Sans", value: "'Open Sans', sans-serif" }
];

export default function WorkspaceSettingsModal({ open, onClose }) {
  const [logoUrl, setLogoUrl] = useState("");
  const [brandColor, setBrandColor] = useState("#c52626");
  const [brandFont, setBrandFont] = useState("'Nunito', sans-serif");

  useEffect(() => {
    if (open) {
      setLogoUrl(localStorage.getItem("brand_logo") || "");
      setBrandColor(localStorage.getItem("brand_color") || "#c52626");
      setBrandFont(localStorage.getItem("brand_font") || "'Nunito', sans-serif");
    }
  }, [open]);

  const handleSave = () => {
    localStorage.setItem("brand_logo", logoUrl);
    localStorage.setItem("brand_color", brandColor);
    localStorage.setItem("brand_font", brandFont);
    window.dispatchEvent(new Event("brand_update"));
    onClose();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_SIZE = 150;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
          } else {
            if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          
          try {
            const dataUrl = canvas.toDataURL(file.type || "image/png", 0.7);
            setLogoUrl(dataUrl);
          } catch (e) {
            console.error("Canvas export failed", e);
            setLogoUrl(ev.target.result); // fallback
          }
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 1, borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography fontWeight={800}>Workspace Settings</Typography>
        <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ pt: 3 }}>
        <Typography fontWeight={800} fontSize={14} mb={1}>Brand Logo</Typography>
        <Typography fontSize={12} color="text.secondary" mb={2}>
          Upload a logo or paste an image URL. This will replace the default logo in the navigation bar.
        </Typography>
        
        <Stack direction="row" spacing={2} alignItems="center" mb={4}>
          <Box sx={{
            width: 60, height: 60, borderRadius: 2, border: "2px dashed #ddd",
            display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
            background: "#f9f9f9"
          }}>
            {logoUrl ? <img src={logoUrl} alt="Logo" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /> : <ImageIcon sx={{ color: "#ccc" }} />}
          </Box>
          <Stack spacing={1} flex={1}>
            <TextField 
              size="small" fullWidth placeholder="https://example.com/logo.png" 
              value={logoUrl} onChange={e => setLogoUrl(e.target.value)}
            />
            <Button variant="outlined" component="label" size="small" sx={{ textTransform: "none", width: "fit-content" }}>
              Upload Image
              <input type="file" hidden accept="image/*" onChange={handleFileUpload} />
            </Button>
          </Stack>
        </Stack>

        <Typography fontWeight={800} fontSize={14} mb={1}>Primary Brand Color</Typography>
        <Typography fontSize={12} color="text.secondary" mb={2}>
          Select a color to match your company branding. This will apply to buttons, active tabs, and primary accents.
        </Typography>

        <Stack direction="row" spacing={1.5} flexWrap="wrap" gap={1.5}>
          {PRESET_COLORS.map(c => (
            <Box 
              key={c}
              onClick={() => setBrandColor(c)}
              sx={{
                width: 32, height: 32, borderRadius: "50%", background: c, cursor: "pointer",
                boxShadow: brandColor === c ? `0 0 0 3px #fff, 0 0 0 5px ${c}` : "none",
                transition: "all 0.15s"
              }}
            />
          ))}
          <Tooltip title="Custom Color">
            <Box sx={{
              width: 32, height: 32, borderRadius: "50%", overflow: "hidden", cursor: "pointer",
              border: "1px solid #ddd", display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <input 
                type="color" 
                value={brandColor} 
                onChange={e => setBrandColor(e.target.value)}
                style={{ width: "200%", height: "200%", cursor: "pointer", border: "none", outline: "none", background: "none" }}
              />
            </Box>
          </Tooltip>
        </Stack>

        <Typography fontWeight={800} fontSize={14} mb={1} mt={4}>Typography & Font</Typography>
        <Typography fontSize={12} color="text.secondary" mb={2}>
          Select the primary font family for the entire application.
        </Typography>

        <Stack direction="row" spacing={1.5} flexWrap="wrap" gap={1.5}>
          {PRESET_FONTS.map(f => (
            <Button 
              key={f.value}
              variant={brandFont === f.value ? "contained" : "outlined"}
              onClick={() => setBrandFont(f.value)}
              sx={{ 
                fontFamily: f.value, 
                textTransform: "none", 
                borderRadius: 2,
                background: brandFont === f.value ? brandColor : "transparent",
                color: brandFont === f.value ? "#fff" : "inherit",
                borderColor: brandFont === f.value ? brandColor : "#ddd"
              }}
            >
              {f.name}
            </Button>
          ))}
        </Stack>
      </DialogContent>
      
      <DialogActions sx={{ p: 2.5, pt: 1, borderTop: "1px solid #f0f0f0" }}>
        <Button onClick={onClose} color="inherit" sx={{ fontWeight: 600 }}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" sx={{ background: brandColor, color: "#fff", fontWeight: 700, borderRadius: 2 }}>
          Save Preferences
        </Button>
      </DialogActions>
    </Dialog>
  );
}
