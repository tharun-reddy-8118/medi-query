import { Box } from "@mui/material";

const blobs = [
  { top: "-12%",  left: "-8%",   size: 440, c: "rgba(108,99,255,0.09)" },
  { top: "58%",   right: "-10%", size: 350, c: "rgba(255,107,107,0.08)" },
  { bottom: "-8%",left: "35%",   size: 280, c: "rgba(0,201,167,0.09)" },
];

const BlobBg = () => (
  <Box sx={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
    {blobs.map((b, i) => (
      <Box
        key={i}
        sx={{
          position: "absolute",
          ...(b.top    && { top: b.top }),
          ...(b.bottom && { bottom: b.bottom }),
          ...(b.left   && { left: b.left }),
          ...(b.right  && { right: b.right }),
          width: b.size, height: b.size,
          borderRadius: "50%",
          background: b.c,
          filter: "blur(70px)",
        }}
      />
    ))}
  </Box>
);

export default BlobBg;
