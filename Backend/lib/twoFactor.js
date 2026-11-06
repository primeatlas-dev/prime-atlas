const crypto = require('crypto');
const supabase = require('./supabase');

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const RECOVERY_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const STEP_SECONDS = 30;

// The secret for each person is encrypted before it is stored, using TWO_FACTOR_KEY
function encryptionKey() {
  const k = process.env.TWO_FACTOR_KEY;
  if (!k || k.length < 32) return null;
  return crypto.createHash('sha256').update(k).digest();
}

const isConfigured = () => !!encryptionKey();

function encrypt(text) {
  const key = encryptionKey();
  if (!key) throw new Error('Two-factor is not set up on the server');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}

function decrypt(payload) {
  const key = encryptionKey();
  if (!key) throw new Error('Two-factor is not set up on the server');
  const raw = Buffer.from(payload, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
}

function base32Encode(buf) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of String(str).toUpperCase().replace(/[^A-Z2-7]/g, '')) {
    value = (value << 5) | ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
      value &= (1 << bits) - 1;
    }
  }
  return Buffer.from(out);
}

const newSecret = () => base32Encode(crypto.randomBytes(20));

function otpauthUri(email, secret) {
  const label = encodeURIComponent(`Prime Atlas:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent('Prime Atlas')}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;
}

function hotp(secret, counter) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', secret).update(buf).digest();
  const o = h[h.length - 1] & 0xf;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1000000).padStart(6, '0');
}

// Returns the time step that matched, or null. A step that was already used is refused,
// so a code can never be used twice.
function verifyCode(secretBase32, code, lastStep) {
  const clean = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(clean)) return null;
  const secret = base32Decode(secretBase32);
  const now = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  for (let w = -1; w <= 1; w++) {
    const step = now + w;
    if (lastStep !== null && lastStep !== undefined && step <= Number(lastStep)) continue;
    if (crypto.timingSafeEqual(Buffer.from(hotp(secret, step)), Buffer.from(clean))) return step;
  }
  return null;
}

// ---------- recovery codes ----------
const normaliseRecovery = (code) => String(code || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const hashRecovery = (code) => crypto.createHash('sha256').update(normaliseRecovery(code)).digest('hex');

function makeRecoveryCodes(count = 8) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    let c = '';
    for (let j = 0; j < 10; j++) c += RECOVERY_ALPHABET[crypto.randomInt(RECOVERY_ALPHABET.length)];
    codes.push(`${c.slice(0, 5)}-${c.slice(5)}`);
  }
  return codes;
}

async function saveRecoveryCodes(userId) {
  const codes = makeRecoveryCodes(8);
  await supabase.from('two_factor_recovery').delete().eq('user_id', userId);
  const { error } = await supabase
    .from('two_factor_recovery')
    .insert(codes.map((c) => ({ user_id: userId, code_hash: hashRecovery(c) })));
  if (error) throw error;
  return codes;
}

async function recoveryLeft(userId) {
  const { count } = await supabase
    .from('two_factor_recovery')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('used_at', null);
  return count || 0;
}

// Accepts either a 6-digit app code or an unused recovery code
async function checkSecondFactor(user, input) {
  const text = String(input || '').trim();
  if (!text) return false;

  if (/^\d{3}\s?\d{3}$/.test(text)) {
    if (!user.totp_secret_enc) return false;
    const step = verifyCode(decrypt(user.totp_secret_enc), text, user.totp_last_step);
    if (step === null) return false;
    // Claim the step. If someone else used it first, this finds no row and the code is refused.
    const { data } = await supabase
      .from('users')
      .update({ totp_last_step: step })
      .eq('id', user.id)
      .or(`totp_last_step.is.null,totp_last_step.lt.${step}`)
      .select('id');
    return !!(data && data.length);
  }

  const { data } = await supabase
    .from('two_factor_recovery')
    .update({ used_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('code_hash', hashRecovery(text))
    .is('used_at', null)
    .select('id');
  return !!(data && data.length);
}

module.exports = {
  isConfigured,
  encrypt,
  decrypt,
  newSecret,
  otpauthUri,
  verifyCode,
  saveRecoveryCodes,
  recoveryLeft,
  checkSecondFactor
};