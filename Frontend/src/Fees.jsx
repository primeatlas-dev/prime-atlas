import React, { useState, useEffect, useMemo } from 'react';
import { makeCall } from './api';

const gbp = (n) => (n === null || n === undefined || n === '' ? '—' : `£${Number(n).toLocaleString()}`);
const day = (v) => (v ? new Date(v).toLocaleDateString() : '—');

const STATUS = {
  not_due: ['Not due yet', 'bg-gray-100 text-gray-800'],
  due: ['Fee due', 'bg-yellow-100 text-yellow-800'],
  paid: ['Paid', 'bg-green-100 text-green-800']
};
const FILTERS = [
  ['due', 'Due'],
  ['not_due', 'Not due yet'],
  ['paid', 'Paid'],
  ['all', 'All']
];

function Stat({ title, value, note, tone }) {
  return (
    <div className={`bg-white rounded-lg shadow p-4 border-t-4 ${tone}`}>
      <p className="text-xs text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      {note && <p className="text-xs text-gray-500">{note}</p>}
    </div>
  );
}

export default function FeesPage({ token }) {
  const call = useMemo(() => makeCall(token), [token]);
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('due');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = () =>
    call('/fees')
      .then((d) => {
        setData(d);
        setError('');
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, [call]);

  const act = async (key, path, body) => {
    setBusy(key);
    setError('');
    try {
      await call(path, { method: 'POST', body: JSON.stringify(body) });
      await load();
    } catch (e) {
      setError(e.message);
    }
    setBusy('');
  };

  if (!data) return <p className="text-gray-500">{error || 'Loading…'}</p>;

  const { totals, rows } = data;
  const count = (key) => (key === 'all' ? rows.length : rows.filter((r) => r.fee_status === key).length);
  const shown = rows.filter((r) => filter === 'all' || r.fee_status === filter);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat title="Fees due" value={gbp(totals.due)} note={`${totals.due_count} brief${totals.due_count === 1 ? '' : 's'}`} tone="border-yellow-400" />
        <Stat title="Paid" value={gbp(totals.paid)} note={`${totals.paid_count} brief${totals.paid_count === 1 ? '' : 's'}`} tone="border-green-500" />
        <Stat title="Coming up" value={gbp(totals.upcoming)} note="On active briefs, not due yet" tone="border-blue-500" />
        <Stat
          title="Active briefs without a fee set"
          value={totals.active_without_commission}
          note="Add it under Brief details"
          tone={totals.active_without_commission ? 'border-red-500' : 'border-gray-300'}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`px-3 py-1 rounded-lg text-sm font-semibold ${
              filter === value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            {label} ({count(value)})
          </button>
        ))}
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {shown.length === 0 ? (
        <p className="text-gray-500">Nothing in this view.</p>
      ) : (
        <div className="space-y-4">
          {shown.map((r) => {
            const [label, cls] = STATUS[r.fee_status] || [r.fee_status, ''];
            return (
              <div key={r.brief_id} className="bg-white rounded-lg shadow p-5">
                <div className="flex flex-wrap justify-between items-start gap-3">
                  <div>
                    <p className="text-xs text-gray-500">
                      {r.client_name}
                      {r.client_number ? ` · Client #${r.client_number}` : ''} · Brief #{r.brief_number}
                    </p>
                    <h3 className="text-lg font-semibold text-gray-800">{r.title || 'Untitled brief'}</h3>
                    <p className="text-xs text-gray-500">Employee: {r.assigned_name || 'Unassigned'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{gbp(r.commission_amount)}</p>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${cls}`}>{label}</span>
                    {r.fee_status === 'paid' && <p className="text-xs text-gray-500 mt-1">Paid {day(r.fee_paid_at)}</p>}
                  </div>
                </div>

                {(r.commission_amount === null || r.commission_amount === undefined) && (
                  <p className="text-xs text-yellow-700 mt-2">No commission is set for this brief. Add it under Brief details.</p>
                )}

                {r.properties.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                    {r.properties.map((p) => (
                      <div key={p.id} className="flex flex-wrap justify-between items-center gap-2 text-sm">
                        <div>
                          <p className="font-semibold">{p.title}</p>
                          <p className="text-xs text-gray-500">
                            Client confirmed {day(p.client_confirmed_at)} ·{' '}
                            {p.seller_confirmed_at ? `Seller confirmed ${day(p.seller_confirmed_at)}` : 'Waiting for seller confirmation'}
                          </p>
                        </div>
                        {p.seller_confirmed_at ? (
                          <button
                            disabled={busy === p.id}
                            onClick={() => act(p.id, `/properties/${p.id}/seller-confirmation`, { confirmed: false })}
                            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
                          >
                            Undo
                          </button>
                        ) : (
                          <button
                            disabled={busy === p.id}
                            onClick={() => act(p.id, `/properties/${p.id}/seller-confirmation`, { confirmed: true })}
                            className="px-3 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg disabled:opacity-50"
                          >
                            Mark seller confirmed
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  {r.fee_status === 'due' && (
                    <button
                      disabled={busy === r.brief_id}
                      onClick={() => act(r.brief_id, `/briefs/${r.brief_id}/fee`, { action: 'mark_paid' })}
                      className="px-4 py-2 text-sm bg-green-600 text-white hover:bg-green-700 rounded-lg font-semibold disabled:opacity-50"
                    >
                      Mark as paid
                    </button>
                  )}
                  {r.fee_status === 'paid' && (
                    <button
                      disabled={busy === r.brief_id}
                      onClick={() => act(r.brief_id, `/briefs/${r.brief_id}/fee`, { action: 'undo_paid' })}
                      className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
                    >
                      Undo paid
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}