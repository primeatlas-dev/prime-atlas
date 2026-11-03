const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../lib/supabase');

const router = express.Router();

const WINDOW_MINUTES = 15;
const MAX_FAILS_PER_EMAIL = 5;
const MAX_FAILS_PER_IP = 25;
// Used so a wrong email takes as long to reject as a wrong password
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const clientIp = (req) =>
  String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '')
    .split(',')[0]
    .trim()
    .slice(0, 64);

router.post('/login', async (req, res) => {
  try {
    const email = String((req.body && req.body.email) || '').trim().toLowerCase().slice(0, 200);
    const password = String((req.body && req.body.password) || '');
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (password.length > 200) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const ip = clientIp(req);
    const since = new Date(Date.now() - WINDOW_MINUTES * 60000).toISOString();

    // Too many recent failures for this email or from this address? Stop here.
    const [byEmail, byIp] = await Promise.all([
      supabase
        .from('login_attempts')
        .select('id', { count: 'exact', head: true })
        .eq('email', email)
        .eq('succeeded', false)
        .gte('created_at', since),
      ip
        ? supabase
            .from('login_attempts')
            .select('id', { count: 'exact', head: true })
            .eq('ip', ip)
            .eq('succeeded', false)
            .gte('created_at', since)
        : Promise.resolve({ count: 0 })
    ]);
    if ((byEmail.count || 0) >= MAX_FAILS_PER_EMAIL || (byIp.count || 0) >= MAX_FAILS_PER_IP) {
      return res.status(429).json({
        error: `Too many failed attempts. Please wait ${WINDOW_MINUTES} minutes and try again.`
      });
    }

    const { data: user } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
    const valid = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

    if (!user || !valid) {
      await supabase.from('login_attempts').insert({ email, ip, succeeded: false });
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (!user.active) {
      return res.status(403).json({ error: 'This account has been deactivated' });
    }

    // Success: forget this email's failures, and tidy up old records
    await supabase.from('login_attempts').delete().eq('email', email).eq('succeeded', false);
    await supabase
      .from('login_attempts')
      .delete()
      .lt('created_at', new Date(Date.now() - 86400000).toISOString());

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  } catch (e) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;