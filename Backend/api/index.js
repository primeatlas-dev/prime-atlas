const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const supabase = require('../lib/supabase');
const requireAuth = require('../middleware/auth');
const { requireStaff, requireClient } = require('../middleware/auth');
const blockPendingForEmployees = require('../middleware/pendingGuard');
const app = express();

app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
// If FRONTEND_URL is ever missing, refuse cross-site requests instead of allowing everyone
app.use(cors({ origin: process.env.FRONTEND_URL || false }));
app.use(express.json({ limit: '100kb' }));

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
app.use('/api/account', requireAuth, require('../routes/account'));

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
// Order matters: assign.js comes before allProperties.js so its version of "assign" is used.
app.use(
  '/api',
  requireAuth,
  requireStaff,
  blockPendingForEmployees,
  require('../routes/overview'),
  require('../routes/clientLogins'),
  require('../routes/clientData'),
  require('../routes/clients'),
  require('../routes/feeSummary'),
  require('../routes/fees'),
  require('../routes/propertyPage'),
  require('../routes/assign'),
  require('../routes/allProperties'),
  require('../routes/briefs'),
  require('../routes/clusters'),
  require('../routes/chat')
);

// Friendly errors for oversized or broken requests
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'That request is too large' });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid request' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

module.exports = app;