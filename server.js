require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const adminAuthRoutes = require('./routes/adminAuth');
const officerAuthRoutes = require('./routes/officerAuth');
const officersRoutes = require('./routes/officers');
const adminsRoutes = require('./routes/admins');
const setupRoutes = require('./routes/setup');
const schoolsRoutes = require('./routes/schools');
const inspectionsRoutes = require('./routes/inspections');
const assignmentsRoutes = require('./routes/assignments');
const reportsRoutes = require('./routes/reports');

const app = express();
app.use(cors());
// Default body size limit is tiny (100kb) — way too small for a PDF report
// plus individual photos and a signature, all sent as base64 text. 45mb
// gives comfortable room for a report with several photos attached.
app.use(express.json({ limit: '45mb' }));

// Serve the simple test page (public/test.html) so we can try the API
// in a browser before the real web portal exists.
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'SIMS Central Server', time: new Date().toISOString() });
});

app.use('/api/admin', adminAuthRoutes);
app.use('/api/officer', officerAuthRoutes);
app.use('/api/officers', officersRoutes);
app.use('/api/admins', adminsRoutes);
app.use('/api/setup', setupRoutes);
app.use('/api/schools', schoolsRoutes);
app.use('/api/inspections', inspectionsRoutes);
app.use('/api/assignments', assignmentsRoutes);
app.use('/api/reports', reportsRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SIMS server running on port ${PORT}`);
});
