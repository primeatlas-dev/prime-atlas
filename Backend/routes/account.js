const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../lib/supabase');
const { logAudit } = require('../lib/audit');
const tf = require('../lib/twoFactor');

const router = express.Router();

const clientIp = (req) =>
  String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '')
    .split(',')[0]
    .trim()
    .slice(0, 64);

const sessionToken = (user) =>
  jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });

const staffOnly = (req, res, next) =>
  ['manager', 'employee'].includes(req.user.role)
    ? next()
    : res.status(403).json({ error: 'Two-factor login is for staff accounts' });

const loadFull = async (id) => (await supabase.from('users').select('*').eq('id', id).maybeSingle()).data;
const passwordOk = async (user, password) =>
  !!user && (await bcrypt.compare(String(password || ''), user.password_hash));

const audit = (req, action) =>
  logAudit({
    actor_id: req.user.id,
    action,
    target_type: 'account',
    target_id: req.user.id,
    ip: clientIp(req)
  });

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

    const user = await loadFull(req.user.id);
    if (!(await passwordOk(user, current))) {
      return res.status(400).json({ error: 'Your current password is not correct' });
    }

    const password_hash = await bcrypt.hash(next, 10);
    // Every older login token stops working; the new one below keeps this person signed in
    const { error } = await supabase
      .from('users')
      .update({ password_hash, tokens_valid_after: new Date().toISOString() })
      .eq('id', req.user.id);
    if (error) return res.status(500).json({ error: error.message });

    res.json({ ok: true, token: sessionToken(req.user) });
  } catch (e) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// ---------- TWO-FACTOR LOGIN (staff only) ----------
router.get('/2fa/status', staffOnly, async (req, res) => {
  try {
    const user = await loadFull(req.user.id);
    res.json({
      available: tf.isConfigured(),
      enabled: !!(user && user.totp_enabled),
      recovery_left: user && user.totp_enabled ? await tf.recoveryLeft(user.id) : 0
    });
  } catch (e) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Step 1: check the password, then create a secret to scan
router.post('/2fa/setup', staffOnly, async (req, res) => {
  try {
    if (!tf.isConfigured()) {
      return res.status(400).json({ error: 'Two-factor login has not been switched on in the server settings yet' });
    }
    const user = await loadFull(req.user.id);
    if (user.totp_enabled) return res.status(400).json({ error: 'Two-factor login is already on' });
    if (!(await passwordOk(user, req.body && req.body.password))) {
      return res.status(400).json({ error: 'Your password is not correct' });
    }

    const secret = tf.newSecret();
    const { error } = await supabase
      .from('users')
      .update({ totp_secret_enc: tf.encrypt(secret), totp_enabled: false, totp_last_step: null })
      .eq('id', user.id);
    if (error) return res.status(500).json({ error: 'Something went wrong' });

    res.json({ secret, uri: tf.otpauthUri(user.email, secret) });
  } catch (e) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Step 2: prove the app works by typing a code, then switch it on
router.post('/2fa/enable', staffOnly, async (req, res) => {
  try {
    const user = await loadFull(req.user.id);
    if (user.totp_enabled) return res.status(400).json({ error: 'Two-factor login is already on' });
    if (!user.totp_secret_enc) return res.status(400).json({ error: 'Start the setup first' });

    let step = null;
    try {
      step = tf.verifyCode(tf.decrypt(user.totp_secret_enc), req.body && req.body.code, null);
    } catch (e) {
      step = null;
    }
    if (step === null) {
      return res.status(400).json({ error: 'That code is not correct. Wait for a new code and try again.' });
    }

    // Other devices are signed out; this one stays signed in with the new token
    const { error } = await supabase
      .from('users')
      .update({ totp_enabled: true, totp_last_step: step, tokens_valid_after: new Date().toISOString() })
      .eq('id', user.id);
    if (error) return res.status(500).json({ error: 'Something went wrong' });

    const codes = await tf.saveRecoveryCodes(user.id);
    await audit(req, 'two_factor_enabled');
    res.json({ ok: true, token: sessionToken(user), recovery_codes: codes });
  } catch (e) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Turn it off (needs the password AND a code)
router.post('/2fa/disable', staffOnly, async (req, res) => {
  try {
    const user = await loadFull(req.user.id);
    if (!user.totp_enabled) return res.status(400).json({ error: 'Two-factor login is not on' });
    if (!(await passwordOk(user, req.body && req.body.password))) {
      return res.status(400).json({ error: 'Your password is not correct' });
    }
    let ok = false;
    try {
      ok = await tf.checkSecondFactor(user, req.body && req.body.code);
    } catch (e) {
      ok = false;
    }
    if (!ok) return res.status(400).json({ error: 'That code is not correct' });

    const { error } = await supabase
      .from('users')
      .update({
        totp_enabled: false,
        totp_secret_enc: null,
        totp_last_step: null,
        tokens_valid_after: new Date().toISOString()
      })
      .eq('id', user.id);
    if (error) return res.status(500).json({ error: 'Something went wrong' });

    await supabase.from('two_factor_recovery').delete().eq('user_id', user.id);
    await audit(req, 'two_factor_disabled');
    res.json({ ok: true, token: sessionToken(user) });
  } catch (e) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Make a fresh set of recovery codes (the old ones stop working)
router.post('/2fa/recovery-codes', staffOnly, async (req, res) => {
  try {
    const user = await loadFull(req.user.id);
    if (!user.totp_enabled) return res.status(400).json({ error: 'Two-factor login is not on' });
    if (!(await passwordOk(user, req.body && req.body.password))) {
      return res.status(400).json({ error: 'Your password is not correct' });
    }
    let ok = false;
    try {
      ok = await tf.checkSecondFactor(user, req.body && req.body.code);
    } catch (e) {
      ok = false;
    }
    if (!ok) return res.status(400).json({ error: 'That code is not correct' });

    res.json({ recovery_codes: await tf.saveRecoveryCodes(user.id) });
  } catch (e) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;