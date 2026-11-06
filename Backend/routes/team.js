const express = require('express');
const bcrypt = require('bcryptjs');
const supabase = require('../lib/supabase');
const { logAudit } = require('../lib/audit');
const { requireManager } = require('../middleware/auth');

const router = express.Router();
router.use(requireManager);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fail = (res, error) => res.status(500).json({ error: error.message });
const clientIp = (req) =>
  String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '')
    .split(',')[0]
    .trim()
    .slice(0, 64);

// List the manager and employees (client logins are not shown here)
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role, active, created_at, totp_enabled')
    .in('role', ['manager', 'employee'])
    .order('created_at');
  if (error) return fail(res, error);
  res.json(data);
});

// Create an employee account
router.post('/', async (req, res) => {
  const name = String((req.body && req.body.name) || '').trim().slice(0, 100);
  const email = String((req.body && req.body.email) || '').trim().toLowerCase().slice(0, 200);
  const password = String((req.body && req.body.password) || '');
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  if (!EMAIL.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });
  if (password.length < 8 || password.length > 100) {
    return res.status(400).json({ error: 'Password must be 8 to 100 characters' });
  }

  const password_hash = await bcrypt.hash(password, 10);
  const { data, error } = await supabase
    .from('users')
    .insert({ name, email, password_hash, role: 'employee' })
    .select('id, name, email, role, active')
    .single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Email already in use' });
    return fail(res, error);
  }
  res.status(201).json(data);
});

// Switch an employee on or off, reset their password, or reset their two-factor login
router.patch('/:id', async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: "You can't change your own account here" });
  }
  const { data: target } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', req.params.id)
    .maybeSingle();
  if (!target || target.role !== 'employee') {
    return res.status(404).json({ error: 'Employee not found' });
  }

  const now = new Date().toISOString();
  const updates = {};
  if (req.body.active !== undefined) updates.active = !!req.body.active;
  if (req.body.password !== undefined) {
    const password = String(req.body.password);
    if (password.length < 8 || password.length > 100) {
      return res.status(400).json({ error: 'Password must be 8 to 100 characters' });
    }
    updates.password_hash = await bcrypt.hash(password, 10);
    updates.tokens_valid_after = now;
  }
  const resetTwoFactor = req.body.reset_2fa === true;
  if (resetTwoFactor) {
    updates.totp_enabled = false;
    updates.totp_secret_enc = null;
    updates.totp_last_step = null;
    updates.tokens_valid_after = now;
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nothing to change' });

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', target.id)
    .select('id, name, email, role, active')
    .single();
  if (error) return fail(res, error);

  if (resetTwoFactor) {
    await supabase.from('two_factor_recovery').delete().eq('user_id', target.id);
    await logAudit({
      actor_id: req.user.id,
      action: 'employee_2fa_reset',
      target_type: 'employee',
      target_id: target.id,
      ip: clientIp(req)
    });
  }
  res.json(data);
});

module.exports = router;