const express = require('express');
const supabase = require('../lib/supabase');
const { requireManager } = require('../middleware/auth');
const { syncFee } = require('../lib/fees');
const { logActivity } = require('../lib/activity');

const router = express.Router();
const fail = (res, error) => res.status(500).json({ error: error.message });

// ---------- FEE TRACKER (manager only) ----------
router.get('/fees', requireManager, async (req, res) => {
  try {
    const { data: briefs, error } = await supabase
      .from('briefs')
      .select('id, brief_number, title, client_id, assigned_to, status, commission_amount, fee_status, fee_paid_at')
      .neq('status', 'pending_approval')
      .order('brief_number', { ascending: false });
    if (error) return fail(res, error);

    const [propsRes, clientsRes, usersRes] = await Promise.all([
      supabase
        .from('properties')
        .select('id, brief_id, property_title, client_confirmed_at, seller_confirmed_at, approval_status')
        .not('brief_id', 'is', null)
        .not('client_confirmed_at', 'is', null),
      supabase.from('clients').select('id, name, client_number'),
      supabase.from('users').select('id, name')
    ]);

    const clientById = Object.fromEntries((clientsRes.data || []).map((c) => [c.id, c]));
    const names = Object.fromEntries((usersRes.data || []).map((u) => [u.id, u.name]));
    const confirmed = {};
    (propsRes.data || []).forEach((p) => {
      (confirmed[p.brief_id] = confirmed[p.brief_id] || []).push({
        id: p.id,
        title: p.property_title,
        approval_status: p.approval_status,
        client_confirmed_at: p.client_confirmed_at,
        seller_confirmed_at: p.seller_confirmed_at
      });
    });

    const rows = briefs
      .filter((b) => b.commission_amount !== null || (confirmed[b.id] || []).length > 0 || b.fee_status !== 'not_due')
      .map((b) => {
        const c = clientById[b.client_id];
        return {
          brief_id: b.id,
          brief_number: b.brief_number,
          title: b.title,
          client_name: c ? c.name : 'Client',
          client_number: c ? c.client_number : null,
          assigned_name: names[b.assigned_to] || null,
          brief_status: b.status,
          commission_amount: b.commission_amount,
          fee_status: b.fee_status,
          fee_paid_at: b.fee_paid_at,
          properties: confirmed[b.id] || []
        };
      });

    const sum = (list) => list.reduce((t, r) => t + Number(r.commission_amount || 0), 0);
    const due = rows.filter((r) => r.fee_status === 'due');
    const paid = rows.filter((r) => r.fee_status === 'paid');
    const upcoming = rows.filter((r) => r.fee_status === 'not_due' && r.brief_status === 'active');

    res.json({
      totals: {
        due: sum(due),
        due_count: due.length,
        paid: sum(paid),
        paid_count: paid.length,
        upcoming: sum(upcoming),
        upcoming_count: upcoming.length,
        active_without_commission: briefs.filter(
          (b) => b.status === 'active' && (b.commission_amount === null || b.commission_amount === undefined)
        ).length
      },
      rows
    });
  } catch (e) {
    fail(res, e);
  }
});

// ---------- MARK A PROPERTY AS CONFIRMED WITH THE SELLER ----------
router.post('/properties/:id/seller-confirmation', requireManager, async (req, res) => {
  try {
    const { data: p } = await supabase
      .from('properties')
      .select('id, brief_id, approval_status, client_confirmed_at')
      .eq('id', req.params.id)
      .maybeSingle();
    if (!p || !p.brief_id) return res.status(404).json({ error: 'Property not found' });

    const confirmed = req.body.confirmed !== false;
    if (confirmed && (p.approval_status !== 'approved' || !p.client_confirmed_at)) {
      return res.status(400).json({ error: 'The client has to confirm this property first' });
    }

    const { error } = await supabase
      .from('properties')
      .update({ seller_confirmed_at: confirmed ? new Date().toISOString() : null })
      .eq('id', p.id);
    if (error) return fail(res, error);

    await logActivity(p.id, req.user.id, confirmed ? 'seller_confirmed' : 'seller_unconfirmed', null);
    await syncFee(p.brief_id);
    res.json({ ok: true });
  } catch (e) {
    fail(res, e);
  }
});

// ---------- MARK A FEE AS PAID (OR UNDO IT) ----------
router.post('/briefs/:id/fee', requireManager, async (req, res) => {
  try {
    const { data: brief } = await supabase
      .from('briefs')
      .select('id, fee_status')
      .eq('id', req.params.id)
      .maybeSingle();
    if (!brief) return res.status(404).json({ error: 'Brief not found' });

    if (req.body.action === 'mark_paid') {
      if (brief.fee_status !== 'due') {
        return res.status(400).json({ error: 'Only a fee that is due can be marked as paid' });
      }
      const { error } = await supabase
        .from('briefs')
        .update({ fee_status: 'paid', fee_paid_at: new Date().toISOString() })
        .eq('id', brief.id);
      if (error) return fail(res, error);
    } else if (req.body.action === 'undo_paid') {
      if (brief.fee_status !== 'paid') {
        return res.status(400).json({ error: 'This fee is not marked as paid' });
      }
      const { error } = await supabase
        .from('briefs')
        .update({ fee_status: 'not_due', fee_paid_at: null })
        .eq('id', brief.id);
      if (error) return fail(res, error);
      await syncFee(brief.id);
    } else {
      return res.status(400).json({ error: 'Unknown action' });
    }
    res.json({ ok: true });
  } catch (e) {
    fail(res, e);
  }
});

module.exports = router;