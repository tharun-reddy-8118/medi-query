import { useState, useEffect } from "react";
import {
  Drawer, Box, Typography, IconButton, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper
} from "@mui/material";
import { Close } from "@mui/icons-material";
import axios from "axios";
import { API } from "../../constants";

export default function DrilldownDrawer({ open, onClose, fileId, filterCol, filterVal, crossFilterCol, crossFilterVal }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ rows: [], columns: [] });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open && fileId) {
      setLoading(true);
      setError(null);
      axios.get(`${API}/drilldown/${fileId}`, {
        params: {
          filter_col: filterCol || null,
          filter_val: filterVal || null,
          cross_filter_col: crossFilterCol || null,
          cross_filter_val: crossFilterVal || null
        }
      })
      .then((res) => setData(res.data))
      .catch((err) => setError("Failed to load raw data."))
      .finally(() => setLoading(false));
    }
  }, [open, fileId, filterCol, filterVal, crossFilterCol, crossFilterVal]);

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: { xs: '100vw', sm: 600, md: 800 }, display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#FAFAFA' }}>
        
        {/* Header */}
        <Box sx={{ p: 3, borderBottom: '1px solid #E0E0E0', bgcolor: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#1A1A1A' }}>Raw Data</Typography>
            <Typography variant="body2" color="text.secondary">
              Top 100 rows matching current filters
            </Typography>
          </Box>
          <IconButton onClick={onClose} sx={{ bgcolor: '#F5F5F5' }}><Close /></IconButton>
        </Box>

        {/* Filters Summary */}
        {(filterCol || crossFilterCol) && (
          <Box sx={{ px: 3, py: 2, display: 'flex', gap: 1, flexWrap: 'wrap', borderBottom: '1px solid #E0E0E0' }}>
            {filterCol && <Typography variant="caption" sx={{ bgcolor: 'rgba(25, 118, 210, 0.1)', color: 'primary.main', px: 1, py: 0.5, borderRadius: 1 }}>{filterCol}: {filterVal}</Typography>}
            {crossFilterCol && <Typography variant="caption" sx={{ bgcolor: 'rgba(25, 118, 210, 0.1)', color: 'primary.main', px: 1, py: 0.5, borderRadius: 1 }}>{crossFilterCol}: {crossFilterVal}</Typography>}
          </Box>
        )}

        {/* Content */}
        <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><CircularProgress /></Box>
          ) : error ? (
            <Typography color="error">{error}</Typography>
          ) : data.rows.length === 0 ? (
            <Typography color="text.secondary">No data matches the current filters.</Typography>
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E0E0E0', borderRadius: 2 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {data.columns.map((col) => (
                      <TableCell key={col} sx={{ fontWeight: 600, bgcolor: '#F5F5F5' }}>{col}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.rows.map((row, i) => (
                    <TableRow key={i} hover>
                      {data.columns.map((col) => (
                        <TableCell key={col} sx={{ whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {row[col] !== null && row[col] !== undefined ? String(row[col]) : "—"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>

      </Box>
    </Drawer>
  );
}
