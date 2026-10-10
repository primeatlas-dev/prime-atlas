const express = require('express');
const cors = require('cors');
const supabase = require('../lib/supabase');
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

module.exports = app;