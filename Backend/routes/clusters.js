const express = require('express');
const supabase = require('../lib/supabase');

const router = express.Router();
const fail = (res, error) => res.status(500).json({ error: error.message });
const isManager = (req) => req.user.role === 'manager';
const LEVELS = ['high', 'medium', 'low'];
const RANK = { high: 0, medium: 1, low: 2 };
const LOCKED = 'Clusters are finalised. Ask the manager to reopen them.';
const SUBURB_COLUMNS =
  'id, suburb, suitability, sold_last_3m, on_market_count, overlay_over_75, median_price, median_yield';

// Managers can use any brief. Employees only briefs assigned to them.
async function loadBrief(req, id) {
  const { data: brief } = await supabase
    .from('briefs')
    .select('id, assigned_to, clusters_status')
    .eq('id', id)
    .single();
  if (!brief) return null;
  if (!isManager(req) && brief.assigned_to !== req.user.id) return null;
  return brief;
}

// Once finalised, only the manager can change clusters
const canEdit = (req, brief) => isManager(req) || brief.clusters_status !== 'final';

// Empty -> null. Invalid -> undefined.
function num(value, { integer = false, max = 1e9 } = {}) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > max) return undefined;
  return integer ? Math.round(n) : n;
}

function cleanSuburbs(list) {
  if (!Array.isArray(list)) return { list: [] };
  const seen = new Set();
  const out = [];
  for (const s of list.slice(0, 50)) {
    const suburb = String((s && s.suburb) || '').trim().slice(0, 100);
    if (!suburb) continue;
    const key = suburb.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const sold = num(s.sold_last_3m, { integer: true, max: 100000 });
    const onMarket = num(s.on_market_count, { integer: true, max: 100000 });
    const price = num(s.median_price, { max: 1e9 });
    const yld = num(s.median_yield, { max: 100 });
    if ([sold, onMarket, price, yld].includes(undefined)) {
      return { error: `Please check the numbers for ${suburb}` };
    }

    let overlay = null;
    if (s.overlay_over_75 === 'yes' || s.overlay_over_75 === true) overlay = true;
    if (s.overlay_over_75 === 'no' || s.overlay_over_75 === false) overlay = false;

    out.push({
      suburb,
      suitability: LEVELS.includes(s.suitability) ? s.suitability : 'medium',
      sold_last_3m: sold,
      on_market_count: onMarket,
      overlay_over_75: overlay,
      median_price: price,
      median_yield: yld
    });
  }
  return { list: out };
}

// ---------- LIST ----------
router.get('/briefs/:id/clusters', async (req, res) => {
  const brief = await loadBrief(req, req.params.id);
  if (!brief) return res.status(404).json({ error: 'Brief not found' });

  const { data, error } = await supabase
    .from('clusters')
    .select(`id, name, state, priority, cluster_suburbs(${SUBURB_COLUMNS})`)
    .eq('brief_id', brief.id)
    .order('priority');
  if (error) return fail(res, error);

  const clusters = data.map((c) => ({
    ...c,
    cluster_suburbs: [...c.cluster_suburbs].sort(
      (a, b) => RANK[a.suitability] - RANK[b.suitability] || a.suburb.localeCompare(b.suburb)
    )
  }));

  res.json({
    status: brief.clusters_status,
    can_edit: canEdit(req, brief),
    clusters
  });
});

// ---------- CREATE ----------
router.post('/briefs/:id/clusters', async (req, res) => {
  const brief = await loadBrief(req, req.params.id);
  if (!brief) return res.status(404).json({ error: 'Brief not found' });
  if (!canEdit(req, brief)) return res.status(403).json({ error: LOCKED });

  const name = String(req.body.name || '').trim().slice(0, 60);
  if (!name) return res.status(400).json({ error: 'Cluster name is required' });
  const state = String(req.body.state || '').trim().slice(0, 50) || null;

  const cleaned = cleanSuburbs(req.body.suburbs);
  if (cleaned.error) return res.status(400).json({ error: cleaned.error });
  if (cleaned.list.length === 0) return res.status(400).json({ error: 'Add at least one suburb' });

  const { data: existing } = await supabase
    .from('clusters')
    .select('priority')
    .eq('brief_id', brief.id)
    .order('priority', { ascending: false });
  if ((existing || []).length >= 30) {
    return res.status(400).json({ error: 'A brief can have up to 30 clusters' });
  }
  const priority = (existing && existing[0] ? existing[0].priority : 0) + 1;

  const { data: cluster, error } = await supabase
    .from('clusters')
    .insert({ brief_id: brief.id, name, state, priority })
    .select()
    .single();
  if (error) return fail(res, error);

  const { error: subError } = await supabase
    .from('cluster_suburbs')
    .insert(cleaned.list.map((s) => ({ ...s, cluster_id: cluster.id })));
  if (subError) {
    await supabase.from('clusters').delete().eq('id', cluster.id);
    return fail(res, subError);
  }
  res.status(201).json(cluster);
});

// ---------- EDIT ----------
router.patch('/clusters/:id', async (req, res) => {
  const { data: cluster } = await supabase
    .from('clusters')
    .select('id, brief_id')
    .eq('id', req.params.id)
    .single();
  if (!cluster) return res.status(404).json({ error: 'Cluster not found' });

  const brief = await loadBrief(req, cluster.brief_id);
  if (!brief) return res.status(404).json({ error: 'Cluster not found' });
  if (!canEdit(req, brief)) return res.status(403).json({ error: LOCKED });

  const updates = {};
  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim().slice(0, 60);
    if (!name) return res.status(400).json({ error: 'Cluster name is required' });
    updates.name = name;
  }
  if (req.body.state !== undefined) {
    updates.state = String(req.body.state).trim().slice(0, 50) || null;
  }

  let suburbs = null;
  if (req.body.suburbs !== undefined) {
    const cleaned = cleanSuburbs(req.body.suburbs);
    if (cleaned.error) return res.status(400).json({ error: cleaned.error });
    if (cleaned.list.length === 0) {
      return res.status(400).json({ error: 'A cluster needs at least one suburb' });
    }
    suburbs = cleaned.list;
  }

  if (Object.keys(updates).length) {
    const { error } = await supabase.from('clusters').update(updates).eq('id', cluster.id);
    if (error) return fail(res, error);
  }

  if (suburbs) {
    // Add the new list first, then remove the old rows, so nothing is lost if something fails
    const { data: old } = await supabase
      .from('cluster_suburbs')
      .select('id')
      .eq('cluster_id', cluster.id);
    const { error: insertError } = await supabase
      .from('cluster_suburbs')
      .insert(suburbs.map((s) => ({ ...s, cluster_id: cluster.id })));
    if (insertError) return fail(res, insertError);
    if (old && old.length) {
      await supabase.from('cluster_suburbs').delete().in('id', old.map((o) => o.id));
    }
  }
  res.json({ ok: true });
});

// ---------- DELETE ----------
router.delete('/clusters/:id', async (req, res) => {
  const { data: cluster } = await supabase
    .from('clusters')
    .select('id, brief_id')
    .eq('id', req.params.id)
    .single();
  if (!cluster) return res.status(404).json({ error: 'Cluster not found' });

  const brief = await loadBrief(req, cluster.brief_id);
  if (!brief) return res.status(404).json({ error: 'Cluster not found' });
  if (!canEdit(req, brief)) return res.status(403).json({ error: LOCKED });

  const { error } = await supabase.from('clusters').delete().eq('id', cluster.id);
  if (error) return fail(res, error);
  res.json({ ok: true });
});

// ---------- SAVE THE SOURCING PRIORITY ORDER ----------
router.post('/briefs/:id/clusters/order', async (req, res) => {
  const brief = await loadBrief(req, req.params.id);
  if (!brief) return res.status(404).json({ error: 'Brief not found' });
  if (!canEdit(req, brief)) return res.status(403).json({ error: LOCKED });

  const ids = req.body.ids;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'Send the list of clusters in order' });

  const { data: existing } = await supabase.from('clusters').select('id').eq('brief_id', brief.id);
  const have = new Set((existing || []).map((c) => c.id));
  if (ids.length !== have.size || new Set(ids).size !== ids.length || !ids.every((id) => have.has(id))) {
    return res.status(400).json({ error: 'The cluster list has changed. Please reload and try again.' });
  }

  const results = await Promise.all(
    ids.map((id, i) => supabase.from('clusters').update({ priority: i + 1 }).eq('id', id))
  );
  const failed = results.find((r) => r.error);
  if (failed) return fail(res, failed.error);
  res.json({ ok: true });
});

// ---------- FINALISE / REOPEN ----------
router.post('/briefs/:id/clusters/status', async (req, res) => {
  const brief = await loadBrief(req, req.params.id);
  if (!brief) return res.status(404).json({ error: 'Brief not found' });

  const { status } = req.body;
  if (!['draft', 'final'].includes(status)) return res.status(400).json({ error: 'Unknown status' });
  if (status === 'draft' && !isManager(req)) {
    return res.status(403).json({ error: 'Only the manager can reopen clusters' });
  }

  const { error } = await supabase
    .from('briefs')
    .update({ clusters_status: status })
    .eq('id', brief.id);
  if (error) return fail(res, error);
  res.json({ ok: true, status });
});

module.exports = router;