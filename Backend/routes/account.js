const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../lib/supabase');

const router = express.Router();

// Any logged-in account (manager, employee or client) can change its own password
router.post('/password', async (req, res) => {
  try {
    const current = String((req.body && req.body.current_password) || '');
    const next = String((req.body && req.body.new_password) || '');
    if (!current || !next) return res.status(400).json({ error: 'Fill in both passwords' });
    if (next.length < 8 || next.length > 100) {
      return res.status(400).json({ error: 'Your new password must be 8 to 100 characters' });
    }
    if (next === current) return res.status(400).json({ error: 'Choose a different password' });

    const { data: user } = await supabase
      .from('users')
      .select('id, password_hash')
      .eq('id', req.user.id)
      .maybeSingle();
    const ok = user && (await bcrypt.compare(current, user.password_hash));
    if (!ok) return res.status(400).json({ error: 'Your current password is not correct' });

    const password_hash = await bcrypt.hash(next, 10);
    // Every older login token stops working; the new one below keeps this person signed in
    const { error } = await supabase
      .from('users')
      .update({ password_hash, tokens_valid_after: new Date().toISOString() })
      .eq('id', req.user.id);
    if (error) return res.status(500).json({ error: error.message });

    const token = jwt.sign({ id: req.user.id, email: req.user.email }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });
    res.json({ ok: true, token });
  } catch (e) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;