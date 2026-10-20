const express = require('express');
const supabase = require('../lib/supabase');

const router = express.Router();
const fail = (res, error) => res.status(500).json({ error: error.message });
const isManager = (req) => req.user.role === 'manager';
const LEVELS = ['high', 'medium', 'low'];
const RANK = { high: 0, medium: 1, low: 2 };

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
const LOCKED = 'Clusters are finalised. Ask the manager to reopen them.';

function cleanSuburbs(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const s of list.slice(0, 50)) {
    const suburb = String((s && s.suburb) || '').trim().slice(0, 100);
    if (!suburb || seen.has(suburb.toLowerCase())) continue;
    seen.add(suburb.toLowerCase());
    out.push({
      suburb,
      region: String((s && s.region) || '').trim().slice(0, 50) || null,
      suitability: LEVELS.includes(s.suitability) ? s.suitability : 'medium'
    });
  }
  return out;
}

// ---------- LIST ----------
router.get('/briefs/:id/clusters', async (req, res) => {
  const brief = await loadBrief(req, req.params.id);
  if (!brief) return res.status(404).json({ error: 'Brief not found' });

  const { data, error } = await supabase
    .from('clusters')
    .select('id, name, priority, cluster_suburbs(id, suburb, region, suitability)')
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

  const suburbs = cleanSuburbs(req.body.suburbs);
  if (suburbs.length === 0) return res.status(400).json({ error: 'Add at least one suburb' });

  const { data: existing } = await supabase
    .from('clusters')
    .select('priority')
    .eq('brief_id', brief.id)
    .order('priority', { ascending: false });
  if ((existing || []).length >= 30) {
    return res.status(400).json({ error: 'A brief can have up to 30 clusters' });
  }

  let priority = parseInt(req.body.priority, 10);
  if (!Number.isInteger(priority) || priority < 1) {
    priority = (existing && existing[0] ? existing[0].priority : 0) + 1;
  }

  const { data: cluster, error } = await supabase
    .from('clusters')
    .insert({
      brief_id: brief.id,
      name: String(req.body.name || '').trim().slice(0, 60) || null,
      priority
    })
    .select()
    .single();
  if (error) return fail(res, error);

  const { error: subError } = await supabase
    .from('cluster_suburbs')
    .insert(suburbs.map((s) => ({ ...s, cluster_id: cluster.id })));
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

  let suburbs = null;
  if (req.body.suburbs !== undefined) {
    suburbs = cleanSuburbs(req.body.suburbs);
    if (suburbs.length === 0) {
      return res.status(400).json({ error: 'A cluster needs at least one suburb' });
    }
  }

  const updates = {};
  if (req.body.name !== undefined) {
    updates.name = String(req.body.name).trim().slice(0, 60) || null;
  }
  const priority = parseInt(req.body.priority, 10);
  if (Number.isInteger(priority) && priority >= 1) updates.priority = priority;

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