const express = require('express');
const supabase = require('../lib/supabase');
const { signPaths, attachCovers } = require('../lib/media');

const router = express.Router();
const fail = (res, error) => res.status(500).json({ error: error.message });

// Only these columns ever leave the server for a client
const BRIEF_COLUMNS =
  'id, brief_number, title, status, price_min, price_max, min_plot_size, min_yield, ' +
  'bedrooms, bathrooms, car_spaces, max_property_age, property_type, preferred_areas';

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

// ---------- MY BRIEFS ----------
router.get('/briefs', async (req, res) => {
  const client = await myClient(req.user.id);
  if (!client) return res.status(404).json({ error: 'No client record is linked to this login' });

  const { data: briefs, error } = await supabase
    .from('briefs')
    .select(BRIEF_COLUMNS)
    .eq('client_id', client.id)
    .neq('status', 'pending_approval')
    .order('created_at', { ascending: false });
  if (error) return fail(res, error);

  let props = [];
  if (briefs.length) {
    const { data } = await supabase
      .from('properties')
      .select('brief_id, client_decision, viewed_at')
      .in('brief_id', briefs.map((b) => b.id))
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

// ---------- ONE BRIEF + ITS APPROVED PROPERTIES ----------
router.get('/briefs/:id', async (req, res) => {
  const client = await myClient(req.user.id);
  if (!client) return res.status(404).json({ error: 'No client record is linked to this login' });

  const { data: brief } = await supabase
    .from('briefs')
    .select(BRIEF_COLUMNS)
    .eq('id', req.params.id)
    .eq('client_id', client.id)
    .neq('status', 'pending_approval')
    .single();
  if (!brief) return res.status(404).json({ error: 'Search not found' });

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