const express = require('express');
const crypto = require('crypto');
const supabase = require('../lib/supabase');
const { BUCKET, signPaths } = require('../lib/media');

const router = express.Router();

const EDITABLE_FIELDS = [
  'property_title', 'address', 'region', 'property_type', 'source', 'sourced_from',
  'price', 'price_max', 'valuation', 'valuation_max', 'bedrooms', 'bathrooms',
  'car_parking', 'plot_size', 'selling_agent_name', 'selling_agent_phone',
  'selling_agent_email', 'sales_comparables', 'notes_from_agent', 'built_year',
  'condition', 'occupancy_status', 'current_rent_pw', 'rental_appraisal_pw',
  'est_rental_yield', 'bushfire_zone', 'flood_zone', 'heritage_zone',
  'adjacent_main_road', 'easements', 'noise_level', 'social_housing_pct',
  'social_housing_nearby', 'other_findings_found', 'other_findings',
  'nearest_bus_stop', 'airport_distance', 'railway_distance', 'schools',
  'hospitals', 'shopping_centers'
];
const MANAGER_FIELDS = ['client_comment', 'client_decision'];

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const EXT = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
  'application/pdf': 'pdf'
};
const MAX_BYTES = 50 * 1024 * 1024;
const KINDS = ['cover', 'location', 'extra'];

function pick(body, fields) {
  const out = {};
  for (const f of fields) {
    if (body[f] !== undefined) out[f] = body[f] === '' ? null : body[f];
  }
  return out;
}

const fail = (res, error) => res.status(500).json({ error: error.message });
const isManager = (req) => req.user.role === 'manager';
const canEdit = (req, property) => isManager(req) || property.approval_status !== 'approved';

// Managers can open any property. Employees only properties in briefs assigned to them.
async function loadAccessible(req, propertyId) {
  const { data: property } = await supabase
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .single();
  if (!property) return {};

  let brief = null;
  if (property.brief_id) {
    const { data } = await supabase
      .from('briefs')
      .select('id, brief_number, title, client_id, assigned_to, status')
      .eq('id', property.brief_id)
      .single();
    brief = data;
  }
  if (!isManager(req) && (!brief || brief.assigned_to !== req.user.id)) return {};
  return { property, brief };
}

// ---------- FULL PROPERTY PAGE ----------
router.get('/properties/:id/full', async (req, res) => {
  const { property, brief } = await loadAccessible(req, req.params.id);
  if (!property) return res.status(404).json({ error: 'Property not found' });

  const [mediaRes, usersRes, clientRes] = await Promise.all([
    supabase
      .from('property_media')
      .select('*')
      .eq('property_id', property.id)
      .order('created_at', { ascending: true }),
    supabase.from('users').select('id, name'),
    brief
      ? supabase.from('clients').select('id, name, client_number').eq('id', brief.client_id).single()
      : Promise.resolve({ data: null })
  ]);

  const names = Object.fromEntries((usersRes.data || []).map((u) => [u.id, u.name]));
  const media = mediaRes.data || [];
  const urls = await signPaths(media.map((m) => m.storage_path));

  const { client_confirmed_at, seller_confirmed_at, ...safe } = property;
  const base = isManager(req) ? property : safe;
  const c = clientRes.data;

  res.json({
    property: {
      ...base,
      created_by_name: names[property.created_by] || null,
      approved_by_name: names[property.approved_by] || null
    },
    brief,
    client: c
      ? { client_number: c.client_number, name: isManager(req) ? c.name : `Client ${c.client_number}` }
      : null,
    media: media.map((m) => ({
      id: m.id,
      kind: m.kind,
      file_name: m.file_name,
      content_type: m.content_type,
      created_at: m.created_at,
      url: urls[m.storage_path] || null
    })),
    can_edit: canEdit(req, property)
  });
});

// ---------- EDIT A PROPERTY ----------
router.patch('/properties/:id', async (req, res) => {
  const { property } = await loadAccessible(req, req.params.id);
  if (!property) return res.status(404).json({ error: 'Property not found' });
  if (!canEdit(req, property)) {
    return res.status(403).json({ error: 'Approved properties can only be changed by the manager' });
  }

  const fields = pick(
    req.body,
    isManager(req) ? [...EDITABLE_FIELDS, ...MANAGER_FIELDS] : EDITABLE_FIELDS
  );
  if (fields.client_decision === null) delete fields.client_decision;
  if (fields.client_decision && fields.client_decision !== property.client_decision) {
    fields.client_decision_at = new Date().toISOString();
  }
  // An employee fixing a rejected property sends it back for review
  if (!isManager(req) && property.approval_status === 'rejected') {
    fields.approval_status = 'review';
  }
  if (Object.keys(fields).length === 0) {
    return res.status(400).json({ error: 'Nothing to change' });
  }

  const { data, error } = await supabase
    .from('properties')
    .update(fields)
    .eq('id', property.id)
    .select()
    .single();
  if (error) return fail(res, error);
  res.json(data);
});

// ---------- UPLOAD STEP 1: get a one-time upload link ----------
router.post('/properties/:id/media/upload-url', async (req, res) => {
  const { property } = await loadAccessible(req, req.params.id);
  if (!property) return res.status(404).json({ error: 'Property not found' });
  if (!canEdit(req, property)) {
    return res.status(403).json({ error: 'Approved properties can only be changed by the manager' });
  }

  const { kind, content_type, size } = req.body;
  if (!KINDS.includes(kind)) return res.status(400).json({ error: 'Unknown picture type' });

  const allowed = kind === 'extra'
    ? [...IMAGE_TYPES, ...VIDEO_TYPES, 'application/pdf']
    : IMAGE_TYPES;
  if (!allowed.includes(content_type)) {
    return res.status(400).json({ error: 'This file type is not allowed here' });
  }
  if (!size || size > MAX_BYTES) {
    return res.status(400).json({ error: 'Files must be under 50 MB' });
  }

  const path = `${property.id}/${crypto.randomUUID()}.${EXT[content_type]}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) return fail(res, error);
  res.json({ path: data.path, token: data.token });
});

// ---------- UPLOAD STEP 2: record the uploaded file ----------
router.post('/properties/:id/media', async (req, res) => {
  const { property } = await loadAccessible(req, req.params.id);
  if (!property) return res.status(404).json({ error: 'Property not found' });
  if (!canEdit(req, property)) {
    return res.status(403).json({ error: 'Approved properties can only be changed by the manager' });
  }

  const { kind, path, file_name, content_type } = req.body;
  if (!KINDS.includes(kind)) return res.status(400).json({ error: 'Unknown picture type' });
  if (!path || !path.startsWith(`${property.id}/`)) {
    return res.status(400).json({ error: 'Invalid file path' });
  }

  // Cover and location: only one each, so the new picture replaces the old one
  if (kind !== 'extra') {
    const { data: old } = await supabase
      .from('property_media')
      .select('id, storage_path')
      .eq('property_id', property.id)
      .eq('kind', kind);
    if (old && old.length) {
      await supabase.storage.from(BUCKET).remove(old.map((o) => o.storage_path));
      await supabase.from('property_media').delete().in('id', old.map((o) => o.id));
    }
  }

  const { data, error } = await supabase
    .from('property_media')
    .insert({
      property_id: property.id,
      kind,
      storage_path: path,
      file_name,
      content_type,
      uploaded_by: req.user.id
    })
    .select()
    .single();
  if (error) return fail(res, error);
  res.status(201).json(data);
});

// ---------- REMOVE A PICTURE OR VIDEO ----------
router.delete('/media/:id', async (req, res) => {
  const { data: media } = await supabase
    .from('property_media')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (!media) return res.status(404).json({ error: 'File not found' });

  const { property } = await loadAccessible(req, media.property_id);
  if (!property) return res.status(404).json({ error: 'File not found' });
  if (!canEdit(req, property)) {
    return res.status(403).json({ error: 'Approved properties can only be changed by the manager' });
  }

  await supabase.storage.from(BUCKET).remove([media.storage_path]);
  await supabase.from('property_media').delete().eq('id', media.id);
  res.json({ ok: true });
});

module.exports = router;