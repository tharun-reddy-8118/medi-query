import { Card, CardContent, Stack, Avatar, Typography } from "@mui/material";

const StatCard = ({ label, value, icon, gradient }) => {
  const shadowColor = gradient.includes("6C63")
    ? "rgba(108,99,255,0.28)"
    : gradient.includes("FF6B")
    ? "rgba(255,107,107,0.28)"
    : "rgba(0,201,167,0.28)";

  return (
    <Card elevation={0} sx={{ flex: 1, minWidth: 0 }}>
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Avatar sx={{ width: 52, height: 52, background: gradient, boxShadow: `0 8px 20px ${shadowColor}` }}>
            {icon}
          </Avatar>
          <Stack>
            <Typography
              variant="h4" fontWeight={900}
              sx={{ background: gradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1 }}
            >
              {value}
            </Typography>
            <Typography fontSize={11} color="text.secondary" fontWeight={700}
              textTransform="uppercase" letterSpacing={0.8} mt={0.5}>
              {label}
            </Typography>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default StatCard;
