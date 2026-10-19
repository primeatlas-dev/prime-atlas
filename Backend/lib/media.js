const supabase = require('./supabase');

const BUCKET = 'property-media';

// Turn storage paths into temporary viewing links (valid for 1 hour)
async function signPaths(paths, seconds = 3600) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return {};
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(unique, seconds);
  const map = {};
  (data || []).forEach((d) => {
    if (d.signedUrl) map[d.path] = d.signedUrl;
  });
  return map;
}

// Add a cover_url to each property in a list
async function attachCovers(properties) {
  if (!properties.length) return properties;
  const { data } = await supabase
    .from('property_media')
    .select('property_id, storage_path')
    .eq('kind', 'cover')
    .in('property_id', properties.map((p) => p.id));

  const urls = await signPaths((data || []).map((m) => m.storage_path));
  const byProperty = Object.fromEntries(
    (data || []).map((m) => [m.property_id, urls[m.storage_path]])
  );
  properties.forEach((p) => {
    p.cover_url = byProperty[p.id] || null;
  });
  return properties;
}

module.exports = { BUCKET, signPaths, attachCovers };