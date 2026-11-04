import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search } from 'lucide-react';
import { makeCall } from './api';
import PropertyPage from './PropertyPage';

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

const gbp = (n) =>
  n === null || n === undefined || n === '' ? '—' : `£${Number(n).toLocaleString()}`;

const APPROVAL = {
  review: ['Review', 'bg-yellow-100 text-yellow-800'],
  approved: ['Approved', 'bg-green-100 text-green-800'],
  rejected: ['Rejected', 'bg-red-100 text-red-800']
};
const DECISION_CHIP = {
  interested: ['Client interested', 'bg-blue-600 text-white'],
  confirmed: ['Client confirmed', 'bg-green-600 text-white']
};

const STATUS_OPTIONS = [
  ['all', 'All statuses'],
  ['review', 'Review'],
  ['approved', 'Approved'],
  ['rejected', 'Rejected'],
  ['pool', 'Not in a brief']
];
const DECISION_OPTIONS = [
  ['all', 'Any client decision'],
  ['pending', 'Awaiting client'],
  ['interested', 'Interested'],
  ['rejected', 'Rejected by client'],
  ['confirmed', 'Confirmed']
];
const PERIOD_OPTIONS = [
  ['all', 'All time'],
  ['7', 'Last 7 days'],
  ['30', 'Last 30 days'],
  ['90', 'Last 90 days']
];

const POOL_INPUTS = [
  ['property_title', 'Property title *', 'text'],
  ['address', 'Address *', 'text'],
  ['region', 'Suburb / region', 'text'],
  ['source', 'Source (e.g. Pre-market)', 'text'],
  ['price', 'Price, or price from (£)', 'number'],
  ['price_max', 'Price to (£, optional)', 'number'],
  ['bedrooms', 'Bedrooms', 'number'],
  ['bathrooms', 'Bathrooms', 'number'],
  ['car_parking', 'Car spaces', 'number'],
  ['plot_size', 'Plot size (m²)', 'number'],
  ['selling_agent_name', 'Selling agent name', 'text'],
  ['selling_agent_phone', 'Selling agent phone', 'text']
];

function Box({ children, className = '' }) {
  return <div className={`bg-white rounded-lg shadow p-5 ${className}`}>{children}</div>;
}

export default function AllProperties({ token, isManager, initialFilters }) {
  const call = useMemo(() => makeCall(token), [token]);
  const [f, setF] = useState({ status: 'all', decision: 'all', period: 'all', ...(initialFilters || {}) });
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState((initialFilters && initialFilters.propertyId) || null);
  const [showAdd, setShowAdd] = useState(false);
  const [assigning, setAssigning] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(text.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [text]);

  const load = async () => {
    const params = new URLSearchParams({
      page: String(page),
      status: f.status,
      decision: f.decision,
      period: f.period,
      search
    });
    try {
      setData(await call(`/all-properties?${params.toString()}`));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
  }, [page, f.status, f.decision, f.period, search]);

  if (openId) {
    return (
      <PropertyPage
        token={token}
        propertyId={openId}
        isManager={isManager}
        onBack={() => {
          setOpenId(null);
          load();
        }}
      />
    );
  }

  const setFilter = (key) => (e) => {
    setF({ ...f, [key]: e.target.value });
    setPage(1);
  };

  const reset = () => {
    setF({ status: 'all', decision: 'all', period: 'all' });
    setText('');
    setSearch('');
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={18} className="absolute left-3 top-3 text-gray-400" />
          <input
            className={`${inputClass} pl-10`}
            placeholder="Search by title, address or suburb..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
        >
          <Plus size={18} />
          <span>Add to pool</span>
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select className="px-3 py-2 border border-gray-300 rounded-lg" value={f.status} onChange={setFilter('status')}>
          {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className="px-3 py-2 border border-gray-300 rounded-lg" value={f.decision} onChange={setFilter('decision')}>
          {DECISION_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className="px-3 py-2 border border-gray-300 rounded-lg" value={f.period} onChange={setFilter('period')}>
          {PERIOD_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button onClick={reset} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm">
          Reset filters
        </button>
      </div>

      {notice && <p className="text-green-700 text-sm bg-green-50 rounded-lg p-3">{notice}</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {showAdd && (
        <PoolForm
          call={call}
          onClose={() => setShowAdd(false)}
          onSave={(created) => {
            setShowAdd(false);
            setOpenId(created.id);
          }}
        />
      )}

      {assigning && (
        <AssignModal
          call={call}
          property={assigning}
          onClose={() => setAssigning(null)}
          onDone={() => {
            setAssigning(null);
            setNotice('Property assigned. It starts in Review, ready for approval.');
            load();
          }}
        />
      )}

      {!data ? (
        <p className="text-gray-500">Loading…</p>
      ) : data.items.length === 0 ? (
        <p className="text-gray-500">No properties match these filters.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.items.map((p) => (
              <PropertyCard key={p.id} p={p} isManager={isManager} onOpen={setOpenId} onAssign={setAssigning} />
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-gray-500">
              Page {data.page} of {data.pages} · {data.total} {data.total === 1 ? 'property' : 'properties'}
            </p>
            <div className="flex gap-2">
              <button
                disabled={data.page <= 1}
                onClick={() => setPage(data.page - 1)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-40"
              >
                ← Previous
              </button>
              <button
                disabled={data.page >= data.pages}
                onClick={() => setPage(data.page + 1)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function PropertyCard({ p, isManager, onOpen, onAssign }) {
  const [label, cls] = p.in_pool
    ? ['Not in a brief', 'bg-gray-100 text-gray-800']
    : APPROVAL[p.approval_status] || [p.approval_status, ''];
  const chip = !p.in_pool ? DECISION_CHIP[p.client_decision] : null;

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col">
      <div className="relative cursor-pointer" onClick={() => onOpen(p.id)}>
        {p.cover_url ? (
          <img src={p.cover_url} alt="" className="w-full h-44 object-cover" />
        ) : (
          <div className="h-44 bg-gray-100 flex items-center justify-center text-gray-400 text-sm">No cover photo yet</div>
        )}
        <span className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-semibold ${cls}`}>{label}</span>
        {!p.in_pool && p.client_decision === 'rejected' && (
          <span
            title="Client rejected this property"
            className="absolute top-2 left-2 w-7 h-7 rounded-full bg-red-600 text-white text-sm flex items-center justify-center shadow"
          >
            ✕
          </span>
        )}
        {chip && (
          <span className={`absolute bottom-2 left-2 px-2 py-1 rounded text-xs font-semibold ${chip[1]}`}>{chip[0]}</span>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col gap-2">
        <h3 onClick={() => onOpen(p.id)} className="font-semibold text-blue-600 hover:underline cursor-pointer">
          {p.property_title}
        </h3>
        <p className="text-sm text-gray-600">📍 {p.address}</p>
        {!p.in_pool && (
          <p className={`text-xs italic ${p.viewed_at ? 'text-green-600' : 'text-gray-400'}`}>
            {p.viewed_at ? 'viewed by client' : 'not viewed'}
          </p>
        )}
        <p className="font-semibold">
          {gbp(p.price)}
          {p.price_max ? ` – ${gbp(p.price_max)}` : ''}
        </p>

        <div className="grid grid-cols-4 text-center text-sm text-gray-700 border-y border-gray-100 py-2">
          <div><p>🛏</p><p className="font-semibold">{p.bedrooms ?? '—'}</p></div>
          <div><p>🛁</p><p className="font-semibold">{p.bathrooms ?? '—'}</p></div>
          <div><p>🚗</p><p className="font-semibold">{p.car_parking ?? '—'}</p></div>
          <div><p>📐</p><p className="font-semibold">{p.plot_size ? `${p.plot_size} m²` : '—'}</p></div>
        </div>

        <p className="font-semibold underline text-sm">{p.source || 'Source not set'}</p>
        <p className="text-xs text-gray-500">🕒 {new Date(p.created_at).toLocaleString()}</p>
        {p.added_by && <p className="text-xs text-gray-500">Added by {p.added_by}</p>}
        {p.brief && (
          <p className="text-xs text-gray-500">
            👤 {p.brief.client_label} · Brief #{p.brief.brief_number}
          </p>
        )}

        <div className="mt-auto pt-2 flex gap-2">
          <button
            onClick={() => onOpen(p.id)}
            className="flex-1 px-3 py-2 text-sm border border-blue-600 text-blue-600 hover:bg-blue-50 rounded-lg"
          >
            View
          </button>
          {p.in_pool && (
            <button
              onClick={() => onAssign(p)}
              className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
            >
              Assign to brief
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AssignModal({ call, property, onClose, onDone }) {
  const [briefs, setBriefs] = useState(null);
  const [briefId, setBriefId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    call('/assignable-briefs')
      .then(setBriefs)
      .catch((e) => setError(e.message));
  }, [call]);

  const submit = async () => {
    if (!briefId) {
      setError('Choose a brief first');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await call(`/properties/${property.id}/assign`, { method: 'POST', body: JSON.stringify({ brief_id: briefId }) });
      onDone();
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-30 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-bold mb-1">Assign to brief</h3>
        <p className="text-sm text-gray-600 mb-4">{property.property_title}</p>

        {!briefs ? (
          <p className="text-gray-500 text-sm">{error || 'Loading…'}</p>
        ) : briefs.length === 0 ? (
          <p className="text-sm text-gray-600">There are no active briefs you can assign this to.</p>
        ) : (
          <select className={inputClass} value={briefId} onChange={(e) => setBriefId(e.target.value)}>
            <option value="">Choose a brief…</option>
            {briefs.map((b) => (
              <option key={b.id} value={b.id}>
                {b.client_label} · Brief #{b.brief_number}
                {b.title ? ` · ${b.title}` : ''}
              </option>
            ))}
          </select>
        )}

        <p className="text-xs text-gray-500 mt-3">
          Once assigned, the property starts in Review. The manager approves it before the client can see it.
        </p>
        {error && briefs && <p className="text-red-600 text-sm mt-2">{error}</p>}

        <div className="flex gap-2 mt-4">
          <button
            onClick={submit}
            disabled={saving || !briefs || briefs.length === 0}
            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg disabled:opacity-50"
          >
            Assign
          </button>
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function PoolForm({ call, onClose, onSave }) {
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const created = await call('/pool-properties', { method: 'POST', body: JSON.stringify(form) });
      onSave(created);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Box>
      <div className="flex justify-between items-center mb-1">
        <h2 className="text-xl font-bold">Add property to the pool</h2>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-800">✕</button>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        A pool property is not in any brief yet. After saving, add photos and details, then assign it to a brief.
      </p>
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {POOL_INPUTS.map(([key, label, type]) => (
          <div key={key}>
            <label className="text-xs text-gray-600">{label}</label>
            <input className={inputClass} type={type} step={type === 'number' ? 'any' : undefined} value={form[key] ?? ''} onChange={set(key)} />
          </div>
        ))}
        {error && <p className="text-red-600 text-sm md:col-span-2">{error}</p>}
        <button type="submit" className="md:col-span-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">
          Save and continue
        </button>
      </form>
    </Box>
  );
}