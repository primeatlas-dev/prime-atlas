const jwt = require('jsonwebtoken');
const supabase = require('../lib/supabase');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not logged in' });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Check the database on every request, so deactivated users are locked out immediately
  const { data: user } = await supabase
    .from('users')
    .select('id, email, name, role, active')
    .eq('id', payload.id)
    .single();

  if (!user || !user.active) {
    return res.status(401).json({ error: 'Account not active' });
  }

  req.user = user;
  next();
}

function requireManager(req, res, next) {
  if (req.user?.role !== 'manager') {
    return res.status(403).json({ error: 'Managers only' });
  }
  next();
}

// Managers and employees only. Client accounts are blocked.
function requireStaff(req, res, next) {
  if (!['manager', 'employee'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'Staff only' });
  }
  next();
}

// Client accounts only (used by the client portal later)
function requireClient(req, res, next) {
  if (req.user?.role !== 'client') {
    return res.status(403).json({ error: 'Clients only' });
  }
  next();
}

module.exports = requireAuth;
module.exports.requireManager = requireManager;
module.exports.requireStaff = requireStaff;
module.exports.requireClient = requireClient;