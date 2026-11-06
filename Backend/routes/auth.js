const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../lib/supabase');
const { logAudit } = require('../lib/audit');
const { checkSecondFactor } = require('../lib/twoFactor');
const { sendMail } = require('../lib/mail');

const router = express.Router();

const WINDOW_MINUTES = 15;
const MAX_FAILS_PER_EMAIL = 5;
const MAX_FAILS_PER_IP = 25;
const RESET_MINUTES = 30;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Used so a wrong email takes as long to reject as a wrong password
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

const clientIp = (req) =>
  String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '')
    .split(',')[0]
    .trim()
    .slice(0, 64);

// Too many recent failures for this email or from this address?
async function isLockedOut(email, ip) {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60000).toISOString();
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
  return (byEmail.count || 0) >= MAX_FAILS_PER_EMAIL || (byIp.count || 0) >= MAX_FAILS_PER_IP;
}

const recordFailure = (email, ip) =>
  supabase.from('login_attempts').insert({ email, ip, succeeded: false });

async function finishLogin(res, user) {
  // Success: forget this email's failures, and tidy up old records
  await supabase.from('login_attempts').delete().eq('email', user.email).eq('succeeded', false);
  await supabase
    .from('login_attempts')
    .delete()
    .lt('created_at', new Date(Date.now() - 86400000).toISOString());

  const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });
  return res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role }
  });
}

const lockedMessage = `Too many failed attempts. Please wait ${WINDOW_MINUTES} minutes and try again.`;

// ---------- STEP 1: EMAIL AND PASSWORD ----------
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
    if (await isLockedOut(email, ip)) return res.status(429).json({ error: lockedMessage });

    const { data: user } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
    const valid = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

    if (!user || !valid) {
      await recordFailure(email, ip);
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (!user.active) {
      return res.status(403).json({ error: 'This account has been deactivated' });
    }

    // Two-factor is on: no login yet, only a short ticket that is good for the code step
    if (user.totp_enabled) {
      const challenge = jwt.sign({ id: user.id, purpose: '2fa' }, process.env.JWT_SECRET, {
        expiresIn: '5m'
      });
      return res.json({ needs_2fa: true, challenge });
    }

    return finishLogin(res, user);
  } catch (e) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// ---------- STEP 2: THE AUTHENTICATOR CODE (OR A RECOVERY CODE) ----------
router.post('/2fa', async (req, res) => {
  try {
    let payload;
    try {
      payload = jwt.verify(String((req.body && req.body.challenge) || ''), process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: 'Your login timed out. Please start again.' });
    }
    if (payload.purpose !== '2fa') {
      return res.status(401).json({ error: 'Your login timed out. Please start again.' });
    }

    const { data: user } = await supabase.from('users').select('*').eq('id', payload.id).maybeSingle();
    if (!user || !user.active || !user.totp_enabled) {
      return res.status(401).json({ error: 'Your login timed out. Please start again.' });
    }

    const ip = clientIp(req);
    if (await isLockedOut(user.email, ip)) return res.status(429).json({ error: lockedMessage });

    let ok = false;
    try {
      ok = await checkSecondFactor(user, req.body && req.body.code);
    } catch (e) {
      ok = false;
    }
    if (!ok) {
      await recordFailure(user.email, ip);
      return res.status(401).json({ error: 'That code is not correct' });
    }

    return finishLogin(res, user);
  } catch (e) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// ---------- FORGOT PASSWORD: ASK FOR AN EMAIL LINK ----------
// The answer is always the same, so nobody can use this to find out which emails have accounts.
router.post('/forgot', async (req, res) => {
  const generic = {
    ok: true,
    message: 'If that email belongs to an account, we have sent a link to reset the password.'
  };
  try {
    const email = String((req.body && req.body.email) || '').trim().toLowerCase().slice(0, 200);
    if (!EMAIL.test(email)) return res.json(generic);

    const ip = clientIp(req);
    const since = new Date(Date.now() - 3600000).toISOString();
    const [byEmail, byIp] = await Promise.all([
      supabase
        .from('password_resets')
        .select('id', { count: 'exact', head: true })
        .eq('email', email)
        .gte('created_at', since),
      ip
        ? supabase
            .from('password_resets')
            .select('id', { count: 'exact', head: true })
            .eq('ip', ip)
            .gte('created_at', since)
        : Promise.resolve({ count: 0 })
    ]);
    // At most 3 requests per email and 10 per address each hour (silently ignored after that)
    if ((byEmail.count || 0) >= 3 || (byIp.count || 0) >= 10) return res.json(generic);

    const { data: user } = await supabase
      .from('users')
      .select('id, email, active')
      .eq('email', email)
      .maybeSingle();

    const row = { email, ip };
    let token = null;
    if (user && user.active) {
      token = crypto.randomBytes(32).toString('hex');
      row.user_id = user.id;
      row.token_hash = sha256(token);
      row.expires_at = new Date(Date.now() + RESET_MINUTES * 60000).toISOString();
    }
    await supabase.from('password_resets').insert(row);

    if (token && process.env.FRONTEND_URL) {
      // The part after # is never sent to any server, so the token stays out of logs
      const link = `${process.env.FRONTEND_URL}/#reset=${token}`;
      await sendMail({
        to: user.email,
        subject: 'Reset your Prime Atlas password',
        text:
          `Hello,\n\nSomeone asked to reset the password for your Prime Atlas account.\n\n` +
          `Open this link within ${RESET_MINUTES} minutes to choose a new password:\n${link}\n\n` +
          `If you did not ask for this, you can ignore this email. Your password has not changed.`,
        html:
          `<p>Hello,</p><p>Someone asked to reset the password for your Prime Atlas account.</p>` +
          `<p><a href="${link}">Choose a new password</a> (this link works for ${RESET_MINUTES} minutes, one time only).</p>` +
          `<p>If you did not ask for this, you can ignore this email. Your password has not changed.</p>`
      });
    }
    return res.json(generic);
  } catch (e) {
    return res.json(generic);
  }
});

// ---------- FORGOT PASSWORD: CHOOSE A NEW ONE ----------
router.post('/reset', async (req, res) => {
  const expired = 'This link has expired or was already used. Please ask for a new one.';
  try {
    const token = String((req.body && req.body.token) || '');
    const password = String((req.body && req.body.password) || '');
    if (!/^[0-9a-f]{64}$/.test(token)) return res.status(400).json({ error: expired });
    if (password.length < 8 || password.length > 100) {
      return res.status(400).json({ error: 'Your new password must be 8 to 100 characters' });
    }

    const { data: row } = await supabase
      .from('password_resets')
      .select('id, user_id, email, expires_at, used_at')
      .eq('token_hash', sha256(token))
      .maybeSingle();
    if (!row || row.used_at || !row.expires_at || new Date(row.expires_at) < new Date()) {
      return res.status(400).json({ error: expired });
    }

    // Use the link up before anything else, so it can only ever work once
    const now = new Date().toISOString();
    const { data: claimed } = await supabase
      .from('password_resets')
      .update({ used_at: now })
      .eq('id', row.id)
      .is('used_at', null)
      .select('id');
    if (!claimed || !claimed.length) return res.status(400).json({ error: expired });

    const password_hash = await bcrypt.hash(password, 10);
    const { error } = await supabase
      .from('users')
      .update({ password_hash, tokens_valid_after: now })
      .eq('id', row.user_id);
    if (error) return res.status(500).json({ error: 'Something went wrong' });

    // Any other outstanding links stop working, and old failed logins no longer count
    await supabase.from('password_resets').update({ used_at: now }).eq('user_id', row.user_id).is('used_at', null);
    await supabase.from('login_attempts').delete().eq('email', row.email);

    await logAudit({
      actor_id: null,
      action: 'password_reset_by_email',
      target_type: 'account',
      target_id: row.user_id,
      ip: clientIp(req)
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;