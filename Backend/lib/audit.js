const supabase = require('./supabase');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A problem with the audit log must never stop the real action
async function logAudit(entry) {
  try {
    await supabase.from('audit_log').insert({
      actor_id: entry.actor_id || null,
      action: entry.action,
      target_type: entry.target_type || null,
      target_id: UUID.test(String(entry.target_id || '')) ? entry.target_id : null,
      detail: entry.detail ? String(entry.detail).slice(0, 300) : null,
      ip: entry.ip || null
    });
  } catch (e) {
    // ignore
  }
}

module.exports = { logAudit };