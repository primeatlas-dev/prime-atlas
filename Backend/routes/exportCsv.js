const express = require('express');
const supabase = require('../lib/supabase');
const { requireManager } = require('../middleware/auth');

const router = express.Router();

// A cell that starts with = + - @ could run as a formula in Excel, so it is stored as plain text
function cell(v) {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

const toCsv = (header, rows) =>
  [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');

// Supabase returns at most 1000 rows at a time, so read in pages
async function fetchAll(table, columns, order) {
  const rows = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order(order)
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

const stamp = () => new Date().toISOString().slice(0, 10);

router.get('/export/briefs', requireManager, async (req, res) => {
  try {
    const [briefs, clients, users] = await Promise.all([
      fetchAll(
        'briefs',
        'brief_number, title, status, client_id, assigned_to, due_date, price_min, price_max, commission_amount, fee_status, version, created_at',
        'brief_number'
      ),
      fetchAll('clients', 'id, name, client_number', 'client_number'),
      fetchAll('users', 'id, name', 'created_at')
    ]);
    const C = Object.fromEntries(clients.map((c) => [c.id, c]));
    const U = Object.fromEntries(users.map((u) => [u.id, u.name]));

    const header = [
      'Brief number', 'Client number', 'Client name', 'Title', 'Status', 'Employee', 'Due date',
      'Budget from (GBP)', 'Budget to (GBP)', 'Commission (GBP)', 'Fee status', 'Version', 'Created'
    ];
    const rows = briefs.map((b) => [
      b.brief_number,
      C[b.client_id] ? C[b.client_id].client_number : '',
      C[b.client_id] ? C[b.client_id].name : '',
      b.title,
      b.status,
      U[b.assigned_to] || '',
      b.due_date,
      b.price_min,
      b.price_max,
      b.commission_amount,
      b.fee_status,
      b.version,
      b.created_at
    ]);
    res.json({ filename: `prime-atlas-briefs-${stamp()}.csv`, csv: toCsv(header, rows) });
  } catch (e) {
    res.status(500).json({ error: 'Could not build the export' });
  }
});

router.get('/export/properties', requireManager, async (req, res) => {
  try {
    const [props, briefs, clients, users] = await Promise.all([
      fetchAll(
        'properties',
        'property_title, address, region, price, price_max, approval_status, client_decision, brief_id, created_by, created_at',
        'created_at'
      ),
      fetchAll('briefs', 'id, brief_number, client_id', 'brief_number'),
      fetchAll('clients', 'id, name, client_number', 'client_number'),
      fetchAll('users', 'id, name', 'created_at')
    ]);
    const B = Object.fromEntries(briefs.map((b) => [b.id, b]));
    const C = Object.fromEntries(clients.map((c) => [c.id, c]));
    const U = Object.fromEntries(users.map((u) => [u.id, u.name]));

    const header = [
      'Title', 'Address', 'Suburb / region', 'Price from (GBP)', 'Price to (GBP)', 'Approval',
      'Client decision', 'Brief number', 'Client number', 'Added by', 'Created'
    ];
    const rows = props.map((p) => {
      const b = p.brief_id ? B[p.brief_id] : null;
      const c = b ? C[b.client_id] : null;
      return [
        p.property_title,
        p.address,
        p.region,
        p.price,
        p.price_max,
        b ? p.approval_status : 'not in a brief',
        b ? p.client_decision : '',
        b ? b.brief_number : '',
        c ? c.client_number : '',
        U[p.created_by] || '',
        p.created_at
      ];
    });
    res.json({ filename: `prime-atlas-properties-${stamp()}.csv`, csv: toCsv(header, rows) });
  } catch (e) {
    res.status(500).json({ error: 'Could not build the export' });
  }
});

module.exports = router;