const express = require('express');
const supabase = require('../lib/supabase');
const { signPaths, attachCovers } = require('../lib/media');

const router = express.Router();
const fail = (res, error) => res.status(500).json({ error: error.message });

// Only these columns ever leave the server for a client
const REQUIREMENT_COLUMNS =
  'title, price_min, price_max, min_plot_size, min_yield, bedrooms, bathrooms, car_spaces, ' +
  'max_property_age, property_type, preferred_areas, rent_pw_min, rent_pw_max, preferred_states, ' +
  'exclusions, power_line_distance, cemetery_distance, other_mandatory_criteria, must_haves, ' +
  'must_avoids, rejected_properties, liked_missed_properties';

const BRIEF_COLUMNS = `id, brief_number, status, created_at, ${REQUIREMENT_COLUMNS}`;

const CARD_COLUMNS =
  'id, property_title, address, region, source, price, price_max, bedrooms, bathrooms, ' +
  'car_parking, plot_size, client_decision, client_comment, viewed_at, created_at';

const DETAIL_COLUMNS = [
  'id', 'brief_id', 'property_title', 'address', 'region', 'property_type', 'source',
  'price', 'price_max', 'valuation', 'valuation_max', 'bedrooms', 'bathrooms',
  'car_parking', 'plot_size', 'selling_agent_name', 'selling_agent_phone',
  'selling_agent_email', 'sales_comparables', 'notes_from_agent', 'built_year',
  'condition', 'occupancy_status', 'current_rent_pw', 'rental_appraisal_pw',
  'est_rental_yield', 'bushfire_zone', 'flood_zone', 'heritage_zone',
  'adjacent_main_road', 'easements', 'noise_level', 'social_housing_pct',
  'social_housing_nearby', 'other_findings_found', 'other_findings',
  'nearest_bus_stop', 'airport_distance', 'railway_distance', 'schools',
  'hospitals', 'shopping_centers', 'client_decision', 'client_comment', 'viewed_at'
].join(', ');

// What a client is allowed to send when submitting a new search. Anything else is ignored.
const TEXT_LIMITS = {
  title: 120, property_type: 100, preferred_states: 200, power_line_distance: 100,
  cemetery_distance: 100, preferred_areas: 2000, exclusions: 2000,
  other_mandatory_criteria: 2000, must_haves: 2000, must_avoids: 2000,
  rejected_properties: 2000, liked_missed_properties: 2000
};
const NUMBER_RULES = {
  price_min: { max: 1e9 }, price_max: { max: 1e9 },
  rent_pw_min: { max: 1e6 }, rent_pw_max: { max: 1e6 },
  min_yield: { max: 100 }, min_plot_size: { max: 1e7 },
  bedrooms: { max: 50, integer: true }, bathrooms: { max: 50, integer: true },
  car_spaces: { max: 50, integer: true }, max_property_age: { max: 500, integer: true }
};
const MAX_PENDING = 5;

function parseSubmission(input) {
  const body = input || {};
  const fields = {};
  const label = (key) => key.replace(/_/g, ' ');

  for (const [key, limit] of Object.entries(TEXT_LIMITS)) {
    const v = body[key];
    if (typeof v !== 'string') continue;
    const text = v.trim();
    if (text.length > limit) return { error: `The ${label(key)} is too long` };
    if (text) fields[key] = text;
  }
  for (const [key, rule] of Object.entries(NUMBER_RULES)) {
    const v = body[key];
    if (v === undefined || v === null || v === '') continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > rule.max) {
      return { error: `Please check the ${label(key)}` };
    }
    fields[key] = rule.integer ? Math.round(n) : n;
  }

  if (!fields.title || fields.title.length < 3) {
    return { error: 'Please give your search a title' };
  }
  if (fields.price_min !== undefined && fields.price_max !== undefined && fields.price_min > fields.price_max) {
    return { error: 'Your minimum budget cannot be higher than your maximum budget' };
  }
  if (fields.rent_pw_min !== undefined && fields.rent_pw_max !== undefined && fields.rent_pw_min > fields.rent_pw_max) {
    return { error: 'Your minimum rent cannot be higher than your maximum rent' };
  }
  return { fields };
}

async function myClient(userId) {
  const { data } = await supabase
    .from('clients')
    .select('id, name')
    .eq('user_id', userId)
    .single();
  return data;
}

// A property is only reachable if it is approved AND inside one of this client's own briefs
async function loadOwnProperty(clientId, propertyId, columns) {
  const { data: property } = await supabase
    .from('properties')
    .select(columns)
    .eq('id', propertyId)
    .eq('approval_status', 'approved')
    .single();
  if (!property) return null;

  const { data: brief } = await supabase
    .from('briefs')
    .select('id, brief_number, title')
    .eq('id', property.brief_id)
    .eq('client_id', clientId)
    .neq('status', 'pending_approval')
    .single();
  if (!brief) return null;

  return { property, brief };
}

// ---------- MY BRIEFS (including ones awaiting approval) ----------
router.get('/briefs', async (req, res) => {
  const client = await myClient(req.user.id);
  if (!client) return res.status(404).json({ error: 'No client record is linked to this login' });

  const { data: briefs, error } = await supabase
    .from('briefs')
    .select(BRIEF_COLUMNS)
    .eq('client_id', client.id)
    .order('created_at', { ascending: false });
  if (error) return fail(res, error);

  const live = briefs.filter((b) => b.status !== 'pending_approval');
  let props = [];
  if (live.length) {
    const { data } = await supabase
      .from('properties')
      .select('brief_id, client_decision, viewed_at')
      .in('brief_id', live.map((b) => b.id))
      .eq('approval_status', 'approved');
    props = data || [];
  }

  res.json({
    client: { name: client.name },
    briefs: briefs.map((b) => {
      const mine = props.filter((p) => p.brief_id === b.id);
      return {
        ...b,
        property_count: mine.length,
        new_count: mine.filter((p) => !p.viewed_at).length,
        awaiting_count: mine.filter((p) => p.client_decision === 'pending').length
      };
    })
  });
});

// ---------- SUBMIT A NEW SEARCH ----------
router.post('/briefs', async (req, res) => {
  const client = await myClient(req.user.id);
  if (!client) return res.status(404).json({ error: 'No client record is linked to this login' });

  const parsed = parseSubmission(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const { count } = await supabase
    .from('briefs')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', client.id)
    .eq('status', 'pending_approval');
  if ((count || 0) >= MAX_PENDING) {
    return res.status(400).json({
      error: `You already have ${MAX_PENDING} searches awaiting approval. Please wait for us to review them.`
    });
  }

  // The client id, status and approval details are always set here, never taken from the browser
  const { data, error } = await supabase
    .from('briefs')
    .insert({
      ...parsed.fields,
      client_id: client.id,
      status: 'pending_approval',
      submitted_by_client: true,
      submitted_at: new Date().toISOString()
    })
    .select('id, brief_number, status')
    .single();
  if (error) return fail(res, error);
  res.status(201).json(data);
});

// ---------- ONE BRIEF + ITS APPROVED PROPERTIES ----------
router.get('/briefs/:id', async (req, res) => {
  const client = await myClient(req.user.id);
  if (!client) return res.status(404).json({ error: 'No client record is linked to this login' });

  const { data: brief } = await supabase
    .from('briefs')
    .select(BRIEF_COLUMNS)
    .eq('id', req.params.id)
    .eq('client_id', client.id)
    .single();
  if (!brief) return res.status(404).json({ error: 'Search not found' });

  // A search that is still awaiting approval never returns any properties
  if (brief.status === 'pending_approval') return res.json({ brief, properties: [] });

  const { data: properties, error } = await supabase
    .from('properties')
    .select(CARD_COLUMNS)
    .eq('brief_id', brief.id)
    .eq('approval_status', 'approved')
    .order('created_at', { ascending: false });
  if (error) return fail(res, error);

  await attachCovers(properties);
  res.json({ brief, properties });
});

// ---------- ONE PROPERTY (marks it as viewed) ----------
router.get('/properties/:id', async (req, res) => {
  const client = await myClient(req.user.id);
  if (!client) return res.status(404).json({ error: 'No client record is linked to this login' });

  const found = await loadOwnProperty(client.id, req.params.id, DETAIL_COLUMNS);
  if (!found) return res.status(404).json({ error: 'Property not found' });
  const { property, brief } = found;

  if (!property.viewed_at) {
    const now = new Date().toISOString();
    await supabase.from('properties').update({ viewed_at: now }).eq('id', property.id);
    property.viewed_at = now;
  }

  const { data: media } = await supabase
    .from('property_media')
    .select('id, kind, file_name, content_type, created_at, storage_path')
    .eq('property_id', property.id)
    .order('created_at', { ascending: true });

  const urls = await signPaths((media || []).map((m) => m.storage_path));

  res.json({
    property,
    brief,
    media: (media || []).map((m) => ({
      id: m.id,
      kind: m.kind,
      file_name: m.file_name,
      content_type: m.content_type,
      created_at: m.created_at,
      url: urls[m.storage_path] || null
    }))
  });
});

// ---------- CLIENT DECISION ----------
router.post('/properties/:id/decision', async (req, res) => {
  const { decision, comment } = req.body;
  if (!['interested', 'rejected', 'confirmed'].includes(decision)) {
    return res.status(400).json({ error: 'Unknown decision' });
  }

  const client = await myClient(req.user.id);
  if (!client) return res.status(404).json({ error: 'No client record is linked to this login' });

  const found = await loadOwnProperty(client.id, req.params.id, 'id, brief_id, client_decision');
  if (!found) return res.status(404).json({ error: 'Property not found' });

  if (found.property.client_decision === 'confirmed') {
    return res.status(403).json({
      error: 'You have already confirmed this property. Please contact us if anything has changed.'
    });
  }

  const now = new Date().toISOString();
  const updates = { client_decision: decision, client_decision_at: now };
  if (comment !== undefined) {
    updates.client_comment = String(comment).trim().slice(0, 1000) || null;
  }
  if (decision === 'confirmed') updates.client_confirmed_at = now;

  const { error } = await supabase.from('properties').update(updates).eq('id', found.property.id);
  if (error) return fail(res, error);
  res.json({ ok: true });
});

module.exports = router;