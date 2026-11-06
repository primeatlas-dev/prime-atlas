const express = require('express');
const supabase = require('../lib/supabase');
const { attachCovers } = require('../lib/media');

const router = express.Router();
const PAGE_SIZE = 12;
const fail = (res, error) => res.status(500).json({ error: error.message });
const isManager = (req) => req.user.role === 'manager';

const LIST_COLUMNS =
  'id, property_title, address, region, price, price_max, bedrooms, bathrooms, car_parking, plot_size, ' +
  'source, approval_status, client_decision, viewed_at, created_at, created_by, brief_id';

const POOL_TEXT = [
  'property_title', 'address', 'region', 'property_type', 'source', 'sourced_from',
  'selling_agent_name', 'selling_agent_phone', 'selling_agent_email'
];
const POOL_NUMBERS = ['price', 'price_max', 'bedrooms', 'bathrooms', 'car_parking', 'plot_size'];
const POOL_INTEGERS = ['bedrooms', 'bathrooms', 'car_parking'];

function parsePoolProperty(body) {
  const input = body || {};
  const out = {};
  const label = (key) => key.replace(/_/g, ' ');

  for (const key of POOL_TEXT) {
    const v = input[key];
    if (typeof v !== 'string') continue;
    const text = v.trim();
    if (text.length > 300) return { error: `The ${label(key)} is too long` };
    if (text) out[key] = text;
  }
  for (const key of POOL_NUMBERS) {
    const v = input[key];
    if (v === undefined || v === null || v === '') continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 1e9) return { error: `Please check the ${label(key)}` };
    out[key] = POOL_INTEGERS.includes(key) ? Math.round(n) : n;
  }
  if (!out.property_title || !out.address) return { error: 'Title and address are required' };
  return { fields: out };
}

// ---------- ALL PROPERTIES (search, filters, pages) ----------
// Managers see everything. Employees see properties in their own briefs plus the shared pool.
router.get('/all-properties', async (req, res) => {
  try {
    const manager = isManager(req);
    let rows = [];
    let briefs = [];
    let clients = [];

    if (manager) {
      const [p, b, c] = await Promise.all([
        supabase.from('properties').select(LIST_COLUMNS).order('created_at', { ascending: false }).limit(2000),
        supabase.from('briefs').select('id, brief_number, title, client_id'),
        supabase.from('clients').select('id, name, client_number')
      ]);
      if (p.error) return fail(res, p.error);
      rows = p.data || [];
      briefs = b.data || [];
      clients = c.data || [];
    } else {
      const { data: mine, error } = await supabase
        .from('briefs')
        .select('id, brief_number, title, client_id')
        .eq('assigned_to', req.user.id)
        .neq('status', 'pending_approval');
      if (error) return fail(res, error);
      briefs = mine || [];

      const briefIds = briefs.map((b) => b.id);
      const clientIds = [...new Set(briefs.map((b) => b.client_id))];
      const empty = Promise.resolve({ data: [] });
      const [inBriefs, pool, c] = await Promise.all([
        briefIds.length
          ? supabase.from('properties').select(LIST_COLUMNS).in('brief_id', briefIds).order('created_at', { ascending: false }).limit(2000)
          : empty,
        supabase.from('properties').select(LIST_COLUMNS).is('brief_id', null).order('created_at', { ascending: false }).limit(2000),
        clientIds.length ? supabase.from('clients').select('id, client_number').in('id', clientIds) : empty
      ]);
      rows = [...(inBriefs.data || []), ...(pool.data || [])].sort((a, b) =>
        b.created_at.localeCompare(a.created_at)
      );
      clients = c.data || [];
    }

    const { search = '', status = 'all', decision = 'all', period = 'all' } = req.query;
    const q = String(search).trim().toLowerCase().slice(0, 100);
    const days = Number(period);
    const since = Number.isFinite(days) && days > 0 ? Date.now() - days * 86400000 : null;

    const list = rows.filter((r) => {
      if (status === 'pool') {
        if (r.brief_id) return false;
      } else if (status !== 'all') {
        if (!r.brief_id || r.approval_status !== status) return false;
      }
      if (decision !== 'all' && (!r.brief_id || r.client_decision !== decision)) return false;
      if (since && new Date(r.created_at).getTime() < since) return false;
      if (q) {
        const haystack = `${r.property_title} ${r.address} ${r.region || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const total = list.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(Math.max(parseInt(req.query.page, 10) || 1, 1), pages);
    const slice = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    let names = {};
    if (manager) {
      const { data: users } = await supabase.from('users').select('id, name');
      names = Object.fromEntries((users || []).map((u) => [u.id, u.name]));
    }

    const briefById = Object.fromEntries(briefs.map((b) => [b.id, b]));
    const clientById = Object.fromEntries(clients.map((c) => [c.id, c]));
    const labelFor = (clientId) => {
      const c = clientById[clientId];
      if (!c) return 'Client';
      return manager ? `${c.name} (Client ${c.client_number})` : `Client ${c.client_number}`;
    };

    const items = slice.map((r) => {
      const b = r.brief_id ? briefById[r.brief_id] : null;
      return {
        id: r.id,
        property_title: r.property_title,
        address: r.address,
        region: r.region,
        price: r.price,
        price_max: r.price_max,
        bedrooms: r.bedrooms,
        bathrooms: r.bathrooms,
        car_parking: r.car_parking,
        plot_size: r.plot_size,
        source: r.source,
        approval_status: r.approval_status,
        client_decision: r.client_decision,
        viewed_at: r.viewed_at,
        created_at: r.created_at,
        in_pool: !r.brief_id,
        brief: b ? { id: b.id, brief_number: b.brief_number, title: b.title, client_label: labelFor(b.client_id) } : null,
        added_by: manager ? names[r.created_by] || null : r.created_by === req.user.id ? 'You' : null
      };
    });

    await attachCovers(items);
    res.json({ items, page, pages, total, page_size: PAGE_SIZE });
  } catch (e) {
    fail(res, e);
  }
});

// ---------- WHICH BRIEFS CAN A PROPERTY BE ASSIGNED TO? ----------
router.get('/assignable-briefs', async (req, res) => {
  try {
    const manager = isManager(req);
    let q = supabase
      .from('briefs')
      .select('id, brief_number, title, client_id')
      .eq('status', 'active')
      .order('brief_number', { ascending: false });
    if (!manager) q = q.eq('assigned_to', req.user.id);
    const { data: briefs, error } = await q;
    if (error) return fail(res, error);
    if (!briefs.length) return res.json([]);

    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, client_number')
      .in('id', [...new Set(briefs.map((b) => b.client_id))]);
    const clientById = Object.fromEntries((clients || []).map((c) => [c.id, c]));

    res.json(
      briefs.map((b) => {
        const c = clientById[b.client_id];
        return {
          id: b.id,
          brief_number: b.brief_number,
          title: b.title,
          client_label: !c ? 'Client' : manager ? `${c.name} (Client ${c.client_number})` : `Client ${c.client_number}`
        };
      })
    );
  } catch (e) {
    fail(res, e);
  }
});

// ---------- ADD A PROPERTY TO THE SHARED POOL ----------
router.post('/pool-properties', async (req, res) => {
  try {
    const parsed = parsePoolProperty(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const { data, error } = await supabase
      .from('properties')
      .insert({
        ...parsed.fields,
        brief_id: null,
        created_by: req.user.id,
        approval_status: 'review'
      })
      .select('id')
      .single();
    if (error) return fail(res, error);
    res.status(201).json(data);
  } catch (e) {
    fail(res, e);
  }
});

module.exports = router;