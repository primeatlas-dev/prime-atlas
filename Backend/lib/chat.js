const supabase = require('./supabase');

const MAX_LENGTH = 2000;

// How each message is labelled depends on who is reading:
//  - clients only ever see "Prime Atlas Team" for staff messages
//  - employees see "Client N" for client messages
//  - the manager sees the client's real name
async function fetchThread(propertyId, viewer, clientLabel) {
  const { data, error } = await supabase
    .from('messages')
    .select('id, sender_id, sender_role, body, created_at')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) throw error;
  const rows = data.reverse();

  let names = {};
  if (viewer.role !== 'client') {
    const ids = [...new Set(rows.map((m) => m.sender_id))];
    if (ids.length) {
      const { data: users } = await supabase.from('users').select('id, name').in('id', ids);
      names = Object.fromEntries((users || []).map((u) => [u.id, u.name]));
    }
  }

  return rows.map((m) => {
    const mine = m.sender_id === viewer.id;
    let from;
    if (mine) from = 'You';
    else if (viewer.role === 'client') from = 'Prime Atlas Team';
    else if (m.sender_role === 'client') from = clientLabel;
    else from = names[m.sender_id] || 'Team';
    // Never send sender ids to the browser
    return { id: m.id, mine, from, body: m.body, created_at: m.created_at };
  });
}

async function addMessage(viewer, propertyId, body) {
  const text = String(body || '').trim();
  if (!text) return { error: 'Write a message first' };
  if (text.length > MAX_LENGTH) {
    return { error: `Messages can be up to ${MAX_LENGTH} characters` };
  }
  const { error } = await supabase.from('messages').insert({
    property_id: propertyId,
    sender_id: viewer.id,
    sender_role: viewer.role,
    body: text
  });
  if (error) throw error;
  return {};
}

// "upTo" is the created_at of the newest message the person has now seen
async function markRead(userId, propertyId, upTo) {
  await supabase
    .from('chat_reads')
    .upsert(
      { user_id: userId, property_id: propertyId, last_read_at: upTo },
      { onConflict: 'user_id,property_id' }
    );
}

// Last message and unread count for a list of properties
async function summarise(viewer, propertyIds) {
  if (!propertyIds.length) return {};
  const [msgs, reads] = await Promise.all([
    supabase
      .from('messages')
      .select('property_id, sender_id, body, created_at')
      .in('property_id', propertyIds)
      .order('created_at', { ascending: false })
      .limit(3000),
    supabase
      .from('chat_reads')
      .select('property_id, last_read_at')
      .eq('user_id', viewer.id)
      .in('property_id', propertyIds)
  ]);

  const readAt = Object.fromEntries((reads.data || []).map((r) => [r.property_id, r.last_read_at]));
  const out = {};
  (msgs.data || []).forEach((m) => {
    if (!out[m.property_id]) {
      out[m.property_id] = { last_message: m.body, last_at: m.created_at, unread: 0 };
    }
    const seen = readAt[m.property_id];
    if (m.sender_id !== viewer.id && (!seen || new Date(m.created_at) > new Date(seen))) {
      out[m.property_id].unread += 1;
    }
  });
  return out;
}

module.exports = { fetchThread, addMessage, markRead, summarise };