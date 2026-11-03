const supabase = require('./supabase');

const MANAGER_ONLY = ['seller_confirmed', 'seller_unconfirmed'];

// A problem with the history must never stop the real action
async function logActivity(propertyId, actorId, action, detail) {
  try {
    await supabase.from('property_activity').insert({
      property_id: propertyId,
      actor_id: actorId,
      action,
      detail: detail ? String(detail).slice(0, 500) : null
    });
  } catch (e) {
    // ignore
  }
}

// Logged events plus events that come straight from the property record
async function activityFeed(property, isManager, names) {
  const { data } = await supabase
    .from('property_activity')
    .select('id, actor_id, action, detail, created_at')
    .eq('property_id', property.id)
    .order('created_at', { ascending: false })
    .limit(100);

  const events = (data || [])
    .filter((r) => isManager || !MANAGER_ONLY.includes(r.action))
    .map((r) => ({
      id: r.id,
      who: names[r.actor_id] || 'Team',
      action: r.action,
      detail: r.detail,
      at: r.created_at
    }));

  events.push({
    id: 'created',
    who: names[property.created_by] || 'Team',
    action: 'created',
    detail: null,
    at: property.created_at
  });
  if (property.viewed_at) {
    events.push({ id: 'viewed', who: 'Client', action: 'client_viewed', detail: null, at: property.viewed_at });
  }
  if (property.client_decision && property.client_decision !== 'pending' && property.client_decision_at) {
    events.push({
      id: 'decision',
      who: 'Client',
      action: `client_${property.client_decision}`,
      detail: property.client_comment || null,
      at: property.client_decision_at
    });
  }

  return events.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 60);
}

module.exports = { logActivity, activityFeed };