const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../lib/supabase');

const router = express.Router();

function makeToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const password_hash = await bcrypt.hash(password, 10);
  const { data, error } = await supabase
    .from('users')
    .insert({ email: email.trim().toLowerCase(), name, password_hash })
    .select('id, email, name')
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    return res.status(500).json({ error: error.message });
  }
  res.json({ token: makeToken(data), user: data });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.trim().toLowerCase())
    .single();

  const valid = user && (await bcrypt.compare(password, user.password_hash));
  if (error || !valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  res.json({ token: makeToken(user), user: { id: user.id, email: user.email, name: user.name } });
});

module.exports = router;