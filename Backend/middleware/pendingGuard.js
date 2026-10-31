const supabase = require('../lib/supabase');

// Employees must never reach a brief that is still awaiting approval, by any route.
// This runs before the staff routes and works out which brief a request is about.
async function briefIdFor(area, id) {
  if (area === 'briefs') return id;

  if (area === 'properties') {
    const { data } = await supabase.from('properties').select('brief_id').eq('id', id).maybeSingle();
    return data ? data.brief_id : null;
  }

  if (area === 'clusters') {
    const { data } = await supabase.from('clusters').select('brief_id').eq('id', id).maybeSingle();
    return data ? data.brief_id : null;
  }

  if (area === 'media') {
    const { data: media } = await supabase
      .from('property_media')
      .select('property_id')
      .eq('id', id)
      .maybeSingle();
    if (!media) return null;
    const { data } = await supabase
      .from('properties')
      .select('brief_id')
      .eq('id', media.property_id)
      .maybeSingle();
    return data ? data.brief_id : null;
  }

  return null;
}

module.exports = async function blockPendingForEmployees(req, res, next) {
  if (!req.user || req.user.role === 'manager') return next();

  const [area, id] = req.path.split('/').filter(Boolean);
  if (!id) return next();

  try {
    const briefId = await briefIdFor(area, id);
    if (!briefId) return next();

    const { data: brief } = await supabase
      .from('briefs')
      .select('status')
      .eq('id', briefId)
      .maybeSingle();

    if (brief && brief.status === 'pending_approval') {
      return res.status(404).json({ error: 'Brief not found' });
    }
    return next();
  } catch (e) {
    // If anything goes wrong, refuse the request rather than risk showing a pending brief
    return res.status(500).json({ error: 'Something went wrong' });
  }
};