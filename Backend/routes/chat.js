const express = require('express');
const supabase = require('../lib/supabase');
const { fetchThread, addMessage, markRead, summarise } = require('../lib/chat');

const router = express.Router();
const fail = (res, error) => res.status(500).json({ error: error.message });
const isManager = (req) => req.user.role === 'manager';

const NOT_OPEN = 'Chat opens once the manager approves the property';

// Managers can open any chat. Employees only chats in briefs assigned to them.
async function staffAccess(req, propertyId) {
  const { data: property } = await supabase
    .from('properties')
    .select('id, property_title, brief_id, approval_status')
    .eq('id', propertyId)
    .single();
  if (!property || !property.brief_id) return null;

  const { data: brief } = await supabase
    .from('briefs')
    .select('id, client_id, assigned_to, status')
    .eq('id', property.brief_id)
    .single();
  if (!brief || brief.status === 'pending_approval') return null;
  if (!isManager(req) && brief.assigned_to !== req.user.id) return null;

  const { data: client } = await supabase
    .from('clients')
    .select('name, client_number')
    .eq('id', brief.client_id)
    .single();
  if (!client) return null;

  const clientLabel = isManager(req)
    ? `${client.name} (Client ${client.client_number})`
    : `Client ${client.client_number}`;
  return { property, clientLabel };
}

// ---------- LIST OF CHATS (approved properties only) ----------
router.get('/chats', async (req, res) => {
  try {
    let briefQuery = supabase
      .from('briefs')
      .select('id, brief_number, client_id')
      .neq('status', 'pending_approval');
    if (!isManager(req)) briefQuery = briefQuery.eq('assigned_to', req.user.id);
    const { data: briefs, error } = await briefQuery;
    if (error) return fail(res, error);
    if (!briefs.length) return res.json([]);

    const { data: props, error: propError } = await supabase
      .from('properties')
      .select('id, property_title, address, brief_id')
      .in('brief_id', briefs.map((b) => b.id))
      .eq('approval_status', 'approved');
    if (propError) return fail(res, propError);
    if (!props.length) return res.json([]);

    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, client_number')
      .in('id', [...new Set(briefs.map((b) => b.client_id))]);

    const briefById = Object.fromEntries(briefs.map((b) => [b.id, b]));
    const clientById = Object.fromEntries((clients || []).map((c) => [c.id, c]));
    const summary = await summarise(req.user, props.map((p) => p.id));

    const rows = props.map((p) => {
      const brief = briefById[p.brief_id];
      const client = clientById[brief.client_id];
      const s = summary[p.id] || {};
      return {
        property_id: p.id,
        property_title: p.property_title,
        address: p.address,
        brief_number: brief.brief_number,
        client_label: isManager(req)
          ? `${client.name} (Client ${client.client_number})`
          : `Client ${client.client_number}`,
        last_message: s.last_message ? s.last_message.slice(0, 80) : null,
        last_at: s.last_at || null,
        unread: s.unread || 0
      };
    });

    rows.sort(
      (a, b) => b.unread - a.unread || String(b.last_at || '').localeCompare(String(a.last_at || ''))
    );
    res.json(rows);
  } catch (e) {
    fail(res, e);
  }
});

// ---------- ONE CHAT ----------
router.get('/properties/:id/chat', async (req, res) => {
  try {
    const access = await staffAccess(req, req.params.id);
    if (!access) return res.status(404).json({ error: 'Chat not found' });
    if (access.property.approval_status !== 'approved') {
      return res.status(403).json({ error: NOT_OPEN });
    }

    const messages = await fetchThread(access.property.id, req.user, access.clientLabel);
    if (messages.length) {
      await markRead(req.user.id, access.property.id, messages[messages.length - 1].created_at);
    }
    res.json({ chat_with: access.clientLabel, messages });
  } catch (e) {
    fail(res, e);
  }
});

router.post('/properties/:id/chat', async (req, res) => {
  try {
    const access = await staffAccess(req, req.params.id);
    if (!access) return res.status(404).json({ error: 'Chat not found' });
    if (access.property.approval_status !== 'approved') {
      return res.status(403).json({ error: NOT_OPEN });
    }

    const result = await addMessage(req.user, access.property.id, req.body.body);
    if (result.error) return res.status(400).json({ error: result.error });
    res.status(201).json({ ok: true });
  } catch (e) {
    fail(res, e);
  }
});

module.exports = router;