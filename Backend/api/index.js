const express = require('express');
const cors = require('cors');
const supabase = require('../lib/supabase');
const requireAuth = require('../middleware/auth');
const { requireStaff, requireClient } = require('../middleware/auth');
const blockPendingForEmployees = require('../middleware/pendingGuard');
const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/db-test', async (req, res) => {
  const { error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) {
    return res.status(500).json({ connected: false, error: error.message });
  }
  res.json({ connected: true });
});

// Public: login only
app.use('/api/auth', require('../routes/auth'));

// Any logged-in account
app.get('/api/me', requireAuth, (req, res) => res.json(req.user));

// Manager only (the check happens inside team.js)
app.use('/api/team', requireAuth, require('../routes/team'));

// Client portal: client accounts only
app.use(
  '/api/portal',
  requireAuth,
  requireClient,
  require('../routes/portal'),
  require('../routes/portalChat')
);

// Staff routes (managers and employees). Client accounts are blocked here,
// and employees are blocked from briefs that are still awaiting approval.
app.use(
  '/api',
  requireAuth,
  requireStaff,
  blockPendingForEmployees,
  require('../routes/overview'),
  require('../routes/clientLogins'),
  require('../routes/clients'),
  require('../routes/propertyPage'),
  require('../routes/allProperties'),
  require('../routes/briefs'),
  require('../routes/clusters'),
  require('../routes/chat')
);

module.exports = app;