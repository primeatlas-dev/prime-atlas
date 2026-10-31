import React, { useState, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import PropertyPage from './PropertyPage';
import ClustersTab from './ClustersTab';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

const BRIEF_STATUS = {
  pending_approval: ['Pending approval', 'bg-yellow-100 text-yellow-800'],
  active: ['Active', 'bg-green-100 text-green-800'],
  on_hold: ['On hold', 'bg-gray-100 text-gray-800'],
  closed: ['Closed', 'bg-red-100 text-red-800']
};

const APPROVAL = {
  review: ['Review', 'bg-yellow-100 text-yellow-800'],
  approved: ['Approved', 'bg-green-100 text-green-800'],
  rejected: ['Rejected', 'bg-red-100 text-red-800']
};

const DECISION = {
  interested: ['Client interested', 'bg-blue-600 text-white'],
  confirmed: ['Client confirmed', 'bg-green-600 text-white']
};

const gbp = (n) =>
  n === null || n === undefined || n === '' ? '—' : `£${Number(n).toLocaleString()}`;

function Box({ children, className = '' }) {
  return <div className={`bg-white rounded-lg shadow p-5 ${className}`}>{children}</div>;
}

function makeCall(token) {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  return async (path, options = {}) => {
    const res = await fetch(`${API_URL}${path}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  };
}

// ==================== BRIEF PAGE ====================
export default function BriefPage({ token, briefId, isManager, onBack }) {
  const [data, setData] = useState(null);
  const [team, setTeam] = useState([]);
  const [tab, setTab] = useState('properties');
  const [openPropertyId, setOpenPropertyId] = useState(null);
  const [error, setError] = useState('');
  const call = makeCall(token);

  const load = async () => {
    try {
      setData(await call(`/briefs/${briefId}`));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
    if (isManager) {
      call('/team')
        .then((t) => setTeam(t.filter((m) => m.role === 'employee' && m.active)))
        .catch(() => {});
    }
  }, [briefId]);

  if (openPropertyId) {
    return (
      <PropertyPage
        token={token}
        propertyId={openPropertyId}
        isManager={isManager}
        onBack={() => {
          setOpenPropertyId(null);
          load();
        }}
      />
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-blue-600 hover:text-blue-800">← Back</button>
        <p className="text-gray-500">{error || 'Loading…'}</p>
      </div>
    );
  }

  const { brief, client, properties } = data;
  const pendingBrief = brief.status === 'pending_approval';
  const activeTab = pendingBrief ? 'details' : tab;
  const [statusLabel, statusClass] = BRIEF_STATUS[brief.status] || [brief.status, ''];

  const approve = async () => {
    try {
      await call(`/briefs/${brief.id}/approve`, { method: 'POST' });
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const decline = async () => {
    if (!window.confirm('Decline this brief? It will be closed.')) return;
    try {
      await call(`/briefs/${brief.id}/decline`, { method: 'POST' });
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const tabClass = (name) =>
    `px-4 py-2 font-semibold border-b-2 ${
      activeTab === name ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'
    }`;

  const chip = 'px-3 py-1 bg-white rounded-lg shadow text-sm';

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-blue-600 hover:text-blue-800">
        ← Back
      </button>

      <div className="flex flex-wrap justify-between items-start gap-3">
        <div>
          <p className="text-sm text-gray-500">
            {isManager ? `${client.name} · Client #${client.client_number}` : client.name} · Brief #{brief.brief_number}
          </p>
          <h2 className="text-2xl font-bold">{brief.title || 'Untitled brief'}</h2>
        </div>
        <span className={`px-3 py-1 rounded text-sm font-semibold ${statusClass}`}>{statusLabel}</span>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {pendingBrief && isManager && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-yellow-900">
            This search was submitted by the client. Check the requirements (you can change them with Edit Brief),
            then approve it. Approving makes it active so you can assign it to an employee.
          </p>
          <div className="flex gap-2">
            <button onClick={approve} className="px-4 py-2 text-sm bg-green-600 text-white hover:bg-green-700 rounded-lg font-semibold">
              Approve
            </button>
            <button onClick={decline} className="px-4 py-2 text-sm bg-red-50 text-red-600 hover:bg-red-100 rounded-lg font-semibold">
              Decline
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <span className={chip}>💰 {gbp(brief.price_min)} – {gbp(brief.price_max)}</span>
        <span className={chip}>🛏 {brief.bedrooms ?? '—'} · 🛁 {brief.bathrooms ?? '—'} · 🚗 {brief.car_spaces ?? '—'}</span>
        {brief.min_plot_size && <span className={chip}>📐 min {brief.min_plot_size} m²</span>}
        {brief.min_yield && <span className={chip}>📈 min yield {brief.min_yield}%</span>}
        {brief.max_property_age && <span className={chip}>🏠 max {brief.max_property_age} yrs old</span>}
      </div>

      <div className="flex space-x-2 border-b border-gray-200">
        {!pendingBrief && (
          <>
            <button className={tabClass('properties')} onClick={() => setTab('properties')}>
              Properties ({properties.length})
            </button>
            <button className={tabClass('clusters')} onClick={() => setTab('clusters')}>
              Clusters
            </button>
          </>
        )}
        <button className={tabClass('details')} onClick={() => setTab('details')}>
          Brief details
        </button>
      </div>

      {activeTab === 'properties' && (
        <PropertiesTab
          call={call}
          brief={brief}
          client={client}
          properties={properties}
          isManager={isManager}
          reload={load}
          onOpen={setOpenPropertyId}
        />
      )}
      {activeTab === 'clusters' && <ClustersTab call={call} brief={brief} client={client} isManager={isManager} />}
      {activeTab === 'details' && (
        <DetailsTab call={call} brief={brief} team={team} isManager={isManager} reload={load} />
      )}
    </div>
  );
}

// ==================== PROPERTIES INSIDE THE BRIEF ====================
function PropertiesTab({ call, brief, client, properties, isManager, reload, onOpen }) {
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const decide = async (p, action) => {
    setError('');
    try {
      await call(`/properties/${p.id}/decision`, { method: 'POST', body: JSON.stringify({ action }) });
      reload();
    } catch (e) {
      setError(e.message);
    }
  };

  const q = search.trim().toLowerCase();
  const shown = properties.filter(
    (p) =>
      (filter === 'all' || p.approval_status === filter) &&
      (!q ||
        (p.property_title || '').toLowerCase().includes(q) ||
        (p.address || '').toLowerCase().includes(q) ||
        (p.region || '').toLowerCase().includes(q))
  );

  const filters = [
    ['all', 'All'],
    ['review', 'Review'],
    ['approved', 'Approved'],
    ['rejected', 'Rejected']
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={18} className="absolute left-3 top-3 text-gray-400" />
          <input
            className={`${inputClass} pl-10`}
            placeholder="Search by title, address or suburb..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
        >
          <Plus size={18} />
          <span>Add Property</span>
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`px-3 py-1 rounded-lg text-sm font-semibold ${
              filter === value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {showForm && (
        <PropertyForm
          call={call}
          briefId={brief.id}
          onClose={() => setShowForm(false)}
          onSave={(created) => {
            setShowForm(false);
            reload();
            onOpen(created.id);
          }}
        />
      )}

      {shown.length === 0 ? (
        <p className="text-gray-500">
          {properties.length === 0 ? 'No properties for this brief yet.' : 'No properties match this view.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shown.map((p) => (
            <PropertyCard
              key={p.id}
              p={p}
              brief={brief}
              client={client}
              isManager={isManager}
              onOpen={onOpen}
              decide={decide}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PropertyCard({ p, brief, client, isManager, onOpen, decide }) {
  const [label, cls] = APPROVAL[p.approval_status] || [p.approval_status, ''];
  const decision = DECISION[p.client_decision];

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col">
      <div className="relative cursor-pointer" onClick={() => onOpen(p.id)}>
        {p.cover_url ? (
          <img src={p.cover_url} alt="" className="w-full h-44 object-cover" />
        ) : (
          <div className="h-44 bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
            No cover photo yet
          </div>
        )}
        <span className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-semibold ${cls}`}>{label}</span>
        {p.client_decision === 'rejected' && (
          <span
            title="Client rejected this property"
            className="absolute top-2 left-2 w-7 h-7 rounded-full bg-red-600 text-white text-sm flex items-center justify-center shadow"
          >
            ✕
          </span>
        )}
        {decision && (
          <span className={`absolute bottom-2 left-2 px-2 py-1 rounded text-xs font-semibold ${decision[1]}`}>
            {decision[0]}
          </span>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col gap-2">
        <h3
          onClick={() => onOpen(p.id)}
          className="font-semibold text-blue-600 hover:underline cursor-pointer"
        >
          {p.property_title}
        </h3>
        <p className={`text-xs italic ${p.viewed_at ? 'text-green-600' : 'text-gray-400'}`}>
          {p.viewed_at ? 'viewed by client' : 'not viewed'}
        </p>
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
        <p className="text-xs text-gray-500">
          👤 Client {client.client_number} · Brief #{brief.brief_number}
        </p>

        {p.client_comment && (
          <div className="p-2 bg-gray-50 border border-gray-200 rounded text-sm">
            <p className="text-xs font-semibold text-gray-600">Client comment:</p>
            <p>{p.client_comment}</p>
          </div>
        )}

        <div className="mt-auto pt-2 space-y-2">
          <button
            onClick={() => onOpen(p.id)}
            className="w-full px-3 py-2 text-sm border border-blue-600 text-blue-600 hover:bg-blue-50 rounded-lg"
          >
            View
          </button>
          {isManager && (
            <div className="flex flex-wrap gap-2">
              {p.approval_status !== 'approved' && (
                <button onClick={() => decide(p, 'approve')} className="px-3 py-1 text-sm bg-green-600 text-white hover:bg-green-700 rounded-lg">
                  Approve
                </button>
              )}
              {p.approval_status !== 'rejected' && (
                <button onClick={() => decide(p, 'reject')} className="px-3 py-1 text-sm bg-red-50 text-red-600 hover:bg-red-100 rounded-lg">
                  Reject
                </button>
              )}
              {p.approval_status !== 'review' && (
                <button onClick={() => decide(p, 'review')} className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg">
                  Back to review
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Quick form: the basics only. Everything else is filled in on the property page.
const QUICK_INPUTS = [
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

function PropertyForm({ call, briefId, onClose, onSave }) {
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const created = await call(`/briefs/${briefId}/properties`, {
        method: 'POST',
        body: JSON.stringify(form)
      });
      onSave(created);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Box>
      <div className="flex justify-between items-center mb-1">
        <h2 className="text-xl font-bold">Add Property</h2>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-800">✕</button>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Start with the basics. After saving, the full property page opens so you can add photos and the rest of the details.
      </p>
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {QUICK_INPUTS.map(([key, label, type]) => (
          <div key={key}>
            <label className="text-xs text-gray-600">{label}</label>
            <input className={inputClass} type={type} value={form[key] ?? ''} onChange={set(key)} />
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

// ==================== BRIEF DETAILS (MANAGER CAN EDIT) ====================
const BRIEF_INPUTS = [
  ['title', 'Brief title', 'text'],
  ['property_type', 'Property type', 'text'],
  ['price_min', 'Minimum price (£)', 'number'],
  ['price_max', 'Maximum price (£)', 'number'],
  ['min_plot_size', 'Minimum plot size (m²)', 'number'],
  ['min_yield', 'Minimum yield (%)', 'number'],
  ['bedrooms', 'Bedrooms', 'number'],
  ['bathrooms', 'Bathrooms', 'number'],
  ['car_spaces', 'Car spaces', 'number'],
  ['max_property_age', 'Maximum property age (years)', 'number'],
  ['due_date', 'Due date', 'date']
];

// Fields from the client's long brief form
const EXTRA_FIELDS = [
  ['rent_pw_min', 'Expected weekly rent, from (£)', 'number'],
  ['rent_pw_max', 'Expected weekly rent, to (£)', 'number'],
  ['preferred_states', 'Preferred states / regions', 'text'],
  ['exclusions', 'Non-negotiable exclusions', 'textarea'],
  ['power_line_distance', 'Distance from high-voltage power lines', 'text'],
  ['cemetery_distance', 'Distance from cemeteries', 'text'],
  ['other_mandatory_criteria', 'Other mandatory criteria', 'textarea'],
  ['must_haves', 'Must have', 'textarea'],
  ['must_avoids', 'Must avoid', 'textarea'],
  ['rejected_properties', 'Properties already rejected', 'textarea'],
  ['liked_missed_properties', 'Properties liked but missed', 'textarea']
];
const RENT_KEYS = ['rent_pw_min', 'rent_pw_max'];

function DetailsTab({ call, brief, team, isManager, reload }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const pending = brief.status === 'pending_approval';

  const startEdit = () => {
    setForm({ ...brief });
    setError('');
    setEditing(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setError('');
    const keys = [
      ...BRIEF_INPUTS.map(([k]) => k),
      ...EXTRA_FIELDS.map(([k]) => k),
      'preferred_areas', 'notes', 'commission_amount'
    ];
    // A pending brief can only be changed by approving or declining it
    if (!pending) keys.push('status', 'assigned_to');
    const payload = {};
    keys.forEach((k) => {
      payload[k] = form[k] ?? '';
    });
    try {
      await call(`/briefs/${brief.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      setEditing(false);
      reload();
    } catch (err) {
      setError(err.message);
    }
  };

  if (editing) {
    return (
      <Box>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Edit Brief</h2>
          <button onClick={() => setEditing(false)} className="text-gray-600 hover:text-gray-800">✕</button>
        </div>
        <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {BRIEF_INPUTS.map(([key, label, type]) => (
            <div key={key}>
              <label className="text-xs text-gray-600">{label}</label>
              <input className={inputClass} type={type} value={form[key] ?? ''} onChange={set(key)} />
            </div>
          ))}
          <div>
            <label className="text-xs text-gray-600">Your commission (£)</label>
            <input className={inputClass} type="number" value={form.commission_amount ?? ''} onChange={set('commission_amount')} />
          </div>

          {!pending ? (
            <>
              <div>
                <label className="text-xs text-gray-600">Status</label>
                <select className={inputClass} value={form.status} onChange={set('status')}>
                  {Object.entries(BRIEF_STATUS)
                    .filter(([value]) => value !== 'pending_approval')
                    .map(([value, [label]]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600">Assigned to</label>
                <select className={inputClass} value={form.assigned_to ?? ''} onChange={set('assigned_to')}>
                  <option value="">Unassigned</option>
                  {team.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <p className="md:col-span-2 text-sm text-yellow-800 bg-yellow-50 rounded-lg p-3">
              Status and assignment unlock once you approve this brief.
            </p>
          )}

          <div className="md:col-span-2">
            <label className="text-xs text-gray-600">Preferred areas / suburbs</label>
            <input className={inputClass} value={form.preferred_areas ?? ''} onChange={set('preferred_areas')} />
          </div>

          {EXTRA_FIELDS.map(([key, label, type]) => (
            <div key={key} className={type === 'textarea' ? 'md:col-span-2' : ''}>
              <label className="text-xs text-gray-600">{label}</label>
              {type === 'textarea' ? (
                <textarea className={inputClass} rows={3} value={form[key] ?? ''} onChange={set(key)} />
              ) : (
                <input className={inputClass} type={type} step={type === 'number' ? 'any' : undefined} value={form[key] ?? ''} onChange={set(key)} />
              )}
            </div>
          ))}

          <div className="md:col-span-2">
            <label className="text-xs text-gray-600">Private notes</label>
            <textarea className={inputClass} value={form.notes ?? ''} onChange={set('notes')} />
          </div>
          {error && <p className="text-red-600 text-sm md:col-span-2">{error}</p>}
          <button type="submit" className="md:col-span-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">
            Save Changes
          </button>
        </form>
      </Box>
    );
  }

  const overdue = brief.due_date && brief.status === 'active' && new Date(brief.due_date) < new Date(new Date().toDateString());
  const extras = EXTRA_FIELDS.filter(([key]) => brief[key] !== null && brief[key] !== undefined && brief[key] !== '');

  return (
    <Box>
      {isManager && (
        <div className="flex justify-end mb-4">
          <button onClick={startEdit} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-semibold">
            Edit Brief
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        <div><p className="text-gray-500">Budget</p><p className="font-semibold">{gbp(brief.price_min)} – {gbp(brief.price_max)}</p></div>
        <div><p className="text-gray-500">Property type</p><p className="font-semibold">{brief.property_type || '—'}</p></div>
        <div><p className="text-gray-500">Beds / Baths / Cars</p><p className="font-semibold">{brief.bedrooms ?? '—'} / {brief.bathrooms ?? '—'} / {brief.car_spaces ?? '—'}</p></div>
        <div><p className="text-gray-500">Min plot size</p><p className="font-semibold">{brief.min_plot_size ? `${brief.min_plot_size} m²` : '—'}</p></div>
        <div><p className="text-gray-500">Min yield</p><p className="font-semibold">{brief.min_yield ? `${brief.min_yield}%` : '—'}</p></div>
        <div><p className="text-gray-500">Max property age</p><p className="font-semibold">{brief.max_property_age ? `${brief.max_property_age} yrs` : '—'}</p></div>
        <div>
          <p className="text-gray-500">Due date</p>
          <p className={`font-semibold ${overdue ? 'text-red-600' : ''}`}>
            {brief.due_date ? new Date(brief.due_date).toLocaleDateString() : '—'}
            {overdue && ' (overdue)'}
          </p>
        </div>
        {isManager && (
          <>
            <div>
              <p className="text-gray-500">Assigned to</p>
              <p className="font-semibold">{pending ? 'Approve first' : brief.assigned_name || 'Unassigned'}</p>
            </div>
            <div>
              <p className="text-gray-500">Your commission</p>
              <p className="font-semibold">{gbp(brief.commission_amount)}</p>
              <p className="text-xs text-gray-500">Fee: {(brief.fee_status || '').replace('_', ' ')}</p>
            </div>
          </>
        )}
      </div>

      {brief.preferred_areas && (
        <p className="text-sm mt-4"><span className="text-gray-500">Areas / suburbs:</span> {brief.preferred_areas}</p>
      )}

      {extras.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 pt-5 border-t border-gray-100 text-sm">
          {extras.map(([key, label, type]) => (
            <div key={key} className={type === 'textarea' ? 'md:col-span-2' : ''}>
              <p className="text-gray-500">{label}</p>
              <p className="font-semibold whitespace-pre-wrap">
                {RENT_KEYS.includes(key) ? gbp(brief[key]) : brief[key]}
              </p>
            </div>
          ))}
        </div>
      )}

      {brief.notes && <p className="text-sm mt-4 text-gray-600 whitespace-pre-wrap">{brief.notes}</p>}
    </Box>
  );
}