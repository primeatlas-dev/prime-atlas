const express = require('express');
const supabase = require('../lib/supabase');

const router = express.Router();
const isManager = (req) => req.user.role === 'manager';
const LIMIT = 6;
const has = (text, q) => String(text || '').toLowerCase().includes(q);
const ids = (rows) => (rows || []).map((r) => r.id);

// Staff search. Employees can find a client by NUMBER only, never by name or email,
// so searching can never reveal who a client number belongs to.
router.get('/search', async (req, res) => {
  try {
    const raw = String(req.query.q || '').trim().slice(0, 60);
    if (raw.length < 2) return res.json({ clients: [], briefs: [], properties: [] });

    const q = raw.toLowerCase();
    const manager = isManager(req);
    const digits = q.replace(/^client\s*#?\s*/, '').replace(/^#/, '');
    const wantsNumber = /^\d+$/.test(digits) ? digits : null;
    const newest = { ascending: false };

    let clients = [];
    let briefs = [];
    let properties = [];

    if (manager) {
      const [c, b, p] = await Promise.all([
        supabase.from('clients').select('id, name, email, company_name, client_number').order('created_at', newest).limit(1000),
        supabase.from('briefs').select('id, brief_number, title, client_id, status').order('created_at', newest).limit(1000),
        supabase.from('properties').select('id, property_title, address, region, brief_id').order('created_at', newest).limit(1000)
      ]);
      clients = c.data || [];
      briefs = b.data || [];
      properties = p.data || [];
    } else {
      const { data: mine } = await supabase
        .from('briefs')
        .select('id, brief_number, title, client_id, status')
        .eq('assigned_to', req.user.id)
        .neq('status', 'pending_approval');
      briefs = mine || [];

      const clientIds = [...new Set(briefs.map((b) => b.client_id))];
      const empty = Promise.resolve({ data: [] });
      const [c, inBriefs, pool] = await Promise.all([
        clientIds.length ? supabase.from('clients').select('id, client_number').in('id', clientIds) : empty,
        briefs.length
          ? supabase.from('properties').select('id, property_title, address, region, brief_id').in('brief_id', ids(briefs)).order('created_at', newest).limit(1000)
          : empty,
        supabase.from('properties').select('id, property_title, address, region, brief_id').is('brief_id', null).order('created_at', newest).limit(1000)
      ]);
      clients = c.data || [];
      properties = [...(inBriefs.data || []), ...(pool.data || [])];
    }

    const clientById = Object.fromEntries(clients.map((c) => [c.id, c]));
    const clientLabel = (c) => (manager ? `${c.name} (Client ${c.client_number})` : `Client ${c.client_number}`);

    const matchedClients = clients
      .filter((c) => {
        if (wantsNumber && String(c.client_number) === wantsNumber) return true;
        if (!manager) return false;
        return has(c.name, q) || has(c.email, q) || has(c.company_name, q) || has(`client ${c.client_number}`, q);
      })
      .slice(0, LIMIT)
      .map((c) => ({ id: c.id, label: clientLabel(c) }));

    const matchedBriefs = briefs
      .filter((b) => has(b.title, q) || has(`brief ${b.brief_number}`, q))
      .slice(0, LIMIT)
      .map((b) => ({
        id: b.id,
        label: `Brief #${b.brief_number}${b.title ? ` · ${b.title}` : ''}`,
        sub: clientById[b.client_id] ? clientLabel(clientById[b.client_id]) : '',
        pending: b.status === 'pending_approval'
      }));

    const matchedProps = properties
      .filter((p) => has(p.property_title, q) || has(p.address, q) || has(p.region, q))
      .slice(0, LIMIT)
      .map((p) => ({ id: p.id, label: p.property_title, sub: p.address, in_pool: !p.brief_id }));

    res.json({ clients: matchedClients, briefs: matchedBriefs, properties: matchedProps });
  } catch (e) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;