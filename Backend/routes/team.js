const express = require('express');
const bcrypt = require('bcryptjs');
const supabase = require('../lib/supabase');
const { requireManager } = require('../middleware/auth');

const router = express.Router();
router.use(requireManager);

// List everyone on the team
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role, active, created_at')
    .in('role', ['manager', 'employee'])
    .order('created_at');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Create an employee account
router.post('/', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const password_hash = await bcrypt.hash(password, 10);
  const { data, error } = await supabase
    .from('users')
    .insert({ name, email: email.trim().toLowerCase(), password_hash, role: 'employee' })
    .select('id, name, email, role, active')
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Email already in use' });
    }
    return res.status(500).json({ error: error.message });
  }
  res.status(201).json(data);
});

// Activate or deactivate an account
router.patch('/:id', async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: "You can't change your own account" });
  }
  const { data, error } = await supabase
    .from('users')
    .update({ active: !!req.body.active })
    .eq('id', req.params.id)
    .select('id, name, email, role, active')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;