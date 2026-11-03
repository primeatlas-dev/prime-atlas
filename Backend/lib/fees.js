const supabase = require('./supabase');

// A fee is due once a property in the brief is approved, confirmed by the client
// AND confirmed with the seller. A paid fee is never changed here.
async function syncFee(briefId) {
  if (!briefId) return;
  const { data: brief } = await supabase
    .from('briefs')
    .select('id, fee_status')
    .eq('id', briefId)
    .maybeSingle();
  if (!brief || brief.fee_status === 'paid') return;

  const { count } = await supabase
    .from('properties')
    .select('id', { count: 'exact', head: true })
    .eq('brief_id', briefId)
    .eq('approval_status', 'approved')
    .not('client_confirmed_at', 'is', null)
    .not('seller_confirmed_at', 'is', null);

  const next = (count || 0) > 0 ? 'due' : 'not_due';
  if (next !== brief.fee_status) {
    await supabase.from('briefs').update({ fee_status: next }).eq('id', briefId);
  }
}

module.exports = { syncFee };