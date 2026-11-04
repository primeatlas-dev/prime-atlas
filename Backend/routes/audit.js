const express = require('express');
const supabase = require('../lib/supabase');
const { requireManager } = require('../middleware/auth');

const router = express.Router();
const PAGE_SIZE = 50;
const unique = (list) => [...new Set(list.filter(Boolean))];

// ---------- AUDIT LOG (manager only) ----------
router.get('/audit', requireManager, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const { data, count, error } = await supabase
      .from('audit_log')
      .select('id, actor_id, action, target_type, target_id, detail, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (error) return res.status(500).json({ error: error.message });

    const of = (type) => unique(data.filter((r) => r.target_type === type).map((r) => r.target_id));
    const personIds = unique([...data.map((r) => r.actor_id), ...of('employee'), ...of('account')]);
    const clientIds = of('client');
    const briefIds = of('brief');
    const propertyIds = of('property');
    const empty = Promise.resolve({ data: [] });

    const [users, clients, briefs, properties] = await Promise.all([
      personIds.length ? supabase.from('users').select('id, name').in('id', personIds) : empty,
      clientIds.length ? supabase.from('clients').select('id, name, client_number').in('id', clientIds) : empty,
      briefIds.length ? supabase.from('briefs').select('id, brief_number, title').in('id', briefIds) : empty,
      propertyIds.length ? supabase.from('properties').select('id, property_title').in('id', propertyIds) : empty
    ]);

    const byId = (res2) => Object.fromEntries((res2.data || []).map((x) => [x.id, x]));
    const U = byId(users);
    const C = byId(clients);
    const B = byId(briefs);
    const P = byId(properties);

    const labelFor = (r) => {
      if (!r.target_type) return null;
      if (r.target_type === 'client') return C[r.target_id] ? `${C[r.target_id].name} (Client ${C[r.target_id].client_number})` : 'Deleted client';
      if (r.target_type === 'brief') return B[r.target_id] ? `Brief #${B[r.target_id].brief_number}${B[r.target_id].title ? ` · ${B[r.target_id].title}` : ''}` : 'Deleted brief';
      if (r.target_type === 'property') return P[r.target_id] ? P[r.target_id].property_title : 'Deleted property';
      return U[r.target_id] ? U[r.target_id].name : 'Unknown person';
    };

    res.json({
      page,
      pages: Math.max(1, Math.ceil((count || 0) / PAGE_SIZE)),
      total: count || 0,
      rows: data.map((r) => ({
        id: r.id,
        action: r.action,
        actor_name: r.actor_id ? (U[r.actor_id] ? U[r.actor_id].name : 'Unknown person') : null,
        target_label: labelFor(r),
        detail: r.detail,
        at: r.created_at
      }))
    });
  } catch (e) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;