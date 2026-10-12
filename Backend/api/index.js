const express = require('express');
const cors = require('cors');
const supabase = require('../lib/supabase');
const requireAuth = require('../middleware/auth');
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

// Public routes (login / sign up)
app.use('/api/auth', require('../routes/auth'));

// Everything below needs a logged-in user
app.use('/api', requireAuth, require('../routes/data'));

module.exports = app;