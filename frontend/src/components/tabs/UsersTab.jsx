import { useState, useEffect } from "react";
import axios from "axios";
import {
  Stack, Typography, Paper, Avatar, Chip, IconButton, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Alert, MenuItem, Select, FormControl,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Checkbox, FormControlLabel, Divider
} from "@mui/material";
import {
  Person, AdminPanelSettings, DeleteOutline, CheckCircle, PersonAdd, Dashboard
} from "@mui/icons-material";
import { API } from "../../constants";

const R  = "#c52626";
const GR = "#449042";

const UsersTab = ({ currentUser }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", email: "", password: "", role: "user" });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignUserId, setAssignUserId] = useState(null);
  const [allDashboards, setAllDashboards] = useState([]);
  const [assignedFileIds, setAssignedFileIds] = useState([]);
  const [assignLoading, setAssignLoading] = useState(false);

  const handleAddSubmit = async () => {
    setAddError("");
    if (!addForm.name || !addForm.email || !addForm.password) return setAddError("All fields are required.");
    if (addForm.password.length < 6) return setAddError("Password must be at least 6 characters.");
    setAddLoading(true);
    try {
      await axios.post(`${API}/auth/users`, addForm);
      setSuccessMsg("User created successfully.");
      setTimeout(() => setSuccessMsg(""), 3000);
      setAddOpen(false);
      setAddForm({ name: "", email: "", password: "", role: "user" });
      fetchUsers();
    } catch (e) {
      setAddError(e.response?.data?.detail || "Failed to create user.");
    } finally {
      setAddLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoading(true); setError(null);
    try {
      const { data } = await axios.get(`${API}/auth/users`);
      setUsers(data.users || []);
    } catch (e) {
      setError("Failed to fetch users. You might not have admin privileges.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    try {
      await axios.put(`${API}/auth/users/${userId}/role`, { role: newRole });
      setSuccessMsg("Role updated successfully.");
      setTimeout(() => setSuccessMsg(""), 3000);
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to update role");
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user? This cannot be undone.")) return;
    try {
      await axios.delete(`${API}/auth/users/${userId}`);
      setSuccessMsg("User deleted.");
      setTimeout(() => setSuccessMsg(""), 3000);
      setUsers(users.filter(u => u.id !== userId));
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to delete user");
    }
  };

  const handleOpenAssign = async (userId) => {
    setAssignUserId(userId);
    setAssignOpen(true);
    setAssignLoading(true);
    try {
      const [{ data: dashData }, { data: userDashData }] = await Promise.all([
        axios.get(`${API}/dashboards`),
        axios.get(`${API}/auth/users/${userId}/dashboards`)
      ]);
      setAllDashboards(dashData.dashboards || []);
      setAssignedFileIds(userDashData.file_ids || []);
    } catch (e) {
      setError("Failed to fetch assignment data.");
    } finally {
      setAssignLoading(false);
    }
  };

  const handleAssignSave = async () => {
    setAssignLoading(true);
    try {
      await axios.post(`${API}/auth/users/${assignUserId}/dashboards`, { file_ids: assignedFileIds });
      setSuccessMsg("Dashboards assigned successfully.");
      setTimeout(() => setSuccessMsg(""), 3000);
      setAssignOpen(false);
    } catch (e) {
      setError("Failed to save dashboard assignments.");
    } finally {
      setAssignLoading(false);
    }
  };

  return (
    <Stack spacing={3} sx={{ p: { xs: 2, sm: 4 }, maxWidth: 1000, mx: "auto" }}>
      
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Stack direction="row" alignItems="center" spacing={2}>
          <Avatar sx={{ width: 48, height: 48, background: `linear-gradient(135deg,${R},#e05555)` }}>
            <AdminPanelSettings sx={{ fontSize: 24, color: "#fff" }} />
          </Avatar>
          <Stack>
            <Typography fontWeight={900} fontSize={22} color="text.primary">
              User Management
            </Typography>
            <Typography fontSize={13} color="text.secondary">
              Manage roles and access for all registered users.
            </Typography>
          </Stack>
        </Stack>
        <Button 
          variant="contained" 
          startIcon={<PersonAdd />}
          onClick={() => setAddOpen(true)}
          sx={{ background: GR, "&:hover": { background: "#337031" }, fontWeight: 700, borderRadius: 2, textTransform: "none" }}
        >
          Add User
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
      {successMsg && <Alert severity="success" icon={<CheckCircle />} sx={{ borderRadius: 2 }}>{successMsg}</Alert>}

      <Paper elevation={0} sx={{
        border: "1.5px solid #f0f0f0", borderRadius: 3, overflow: "hidden",
        background: "rgba(255,255,255,0.8)", backdropFilter: "blur(20px)"
      }}>
        {loading ? (
          <Stack alignItems="center" py={6}>
            <CircularProgress size={30} sx={{ color: R }} />
          </Stack>
        ) : (
          <TableContainer>
            <Table>
              <TableHead sx={{ background: "#f8f9fa" }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, color: "text.secondary", fontSize: 11, textTransform: "uppercase" }}>User</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: "text.secondary", fontSize: 11, textTransform: "uppercase" }}>Role</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: "text.secondary", fontSize: 11, textTransform: "uppercase" }}>Joined</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: "text.secondary", fontSize: 11, textTransform: "uppercase" }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  const initials = u.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

                  return (
                    <TableRow key={u.id} hover>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          <Avatar sx={{
                            width: 32, height: 32, fontSize: 12, fontWeight: 800,
                            background: u.role === "admin" ? `linear-gradient(135deg,${R},#e05555)` : `linear-gradient(135deg,${GR},#6ab868)`,
                          }}>
                            {initials}
                          </Avatar>
                          <Stack>
                            <Typography fontWeight={700} fontSize={13}>
                              {u.name} {isSelf && <Chip label="You" size="small" sx={{ ml: 1, height: 16, fontSize: 9, fontWeight: 800 }} />}
                            </Typography>
                            <Typography color="text.secondary" fontSize={11}>{u.email}</Typography>
                          </Stack>
                        </Stack>
                      </TableCell>
                      
                      <TableCell>
                        <FormControl size="small" sx={{ minWidth: 100 }}>
                          <Select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            disabled={isSelf} // Don't allow changing own role to prevent lockout
                            sx={{
                              height: 30, fontSize: 12, fontWeight: 700, borderRadius: 2,
                              "& fieldset": { border: "none" },
                              background: u.role === "admin" ? `${R}15` : `${GR}15`,
                              color: u.role === "admin" ? R : GR,
                              "& .MuiSelect-icon": { color: "inherit" }
                            }}
                          >
                            <MenuItem value="admin" sx={{ fontSize: 12, fontWeight: 700, color: R }}>Admin</MenuItem>
                            <MenuItem value="user" sx={{ fontSize: 12, fontWeight: 700, color: GR }}>User</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>

                      <TableCell>
                        <Typography fontSize={12} color="text.secondary" fontWeight={600}>
                          {new Date(u.created_at).toLocaleDateString()}
                        </Typography>
                      </TableCell>

                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Tooltip title={u.role === "admin" ? "Admins have access to all dashboards" : "Assign Dashboards"}>
                            <span>
                              <IconButton size="small" disabled={u.role === "admin"} onClick={() => handleOpenAssign(u.id)}
                                sx={{ color: "text.disabled", "&:hover": { color: "#1976d2", background: "#1976d210" } }}>
                                <Dashboard sx={{ fontSize: 18 }} />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title={isSelf ? "Cannot delete yourself" : "Delete User"}>
                            <span>
                              <IconButton size="small" disabled={isSelf} onClick={() => handleDelete(u.id)}
                                sx={{ color: "text.disabled", "&:hover": { color: R, background: `${R}10` } }}>
                                <DeleteOutline sx={{ fontSize: 18 }} />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
      <Dialog open={addOpen} onClose={() => !addLoading && setAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Add New User</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {addError && <Alert severity="error">{addError}</Alert>}
            <TextField
              label="Full Name" size="small" fullWidth
              value={addForm.name} onChange={e => setAddForm({...addForm, name: e.target.value})}
              disabled={addLoading}
            />
            <TextField
              label="Email Address" type="email" size="small" fullWidth
              value={addForm.email} onChange={e => setAddForm({...addForm, email: e.target.value})}
              disabled={addLoading}
            />
            <TextField
              label="Password" type="password" size="small" fullWidth
              value={addForm.password} onChange={e => setAddForm({...addForm, password: e.target.value})}
              disabled={addLoading}
            />
            <FormControl size="small" fullWidth disabled={addLoading}>
              <Select
                value={addForm.role}
                onChange={e => setAddForm({...addForm, role: e.target.value})}
              >
                <MenuItem value="user">User</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAddOpen(false)} disabled={addLoading} color="inherit" sx={{ textTransform: "none", fontWeight: 700 }}>Cancel</Button>
          <Button onClick={handleAddSubmit} disabled={addLoading} variant="contained" sx={{ background: R, "&:hover": { background: "#a01e1e" }, textTransform: "none", fontWeight: 700 }}>
            {addLoading ? <CircularProgress size={20} color="inherit" /> : "Create User"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={assignOpen} onClose={() => !assignLoading && setAssignOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Assign Dashboards</DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          {assignLoading ? (
            <Stack alignItems="center" py={4}><CircularProgress size={30} /></Stack>
          ) : (
            <Stack divider={<Divider />}>
              {allDashboards.length === 0 ? (
                <Typography color="text.secondary" p={3} textAlign="center">No dashboards available.</Typography>
              ) : (
                allDashboards.map(dash => {
                  const isAssigned = assignedFileIds.includes(dash.file_id);
                  return (
                    <Stack direction="row" alignItems="center" justifyContent="space-between" p={2} px={3} key={dash.file_id}
                      sx={{ "&:hover": { background: "#f8f9fa" } }}
                    >
                      <Stack>
                        <Typography fontWeight={700} fontSize={14}>{dash.filename}</Typography>
                        <Typography color="text.secondary" fontSize={12}>{dash.rows.toLocaleString()} rows • {dash.mode}</Typography>
                      </Stack>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={isAssigned}
                            onChange={(e) => {
                              if (e.target.checked) setAssignedFileIds([...assignedFileIds, dash.file_id]);
                              else setAssignedFileIds(assignedFileIds.filter(id => id !== dash.file_id));
                            }}
                            sx={{ color: R, "&.Mui-checked": { color: R } }}
                          />
                        }
                        label={isAssigned ? "Assigned" : "Unassigned"}
                        sx={{ m: 0, "& .MuiTypography-root": { fontSize: 13, fontWeight: 600, color: isAssigned ? R : "text.secondary" } }}
                      />
                    </Stack>
                  )
                })
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAssignOpen(false)} disabled={assignLoading} color="inherit" sx={{ textTransform: "none", fontWeight: 700 }}>Cancel</Button>
          <Button onClick={handleAssignSave} disabled={assignLoading} variant="contained" sx={{ background: R, "&:hover": { background: "#a01e1e" }, textTransform: "none", fontWeight: 700 }}>
            {assignLoading ? <CircularProgress size={20} color="inherit" /> : "Save Assignments"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default UsersTab;
