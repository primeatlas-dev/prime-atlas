const express = require('express');
const supabase = require('../lib/supabase');
const { fetchThread, addMessage, markRead } = require('../lib/chat');

const router = express.Router();
const fail = (res, error) => res.status(500).json({ error: error.message });
const TEAM = 'Prime Atlas Team';

// A client can only reach chats on approved properties inside their own searches
async function clientAccess(req, propertyId) {
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('user_id', req.user.id)
    .single();
  if (!client) return null;

  const { data: property } = await supabase
    .from('properties')
    .select('id, brief_id')
    .eq('id', propertyId)
    .eq('approval_status', 'approved')
    .single();
  if (!property) return null;

  const { data: brief } = await supabase
    .from('briefs')
    .select('id')
    .eq('id', property.brief_id)
    .eq('client_id', client.id)
    .neq('status', 'pending_approval')
    .single();
  return brief ? { property } : null;
}

router.get('/properties/:id/chat', async (req, res) => {
  try {
    const access = await clientAccess(req, req.params.id);
    if (!access) return res.status(404).json({ error: 'Chat not found' });

    const messages = await fetchThread(access.property.id, req.user, TEAM);
    if (messages.length) {
      await markRead(req.user.id, access.property.id, messages[messages.length - 1].created_at);
    }
    res.json({ chat_with: TEAM, messages });
  } catch (e) {
    fail(res, e);
  }
});

router.post('/properties/:id/chat', async (req, res) => {
  try {
    const access = await clientAccess(req, req.params.id);
    if (!access) return res.status(404).json({ error: 'Chat not found' });

    const result = await addMessage(req.user, access.property.id, req.body.body);
    if (result.error) return res.status(400).json({ error: result.error });
    res.status(201).json({ ok: true });
  } catch (e) {
    fail(res, e);
  }
});

module.exports = router;