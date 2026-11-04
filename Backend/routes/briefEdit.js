const express = require('express');
const supabase = require('../lib/supabase');
const { requireManager } = require('../middleware/auth');

const router = express.Router();
const fail = (res, error) => res.status(500).json({ error: error.message });
const isManager = (req) => req.user.role === 'manager';

// What the client asked for. Changing any of these after approval creates a new version.
// Notes, due date, commission, status and assignment are NOT part of the version history.
const LABELS = {
  title: 'Title',
  price_min: 'Minimum budget (£)',
  price_max: 'Maximum budget (£)',
  rent_pw_min: 'Weekly rent from (£)',
  rent_pw_max: 'Weekly rent to (£)',
  min_yield: 'Target yield (%)',
  preferred_states: 'Preferred states / regions',
  preferred_areas: 'Preferred suburbs',
  exclusions: 'Non-negotiable exclusions',
  property_type: 'Property type',
  min_plot_size: 'Minimum land size (m²)',
  bedrooms: 'Bedrooms',
  bathrooms: 'Bathrooms',
  car_spaces: 'Car parking',
  max_property_age: 'Maximum property age (years)',
  power_line_distance: 'Distance from power lines',
  cemetery_distance: 'Distance from cemeteries',
  other_mandatory_criteria: 'Other mandatory criteria',
  must_haves: 'Must have',
  must_avoids: 'Must avoid',
  rejected_properties: 'Properties already rejected',
  liked_missed_properties: 'Properties liked but missed'
};
const REQUIREMENT_FIELDS = Object.keys(LABELS);
const OTHER_FIELDS = ['notes', 'due_date'];
const MANAGER_FIELDS = ['commission_amount', 'fee_status'];
const OPEN_STATUSES = ['active', 'on_hold', 'closed'];
const FEE_STATUSES = ['not_due', 'due', 'paid'];

function pick(body, fields) {
  const out = {};
  for (const f of fields) {
    if (body[f] !== undefined) out[f] = body[f] === '' ? null : body[f];
  }
  return out;
}

const norm = (v) => (v === null || v === undefined || v === '' ? '' : String(v).trim());
const sameNumber = (a, b) =>
  norm(a) !== '' && norm(b) !== '' && !Number.isNaN(Number(a)) && !Number.isNaN(Number(b)) && Number(a) === Number(b);
const differs = (a, b) => !(norm(a) === norm(b) || sameNumber(a, b));

// ---------- EDIT A BRIEF (manager only) ----------
router.patch('/briefs/:id', requireManager, async (req, res) => {
  const { data: current } = await supabase
    .from('briefs')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();
  if (!current) return res.status(404).json({ error: 'Brief not found' });
  const pending = current.status === 'pending_approval';

  const fields = pick(req.body, [...REQUIREMENT_FIELDS, ...OTHER_FIELDS, ...MANAGER_FIELDS]);

  if (fields.fee_status !== undefined && !FEE_STATUSES.includes(fields.fee_status)) {
    return res.status(400).json({ error: 'Unknown fee status' });
  }

  // A pending brief can only change through Approve or Decline. Nothing sets a brief back to pending.
  if (req.body.status !== undefined && req.body.status !== '' && !pending) {
    if (!OPEN_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ error: 'Unknown status' });
    }
    fields.status = req.body.status;
  }

  if (req.body.assigned_to !== undefined) {
    const id = req.body.assigned_to === '' ? null : req.body.assigned_to;
    if (id && pending) {
      return res.status(400).json({ error: 'Approve the brief before assigning it to an employee' });
    }
    if (id) {
      const { data: person } = await supabase
        .from('users')
        .select('id')
        .eq('id', id)
        .eq('role', 'employee')
        .eq('active', true)
        .maybeSingle();
      if (!person) return res.status(400).json({ error: 'Choose an active employee' });
    }
    fields.assigned_to = id;
  }

  if (fields.fee_status === 'paid') fields.fee_paid_at = new Date().toISOString();
  if (Object.keys(fields).length === 0) return res.status(400).json({ error: 'Nothing to change' });

  // After approval, a change to what the client asked for starts a new version
  const changes = [];
  if (!pending) {
    for (const key of REQUIREMENT_FIELDS) {
      if (fields[key] === undefined) continue;
      if (differs(current[key], fields[key])) {
        changes.push({
          field: key,
          label: LABELS[key],
          from: norm(current[key]).slice(0, 500) || null,
          to: norm(fields[key]).slice(0, 500) || null
        });
      }
    }
    if (changes.length) fields.version = (current.version || 1) + 1;
  }

  const { data, error } = await supabase
    .from('briefs')
    .update(fields)
    .eq('id', current.id)
    .select()
    .single();
  if (error) return fail(res, error);

  if (changes.length) {
    await supabase.from('brief_changes').insert({
      brief_id: current.id,
      version: fields.version,
      changed_by: req.user.id,
      changes
    });
  }
  res.json(data);
});

// ---------- WHAT CHANGED IN THIS BRIEF (staff) ----------
router.get('/briefs/:id/changes', async (req, res) => {
  const { data: brief } = await supabase
    .from('briefs')
    .select('id, assigned_to, status')
    .eq('id', req.params.id)
    .maybeSingle();
  if (!brief) return res.status(404).json({ error: 'Brief not found' });
  if (!isManager(req) && (brief.assigned_to !== req.user.id || brief.status === 'pending_approval')) {
    return res.status(404).json({ error: 'Brief not found' });
  }

  const { data, error } = await supabase
    .from('brief_changes')
    .select('id, version, changes, created_at')
    .eq('brief_id', brief.id)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return fail(res, error);

  res.json(data.map((r) => ({ id: r.id, version: r.version, at: r.created_at, changes: r.changes })));
});

module.exports = router;