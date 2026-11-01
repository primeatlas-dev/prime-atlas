const express = require('express');
const supabase = require('../lib/supabase');
const { requireManager } = require('../middleware/auth');
const { attachCovers } = require('../lib/media');

const router = express.Router();

const PROPERTY_FIELDS = [
  'property_title', 'address', 'region', 'property_type', 'price', 'price_max',
  'valuation', 'bedrooms', 'bathrooms', 'car_parking', 'plot_size', 'built_year',
  'condition', 'source', 'sourced_from', 'selling_agent_name',
  'selling_agent_phone', 'selling_agent_email'
];

function pick(body, fields) {
  const out = {};
  for (const f of fields) {
    if (body[f] !== undefined) out[f] = body[f] === '' ? null : body[f];
  }
  return out;
}

const fail = (res, error) => res.status(500).json({ error: error.message });
const isManager = (req) => req.user.role === 'manager';

// Managers can open any brief. Employees only briefs assigned to them that are not pending approval.
async function loadBrief(req, id) {
  const { data: brief } = await supabase.from('briefs').select('*').eq('id', id).single();
  if (!brief) return null;
  if (!isManager(req) && (brief.assigned_to !== req.user.id || brief.status === 'pending_approval')) {
    return null;
  }
  return brief;
}

// ---------- BRIEF PAGE: brief + client + its properties ----------
router.get('/briefs/:id', async (req, res) => {
  const brief = await loadBrief(req, req.params.id);
  if (!brief) return res.status(404).json({ error: 'Brief not found' });

  const [clientRes, propsRes, usersRes] = await Promise.all([
    supabase.from('clients').select('*').eq('id', brief.client_id).single(),
    supabase
      .from('properties')
      .select('*, property_photos(photo_url)')
      .eq('brief_id', brief.id)
      .order('created_at', { ascending: false }),
    supabase.from('users').select('id, name')
  ]);
  if (propsRes.error) return fail(res, propsRes.error);
  await attachCovers(propsRes.data);

  const names = Object.fromEntries((usersRes.data || []).map((u) => [u.id, u.name]));
  const client = clientRes.data;

  const properties = propsRes.data.map((p) => {
    const { client_confirmed_at, seller_confirmed_at, ...safe } = p;
    const base = isManager(req) ? p : safe;
    return {
      ...base,
      created_by_name: names[p.created_by] || null,
      approved_by_name: names[p.approved_by] || null
    };
  });

  if (!isManager(req)) {
    const {
      commission_amount, fee_status, fee_paid_at, approved_by, approved_at,
      submitted_by_client, submitted_at, ...safeBrief
    } = brief;
    return res.json({
      brief: safeBrief,
      client: {
        id: client.id,
        client_number: client.client_number,
        name: `Client ${client.client_number}`
      },
      properties
    });
  }

  res.json({
    brief: { ...brief, assigned_name: names[brief.assigned_to] || null },
    client,
    properties
  });
});

// ---------- ADD A PROPERTY TO A BRIEF ----------
router.post('/briefs/:id/properties', async (req, res) => {
  const brief = await loadBrief(req, req.params.id);
  if (!brief) return res.status(404).json({ error: 'Brief not found' });
  if (brief.status === 'pending_approval') {
    return res.status(400).json({ error: 'Approve the brief before adding properties to it' });
  }

  const fields = pick(req.body, PROPERTY_FIELDS);
  if (!fields.property_title || !fields.address) {
    return res.status(400).json({ error: 'Title and address are required' });
  }

  const { data, error } = await supabase
    .from('properties')
    .insert({
      ...fields,
      brief_id: brief.id,
      created_by: req.user.id,
      approval_status: 'review'
    })
    .select()
    .single();
  if (error) return fail(res, error);
  res.status(201).json(data);
});

// ---------- MANAGER: APPROVE / REJECT / BACK TO REVIEW ----------
router.post('/properties/:id/decision', requireManager, async (req, res) => {
  const { data: property } = await supabase
    .from('properties')
    .select('id, brief_id')
    .eq('id', req.params.id)
    .maybeSingle();
  if (!property) return res.status(404).json({ error: 'Property not found' });

  if (req.body.action === 'approve' && !property.brief_id) {
    return res.status(400).json({ error: 'Assign this property to a brief before approving it' });
  }

  const updates = {
    approve: {
      approval_status: 'approved',
      approved_by: req.user.id,
      approved_at: new Date().toISOString()
    },
    reject: { approval_status: 'rejected', approved_by: null, approved_at: null },
    review: { approval_status: 'review', approved_by: null, approved_at: null }
  }[req.body.action];
  if (!updates) return res.status(400).json({ error: 'Unknown action' });

  const { data, error } = await supabase
    .from('properties')
    .update(updates)
    .eq('id', property.id)
    .select()
    .single();
  if (error) return fail(res, error);
  res.json(data);
});

module.exports = router;