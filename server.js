require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const adminAuthRoutes = require('./routes/adminAuth');
const officerAuthRoutes = require('./routes/officerAuth');
const officersRoutes = require('./routes/officers');

const app = express();
app.use(cors());
app.use(express.json());

// Serve the simple test page (public/test.html) so we can try the API
// in a browser before the real web portal exists.
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'SIMS Central Server', time: new Date().toISOString() });
});

app.use('/api/admin', adminAuthRoutes);
app.use('/api/officer', officerAuthRoutes);
app.use('/api/officers', officersRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SIMS server running on port ${PORT}`);
});
