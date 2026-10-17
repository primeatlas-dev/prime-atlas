const express = require('express');
const supabase = require('../lib/supabase');
const { requireManager } = require('../middleware/auth');

const router = express.Router();

const CLIENT_FIELDS = ['name', 'email', 'phone', 'company_name', 'notes', 'status'];
const BRIEF_FIELDS = [
  'title', 'price_min', 'price_max', 'min_plot_size', 'min_yield', 'bedrooms',
  'bathrooms', 'car_spaces', 'max_property_age', 'property_type',
  'preferred_areas', 'notes', 'due_date'
];
const MANAGER_BRIEF_FIELDS = ['status', 'assigned_to', 'commission_amount', 'fee_status'];

function pick(body, fields) {
  const out = {};
  for (const f of fields) {
    if (body[f] !== undefined) out[f] = body[f] === '' ? null : body[f];
  }
  return out;
}

const fail = (res, error) => res.status(500).json({ error: error.message });
const isManager = (req) => req.user.role === 'manager';

// Employees never see money or approval details
function hideManagerFields(brief) {
  const { commission_amount, fee_status, fee_paid_at, approved_by, approved_at, ...rest } = brief;
  return rest;
}

// ---------- CLIENTS ----------
router.get('/clients', async (req, res) => {
  if (isManager(req)) {
    const { data, error } = await supabase
      .from('clients')
      .select('*, briefs(id, status)')
      .order('client_number');
    if (error) return fail(res, error);
    return res.json(data.map(({ briefs, ...c }) => ({
      ...c,
      active_briefs: briefs.filter(b => b.status === 'active').length
    })));
  }

  // Employees: only clients that have a brief assigned to them, shown as a number
  const { data: mine, error } = await supabase
    .from('briefs')
    .select('client_id, status')
    .eq('assigned_to', req.user.id);
  if (error) return fail(res, error);

  const ids = [...new Set(mine.map(b => b.client_id))];
  if (ids.length === 0) return res.json([]);

  const { data: clients, error: e2 } = await supabase
    .from('clients')
    .select('id, client_number')
    .in('id', ids)
    .order('client_number');
  if (e2) return fail(res, e2);

  res.json(clients.map(c => ({
    id: c.id,
    client_number: c.client_number,
    name: `Client ${c.client_number}`,
    active_briefs: mine.filter(b => b.client_id === c.id && b.status === 'active').length
  })));
});

router.post('/clients', requireManager, async (req, res) => {
  const fields = pick(req.body, CLIENT_FIELDS);
  if (!fields.name) return res.status(400).json({ error: 'Client name is required' });
  const { data, error } = await supabase.from('clients').insert(fields).select().single();
  if (error) return fail(res, error);
  res.status(201).json(data);
});

router.get('/clients/:id', async (req, res) => {
  const { data: client, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (error || !client) return res.status(404).json({ error: 'Client not found' });

  let query = supabase
    .from('briefs')
    .select('*')
    .eq('client_id', client.id)
    .order('created_at', { ascending: false });
  if (!isManager(req)) query = query.eq('assigned_to', req.user.id);

  const { data: briefs, error: e2 } = await query;
  if (e2) return fail(res, e2);

  if (!isManager(req)) {
    if (briefs.length === 0) return res.status(404).json({ error: 'Client not found' });
    return res.json({
      client: {
        id: client.id,
        client_number: client.client_number,
        name: `Client ${client.client_number}`
      },
      briefs: briefs.map(hideManagerFields)
    });
  }

  const { data: team } = await supabase.from('users').select('id, name');
  const names = Object.fromEntries((team || []).map(u => [u.id, u.name]));
  res.json({
    client,
    briefs: briefs.map(b => ({ ...b, assigned_name: names[b.assigned_to] || null }))
  });
});

// ---------- BRIEFS ----------
router.post('/briefs', requireManager, async (req, res) => {
  if (!req.body.client_id) return res.status(400).json({ error: 'client_id is required' });

  const fields = pick(req.body, [...BRIEF_FIELDS, 'assigned_to', 'commission_amount']);
  const { data, error } = await supabase
    .from('briefs')
    .insert({
      ...fields,
      client_id: req.body.client_id,
      status: 'active',
      approved_by: req.user.id,
      approved_at: new Date().toISOString()
    })
    .select()
    .single();
  if (error) return fail(res, error);
  res.status(201).json(data);
});

router.patch('/briefs/:id', requireManager, async (req, res) => {
  const fields = pick(req.body, [...BRIEF_FIELDS, ...MANAGER_BRIEF_FIELDS]);
  if (fields.fee_status === 'paid') fields.fee_paid_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('briefs')
    .update(fields)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return fail(res, error);
  res.json(data);
});

module.exports = router;