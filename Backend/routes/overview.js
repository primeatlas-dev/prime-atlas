const express = require('express');
const supabase = require('../lib/supabase');
const { summarise } = require('../lib/chat');

const router = express.Router();
const fail = (res, error) => res.status(500).json({ error: error.message });
const isManager = (req) => req.user.role === 'manager';
const todayString = () => new Date().toISOString().slice(0, 10);
const briefName = (b) => b.title || `Brief #${b.brief_number}`;
const ids = (rows) => (rows || []).map((r) => r.id);

// Unread chat messages for this person (approved properties only)
async function unreadChats(req) {
  let pq = supabase.from('properties').select('id').eq('approval_status', 'approved');
  if (isManager(req)) {
    pq = pq.not('brief_id', 'is', null);
  } else {
    const { data: briefs } = await supabase
      .from('briefs')
      .select('id')
      .eq('assigned_to', req.user.id)
      .neq('status', 'pending_approval');
    if (!briefs || !briefs.length) return 0;
    pq = pq.in('brief_id', ids(briefs));
  }
  const { data: props } = await pq;
  if (!props || !props.length) return 0;
  const summary = await summarise(req.user, ids(props));
  return Object.values(summary).reduce((total, s) => total + s.unread, 0);
}

// ---------- DASHBOARD DATA (different for managers and employees) ----------
router.get('/overview', async (req, res) => {
  try {
    const manager = isManager(req);
    const today = todayString();

    let bq = supabase
      .from('briefs')
      .select('id, brief_number, title, status, assigned_to, due_date, clusters_status, client_id, created_at, submitted_at');
    if (!manager) bq = bq.eq('assigned_to', req.user.id).neq('status', 'pending_approval');
    const { data: briefs, error } = await bq;
    if (error) return fail(res, error);

    const briefIds = ids(briefs);
    const clientIds = [...new Set(briefs.map((b) => b.client_id))];
    const empty = Promise.resolve({ data: [], count: 0 });

    const propsQuery = supabase
      .from('properties')
      .select('id, brief_id, property_title, approval_status, client_decision, client_decision_at, client_comment, created_by, created_at')
      .not('brief_id', 'is', null);

    const [propsRes, clientsRes, usersRes, clustersRes, clientCountRes] = await Promise.all([
      manager ? propsQuery : briefIds.length ? propsQuery.in('brief_id', briefIds) : empty,
      manager
        ? supabase.from('clients').select('id, name, client_number')
        : clientIds.length
        ? supabase.from('clients').select('id, name, client_number').in('id', clientIds)
        : empty,
      manager ? supabase.from('users').select('id, name, active').eq('role', 'employee') : empty,
      manager
        ? supabase.from('clusters').select('brief_id')
        : briefIds.length
        ? supabase.from('clusters').select('brief_id').in('brief_id', briefIds)
        : empty,
      manager ? supabase.from('clients').select('id', { count: 'exact', head: true }) : empty
    ]);

    const props = propsRes.data || [];
    const clients = clientsRes.data || [];
    const employees = usersRes.data || [];
    const clusterRows = clustersRes.data || [];

    const clientById = Object.fromEntries(clients.map((c) => [c.id, c]));
    const briefById = Object.fromEntries(briefs.map((b) => [b.id, b]));
    const nameById = Object.fromEntries(employees.map((u) => [u.id, u.name]));

    // Employees only ever see "Client N"
    const clientLabel = (clientId) => {
      const c = clientById[clientId];
      if (!c) return 'Client';
      return manager ? `${c.name} (Client ${c.client_number})` : `Client ${c.client_number}`;
    };

    const active = briefs.filter((b) => b.status === 'active');
    const pending = briefs.filter((b) => b.status === 'pending_approval');
    const overdue = active
      .filter((b) => b.due_date && b.due_date < today)
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
    const liveProps = props.filter((p) => {
      const b = briefById[p.brief_id];
      return b && b.status !== 'pending_approval';
    });
    const count = (list, test) => list.filter(test).length;

    const pipeline = {
      review: count(liveProps, (p) => p.approval_status === 'review'),
      approved: count(liveProps, (p) => p.approval_status === 'approved'),
      rejected: count(liveProps, (p) => p.approval_status === 'rejected')
    };
    const approvedProps = liveProps.filter((p) => p.approval_status === 'approved');
    const decisions = {
      pending: count(approvedProps, (p) => p.client_decision === 'pending'),
      interested: count(approvedProps, (p) => p.client_decision === 'interested'),
      rejected: count(approvedProps, (p) => p.client_decision === 'rejected'),
      confirmed: count(approvedProps, (p) => p.client_decision === 'confirmed')
    };

    const recentDecisions = liveProps
      .filter((p) => p.client_decision && p.client_decision !== 'pending' && p.client_decision_at)
      .sort((a, b) => b.client_decision_at.localeCompare(a.client_decision_at))
      .slice(0, 8)
      .map((p) => ({
        property_id: p.id,
        title: p.property_title,
        decision: p.client_decision,
        comment: p.client_comment,
        client_label: clientLabel(briefById[p.brief_id].client_id),
        at: p.client_decision_at
      }));

    if (manager) {
      const team = employees
        .filter((u) => u.active)
        .map((u) => {
          const mine = active.filter((b) => b.assigned_to === u.id);
          const made = liveProps.filter((p) => p.created_by === u.id);
          const last = made.map((p) => p.created_at).sort().pop() || null;
          return {
            id: u.id,
            name: u.name,
            active_briefs: mine.length,
            overdue: count(mine, (b) => b.due_date && b.due_date < today),
            properties: made.length,
            in_review: count(made, (p) => p.approval_status === 'review'),
            approved: count(made, (p) => p.approval_status === 'approved'),
            rejected: count(made, (p) => p.approval_status === 'rejected'),
            last_activity: last
          };
        });

      return res.json({
        role: 'manager',
        stats: {
          total_clients: clientCountRes.count || 0,
          active_briefs: active.length,
          pending_briefs: pending.length,
          properties_in_review: pipeline.review,
          overdue_briefs: overdue.length,
          unassigned_briefs: count(active, (b) => !b.assigned_to),
          clients_confirmed: decisions.confirmed
        },
        pipeline,
        decisions,
        awaiting_briefs: pending
          .sort((a, b) => String(b.submitted_at || b.created_at).localeCompare(String(a.submitted_at || a.created_at)))
          .slice(0, 6)
          .map((b) => ({ id: b.id, title: briefName(b), client_label: clientLabel(b.client_id), at: b.submitted_at || b.created_at })),
        overdue: overdue.slice(0, 8).map((b) => ({
          id: b.id,
          title: briefName(b),
          client_label: clientLabel(b.client_id),
          due_date: b.due_date,
          assigned_name: nameById[b.assigned_to] || 'Unassigned'
        })),
        unassigned: active
          .filter((b) => !b.assigned_to)
          .slice(0, 8)
          .map((b) => ({ id: b.id, title: briefName(b), client_label: clientLabel(b.client_id) })),
        team,
        recent_decisions: recentDecisions
      });
    }

    // Employee view: what needs doing
    const todo = [];
    liveProps
      .filter((p) => p.approval_status === 'rejected')
      .forEach((p) => {
        const b = briefById[p.brief_id];
        todo.push({
          kind: 'rejected',
          title: p.property_title,
          subtitle: `${clientLabel(b.client_id)} · ${briefName(b)}`
        });
      });
    overdue.forEach((b) =>
      todo.push({
        kind: 'overdue',
        title: briefName(b),
        subtitle: `${clientLabel(b.client_id)} · due ${new Date(b.due_date).toLocaleDateString()}`
      })
    );
    const withProps = new Set(liveProps.map((p) => p.brief_id));
    const withClusters = new Set(clusterRows.map((c) => c.brief_id));
    active
      .filter((b) => !withProps.has(b.id))
      .forEach((b) =>
        todo.push({ kind: 'empty', title: briefName(b), subtitle: clientLabel(b.client_id) })
      );
    active
      .filter((b) => !withClusters.has(b.id))
      .forEach((b) =>
        todo.push({ kind: 'clusters', title: briefName(b), subtitle: clientLabel(b.client_id) })
      );

    res.json({
      role: 'employee',
      stats: {
        active_briefs: active.length,
        overdue_briefs: overdue.length,
        in_review: pipeline.review,
        rejected_to_fix: pipeline.rejected,
        approved: pipeline.approved
      },
      pipeline,
      decisions,
      todo: todo.slice(0, 25),
      recent_decisions: recentDecisions
    });
  } catch (e) {
    fail(res, e);
  }
});

// ---------- NOTIFICATION BELL ----------
router.get('/notifications', async (req, res) => {
  try {
    const manager = isManager(req);
    const today = todayString();
    const counts = {};

    if (manager) {
      const [pending, review, overdue, unassigned] = await Promise.all([
        supabase.from('briefs').select('id', { count: 'exact', head: true }).eq('status', 'pending_approval'),
        supabase
          .from('properties')
          .select('id', { count: 'exact', head: true })
          .eq('approval_status', 'review')
          .not('brief_id', 'is', null),
        supabase.from('briefs').select('id', { count: 'exact', head: true }).eq('status', 'active').lt('due_date', today),
        supabase.from('briefs').select('id', { count: 'exact', head: true }).eq('status', 'active').is('assigned_to', null)
      ]);
      counts.pending_briefs = pending.count || 0;
      counts.properties_in_review = review.count || 0;
      counts.overdue_briefs = overdue.count || 0;
      counts.unassigned_briefs = unassigned.count || 0;
    } else {
      const { data: mine } = await supabase
        .from('briefs')
        .select('id, status, due_date')
        .eq('assigned_to', req.user.id)
        .neq('status', 'pending_approval');
      const mineIds = ids(mine);
      counts.overdue_briefs = (mine || []).filter(
        (b) => b.status === 'active' && b.due_date && b.due_date < today
      ).length;
      if (mineIds.length) {
        const { count } = await supabase
          .from('properties')
          .select('id', { count: 'exact', head: true })
          .in('brief_id', mineIds)
          .eq('approval_status', 'rejected');
        counts.rejected_to_fix = count || 0;
      }
    }

    counts.unread_chats = await unreadChats(req);

    const items = Object.entries(counts)
      .filter(([, n]) => n > 0)
      .map(([key, n]) => ({ key, count: n }));
    res.json({ total: items.reduce((t, i) => t + i.count, 0), items });
  } catch (e) {
    fail(res, e);
  }
});

module.exports = router;