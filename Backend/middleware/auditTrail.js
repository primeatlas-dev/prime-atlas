const { logAudit } = require('../lib/audit');

const ID = '([0-9a-fA-F-]{36})';
const match = (pattern, path) => path.match(new RegExp(`^${pattern}/?$`));
const clientIp = (req) =>
  String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '')
    .split(',')[0]
    .trim()
    .slice(0, 64);

// Works out whether this request is something worth recording. Never records passwords.
function describeRequest(method, path, req, status) {
  const body = req.body || {};
  let m;

  if (status === 429 && method === 'POST' && path === '/auth/login') {
    return { action: 'login_locked', detail: String(body.email || '').slice(0, 100) };
  }
  if (status >= 400) return null;

  if (method === 'GET' && (m = match(`/clients/${ID}/export`, path))) {
    return { action: 'client_data_exported', target_type: 'client', target_id: m[1] };
  }
  if (method === 'DELETE' && (m = match(`/clients/${ID}`, path))) {
    return {
      action: 'client_deleted',
      target_type: 'client',
      target_id: m[1],
      detail: `Name typed to confirm: ${String(body.confirm_name || '').slice(0, 100)}`
    };
  }
  if (method === 'POST' && (m = match(`/clients/${ID}/login`, path))) {
    return { action: 'client_login_created', target_type: 'client', target_id: m[1], detail: String(body.email || '').slice(0, 100) };
  }
  if (method === 'PATCH' && (m = match(`/clients/${ID}/login`, path))) {
    if (body.password !== undefined) return { action: 'client_password_reset', target_type: 'client', target_id: m[1] };
    if (body.active !== undefined) {
      return { action: body.active ? 'client_access_on' : 'client_access_off', target_type: 'client', target_id: m[1] };
    }
    return null;
  }
  if (method === 'POST' && path.replace(/\/$/, '') === '/team') {
    return { action: 'employee_created', detail: String(body.email || '').slice(0, 100) };
  }
  if (method === 'PATCH' && (m = match(`/team/${ID}`, path))) {
    if (body.password !== undefined) return { action: 'employee_password_reset', target_type: 'employee', target_id: m[1] };
    if (body.active !== undefined) {
      return { action: body.active ? 'employee_activated' : 'employee_deactivated', target_type: 'employee', target_id: m[1] };
    }
    return null;
  }
  if (method === 'POST' && path === '/account/password') {
    return { action: 'password_changed', target_type: 'account', target_id: req.user ? req.user.id : null };
  }
  if (method === 'POST' && (m = match(`/briefs/${ID}/approve`, path))) {
    return { action: 'brief_approved', target_type: 'brief', target_id: m[1] };
  }
  if (method === 'POST' && (m = match(`/briefs/${ID}/decline`, path))) {
    return { action: 'brief_declined', target_type: 'brief', target_id: m[1] };
  }
  if (method === 'POST' && (m = match(`/briefs/${ID}/fee`, path))) {
    if (body.action === 'mark_paid') return { action: 'fee_marked_paid', target_type: 'brief', target_id: m[1] };
    if (body.action === 'undo_paid') return { action: 'fee_undo_paid', target_type: 'brief', target_id: m[1] };
    return null;
  }
  if (method === 'POST' && (m = match(`/properties/${ID}/seller-confirmation`, path))) {
    return {
      action: body.confirmed === false ? 'seller_unconfirmed' : 'seller_confirmed',
      target_type: 'property',
      target_id: m[1]
    };
  }
  if (method === 'GET' && (m = match('/export/(briefs|properties)', path))) {
    return { action: 'data_exported', detail: m[1] };
  }
  return null;
}

// The record is saved BEFORE the reply is sent. Vercel can freeze a function as soon as it
// replies, so saving afterwards could silently lose entries.
module.exports = function auditTrail(req, res, next) {
  const method = req.method;
  const path = req.path;
  const original = res.json.bind(res);

  res.json = function (payload) {
    let entry = null;
    try {
      entry = describeRequest(method, path, req, res.statusCode);
    } catch (e) {
      entry = null;
    }
    if (!entry) return original(payload);

    logAudit({ ...entry, actor_id: req.user ? req.user.id : null, ip: clientIp(req) }).then(() =>
      original(payload)
    );
    return res;
  };
  next();
};