const express = require('express');
const bcrypt = require('bcryptjs');
const supabase = require('../lib/supabase');
const { requireManager } = require('../middleware/auth');

const router = express.Router();
const fail = (res, error) => res.status(500).json({ error: error.message });

async function findClient(id) {
  const { data } = await supabase
    .from('clients')
    .select('id, name, user_id')
    .eq('id', id)
    .single();
  return data;
}

// Does this client have a login?
router.get('/clients/:id/login', requireManager, async (req, res) => {
  const client = await findClient(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  if (!client.user_id) return res.json({ has_login: false });

  const { data: user } = await supabase
    .from('users')
    .select('email, active')
    .eq('id', client.user_id)
    .single();
  res.json({ has_login: !!user, email: user?.email, active: user?.active });
});

// Create a login for this client
router.post('/clients/:id/login', requireManager, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const client = await findClient(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  if (client.user_id) return res.status(409).json({ error: 'This client already has a login' });

  const password_hash = await bcrypt.hash(password, 10);
  const { data: user, error } = await supabase
    .from('users')
    .insert({
      name: client.name,
      email: email.trim().toLowerCase(),
      password_hash,
      role: 'client'
    })
    .select('id, email')
    .single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Email already in use' });
    return fail(res, error);
  }

  const { error: linkError } = await supabase
    .from('clients')
    .update({ user_id: user.id })
    .eq('id', client.id);
  if (linkError) {
    await supabase.from('users').delete().eq('id', user.id);
    return fail(res, linkError);
  }

  res.status(201).json({ has_login: true, email: user.email, active: true });
});

// Reset the password, or switch access on or off
router.patch('/clients/:id/login', requireManager, async (req, res) => {
  const client = await findClient(req.params.id);
  if (!client || !client.user_id) return res.status(404).json({ error: 'No login for this client' });

  const updates = {};
  if (req.body.password !== undefined) {
    if (String(req.body.password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    updates.password_hash = await bcrypt.hash(req.body.password, 10);
  }
  if (req.body.active !== undefined) updates.active = !!req.body.active;
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Nothing to change' });
  }

  const { error } = await supabase.from('users').update(updates).eq('id', client.user_id);
  if (error) return fail(res, error);
  res.json({ ok: true });
});

module.exports = router;