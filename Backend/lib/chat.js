const crypto = require('crypto');
const supabase = require('./supabase');
const { BUCKET, signPaths } = require('./media');

const MAX_LENGTH = 2000;
const PLACEHOLDER = '📎 Attachment';
const FILE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf'
};
const MAX_BYTES = 10 * 1024 * 1024;

// How each message is labelled depends on who is reading:
//  - clients only ever see "Prime Atlas Team" for staff messages
//  - employees see "Client N" for client messages
//  - the manager sees the client's real name
// Original file names are never sent, so a file name can't reveal who someone is.
async function fetchThread(propertyId, viewer, clientLabel) {
  const { data, error } = await supabase
    .from('messages')
    .select('id, sender_id, sender_role, body, attachment_path, attachment_type, created_at')
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

  const urls = await signPaths(rows.map((m) => m.attachment_path));

  return rows.map((m) => {
    const mine = m.sender_id === viewer.id;
    let from;
    if (mine) from = 'You';
    else if (viewer.role === 'client') from = 'Prime Atlas Team';
    else if (m.sender_role === 'client') from = clientLabel;
    else from = names[m.sender_id] || 'Team';
    // Never send sender ids to the browser
    return {
      id: m.id,
      mine,
      from,
      body: m.attachment_path && m.body === PLACEHOLDER ? '' : m.body,
      attachment:
        m.attachment_path && urls[m.attachment_path]
          ? { url: urls[m.attachment_path], type: m.attachment_type }
          : null,
      created_at: m.created_at
    };
  });
}

// A one-time link so the browser can upload a chat file straight to private storage
async function chatUploadUrl(propertyId, contentType, size) {
  if (!FILE_TYPES[contentType]) {
    return { error: 'Only photos (JPG, PNG, WebP, GIF) and PDFs can be sent in chat' };
  }
  if (!size || size > MAX_BYTES) return { error: 'Files must be under 10 MB' };

  const path = `chat/${propertyId}/${crypto.randomUUID()}.${FILE_TYPES[contentType]}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) throw error;
  return { path: data.path, token: data.token };
}

async function addMessage(viewer, propertyId, body, attachment) {
  const text = String(body || '').trim();

  let file = null;
  if (attachment) {
    const path = String(attachment.path || '');
    const type = String(attachment.type || '');
    if (!path.startsWith(`chat/${propertyId}/`) || path.includes('..') || !FILE_TYPES[type]) {
      return { error: 'That attachment is not allowed' };
    }
    file = { path, type };
  }

  if (!text && !file) return { error: 'Write a message first' };
  if (text.length > MAX_LENGTH) {
    return { error: `Messages can be up to ${MAX_LENGTH} characters` };
  }

  const { error } = await supabase.from('messages').insert({
    property_id: propertyId,
    sender_id: viewer.id,
    sender_role: viewer.role,
    body: text || PLACEHOLDER,
    attachment_path: file ? file.path : null,
    attachment_type: file ? file.type : null
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

module.exports = { fetchThread, addMessage, markRead, summarise, chatUploadUrl };