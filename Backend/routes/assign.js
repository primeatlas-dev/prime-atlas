const express = require('express');
const supabase = require('../lib/supabase');
const { logActivity } = require('../lib/activity');

const router = express.Router();
const fail = (res, error) => res.status(500).json({ error: error.message });
const isManager = (req) => req.user.role === 'manager';

router.post('/properties/:id/assign', async (req, res) => {
  try {
    const { data: property } = await supabase
      .from('properties')
      .select('id, brief_id')
      .eq('id', req.params.id)
      .maybeSingle();
    if (!property) return res.status(404).json({ error: 'Property not found' });
    if (property.brief_id) {
      return res.status(400).json({ error: 'This property already belongs to a brief' });
    }

    const briefId = req.body.brief_id;
    if (!briefId) return res.status(400).json({ error: 'Choose a brief' });

    const { data: brief } = await supabase
      .from('briefs')
      .select('id, brief_number, status, assigned_to')
      .eq('id', briefId)
      .maybeSingle();
    if (!brief) return res.status(404).json({ error: 'Brief not found' });
    if (!isManager(req) && brief.assigned_to !== req.user.id) {
      return res.status(404).json({ error: 'Brief not found' });
    }
    if (brief.status !== 'active') {
      return res.status(400).json({ error: 'Choose an active brief' });
    }

    // Joining a brief always starts again at Review, so the manager approves it for this client
    const { error } = await supabase
      .from('properties')
      .update({
        brief_id: brief.id,
        approval_status: 'review',
        approved_by: null,
        approved_at: null,
        client_decision: 'pending',
        client_decision_at: null,
        client_comment: null,
        viewed_at: null,
        client_confirmed_at: null,
        seller_confirmed_at: null
      })
      .eq('id', property.id)
      .is('brief_id', null);
    if (error) return fail(res, error);

    await logActivity(property.id, req.user.id, 'assigned', `Added to Brief #${brief.brief_number}`);
    res.json({ ok: true });
  } catch (e) {
    fail(res, e);
  }
});

module.exports = router;