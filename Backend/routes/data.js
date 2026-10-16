const express = require('express');
const supabase = require('../lib/supabase');
const { requireManager } = require('../middleware/auth');

const router = express.Router();

const PROPERTY_FIELDS = [
  'property_title', 'address', 'region', 'property_type', 'bedrooms',
  'bathrooms', 'car_parking', 'plot_size', 'price', 'valuation',
  'built_year', 'condition', 'source', 'sourced_from', 'deal_status'
];

const AGENT_FIELDS = [
  'name', 'email', 'phone', 'company_name',
  'commission_percentage', 'min_price', 'max_price', 'status'
];

// Keeps only allowed fields and turns empty strings into null
function pick(body, fields) {
  const out = {};
  for (const f of fields) {
    if (body[f] !== undefined) out[f] = body[f] === '' ? null : body[f];
  }
  return out;
}

const fail = (res, error) => res.status(500).json({ error: error.message });

// Turns a deal with nested property/agent info into the flat shape the frontend expects
function flattenDeal(d) {
  const { properties, buying_agents, ...rest } = d;
  return {
    ...rest,
    property_title: properties?.property_title,
    price: properties?.price,
    agent_name: buying_agents?.name,
    agent_email: buying_agents?.email
  };
}

function countBy(rows, key) {
  const counts = {};
  rows.forEach(r => {
    const k = r[key] || 'Unknown';
    counts[k] = (counts[k] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([value, count]) => ({ [key]: value, count }))
    .sort((a, b) => b.count - a.count);
}

// ---------- DASHBOARD ----------
router.get('/dashboard/summary', async (req, res) => {
  const [props, deals] = await Promise.all([
    supabase.from('properties').select('deal_status, region'),
    supabase.from('deals').select('deal_status, agreed_commission')
  ]);
  if (props.error) return fail(res, props.error);
  if (deals.error) return fail(res, deals.error);

  const closed = deals.data.filter(d => d.deal_status === 'closed');
  const inProgress = deals.data.filter(d =>
    ['pitched', 'interested', 'negotiating'].includes(d.deal_status)
  );

  res.json({
    total_properties_sourced: props.data.length,
    total_deals_closed: closed.length,
    deals_in_progress: inProgress.length,
    total_commission_earned: closed.reduce((sum, d) => sum + Number(d.agreed_commission || 0), 0),
    properties_by_status: countBy(props.data, 'deal_status'),
    properties_by_region: countBy(props.data, 'region')
  });
});

// ---------- PROPERTIES ----------
router.get('/properties', async (req, res) => {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return fail(res, error);
  res.json(data);
});

router.post('/properties', async (req, res) => {
  const { data, error } = await supabase
    .from('properties')
    .insert(pick(req.body, PROPERTY_FIELDS))
    .select()
    .single();
  if (error) return fail(res, error);
  res.status(201).json(data);
});

router.get('/properties/:id', async (req, res) => {
  const id = req.params.id;
  const [prop, photos, deals] = await Promise.all([
    supabase.from('properties').select('*').eq('id', id).single(),
    supabase.from('property_photos').select('*').eq('property_id', id),
    supabase.from('deals').select('*, buying_agents(name, email)').eq('property_id', id)
  ]);
  if (prop.error) return res.status(404).json({ error: 'Property not found' });

  res.json({
    ...prop.data,
    photos: photos.data || [],
        deals: req.user.role === 'manager' ? (deals.data || []).map(flattenDeal) : []
  });
});

// ---------- BUYING AGENTS ----------
router.get('/buying-agents', async (req, res) => {
  const { data, error } = await supabase
    .from('buying_agents')
    .select('*')
    .order('client_number');
  if (error) return fail(res, error);

  if (req.user.role === 'manager') return res.json(data);

  // Employees only ever see the client number
  res.json(data.map(a => ({
    id: a.id,
    client_number: a.client_number,
    name: `Client ${a.client_number}`,
    status: a.status,
    min_price: a.min_price,
    max_price: a.max_price
  })));
});

router.post('/buying-agents', requireManager, async (req, res) => {
  const { data, error } = await supabase
    .from('buying_agents')
    .insert(pick(req.body, AGENT_FIELDS))
    .select()
    .single();
  if (error) return fail(res, error);
  res.status(201).json(data);
});

router.get('/buying-agents/:id/communications', async (req, res) => {
  const { data, error } = await supabase
    .from('communications')
    .select('*')
    .eq('agent_id', req.params.id)
    .order('created_at', { ascending: true });
  if (error) return fail(res, error);
  res.json(data);
});

// ---------- DEALS ----------
router.get('/deals', async (req, res) => {
  let query = supabase
    .from('deals')
    .select('*, properties(property_title, price), buying_agents(name, email)')
    .order('created_at', { ascending: false });

  if (req.query.status) query = query.eq('deal_status', req.query.status);
  if (req.query.agentId) query = query.eq('agent_id', req.query.agentId);

  const { data, error } = await query;
  if (error) return fail(res, error);
  res.json(data.map(flattenDeal));
});

module.exports = router;