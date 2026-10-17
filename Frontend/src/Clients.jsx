import React, { useState, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import BriefPage from './BriefPage';
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

const STATUS_LABELS = {
  pending_approval: 'Pending approval',
  active: 'Active',
  on_hold: 'On hold',
  closed: 'Closed'
};
const STATUS_COLORS = {
  active: 'bg-green-100 text-green-800',
  pending_approval: 'bg-yellow-100 text-yellow-800',
  on_hold: 'bg-gray-100 text-gray-800',
  closed: 'bg-red-100 text-red-800'
};

const gbp = (n) =>
  n === null || n === undefined || n === '' ? '—' : `£${Number(n).toLocaleString()}`;

function Box({ children, className = '', onClick }) {
  return (
    <div onClick={onClick} className={`bg-white rounded-lg shadow p-5 ${className}`}>
      {children}
    </div>
  );
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

// ==================== CLIENTS LIST ====================
export default function ClientsPage({ token, isManager }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const call = makeCall(token);

  const load = async () => {
    try {
      setClients(await call('/clients'));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  if (selectedId) {
    return (
      <ClientDetail
        token={token}
        clientId={selectedId}
        isManager={isManager}
        onBack={() => {
          setSelectedId(null);
          load();
        }}
      />
    );
  }

  if (loading) return <p className="text-gray-500">Loading…</p>;

  const q = search.trim().toLowerCase();
  const shown = clients.filter(
    (c) =>
      !q ||
      `client ${c.client_number}`.includes(q) ||
      String(c.client_number) === q ||
      (c.name || '').toLowerCase().includes(q) ||
      (c.company_name || '').toLowerCase().includes(q)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-3 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by client number or name..."
            className={`${inputClass} pl-10`}
          />
        </div>
        {isManager && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
          >
            <Plus size={18} />
            <span>Add Client</span>
          </button>
        )}
      </div>

      {isManager && showForm && (
        <ClientForm
          call={call}
          onClose={() => setShowForm(false)}
          onSave={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {shown.length === 0 ? (
        <p className="text-gray-500">
          {isManager ? 'No clients yet. Click Add Client.' : 'No briefs have been assigned to you yet.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shown.map((c) => (
            <Box
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className="cursor-pointer hover:shadow-lg transition-shadow"
            >
              <h3 className="font-semibold text-lg text-gray-800">{c.name}</h3>
              {isManager && <p className="text-xs text-gray-500 mb-2">Client #{c.client_number}</p>}
              {isManager && c.company_name && (
                <p className="text-sm text-gray-600">🏢 {c.company_name}</p>
              )}
              <p className="text-sm text-gray-600 mt-2">
                Active briefs: <strong>{c.active_briefs}</strong>
              </p>
            </Box>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== ADD CLIENT (MANAGER) ====================
function ClientForm({ call, onClose, onSave }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', company_name: '', notes: '' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await call('/clients', { method: 'POST', body: JSON.stringify(form) });
      onSave();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Box>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Add Client</h2>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-800">✕</button>
      </div>
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input className={inputClass} placeholder="Full name *" value={form.name} onChange={set('name')} required />
        <input className={inputClass} placeholder="Company" value={form.company_name} onChange={set('company_name')} />
        <input className={inputClass} type="email" placeholder="Email" value={form.email} onChange={set('email')} />
        <input className={inputClass} placeholder="Phone" value={form.phone} onChange={set('phone')} />
        <textarea className={`${inputClass} md:col-span-2`} placeholder="Private notes (only you see these)" value={form.notes} onChange={set('notes')} />
        {error && <p className="text-red-600 text-sm md:col-span-2">{error}</p>}
        <button type="submit" className="md:col-span-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">
          Save Client
        </button>
      </form>
    </Box>
  );
}

// ==================== CLIENT DETAIL + BRIEFS ====================
function ClientDetail({ token, clientId, isManager, onBack }) {
  const [data, setData] = useState(null);
  const [team, setTeam] = useState([]);
  const [showBriefForm, setShowBriefForm] = useState(false);
  const [error, setError] = useState('');
  const call = makeCall(token);

  const load = async () => {
    try {
      setData(await call(`/clients/${clientId}`));
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
  }, [clientId]);

  const updateBrief = async (id, patch) => {
    setError('');
    try {
      await call(`/briefs/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      load();
    } catch (e) {
      setError(e.message);
    }
  };
  if (openBriefId) {
    return (
      <BriefPage
        token={token}
        briefId={openBriefId}
        isManager={isManager}
        onBack={() => {
          setOpenBriefId(null);
          load();
        }}
      />
    );
  }
  if (!data) return <p className="text-gray-500">{error || 'Loading…'}</p>;

  const { client, briefs } = data;
  const today = new Date(new Date().toDateString());

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-blue-600 hover:text-blue-800">
        ← Back to Clients
      </button>
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Box>
          <h2 className="text-2xl font-bold">{client.name}</h2>
          {isManager && <p className="text-sm text-gray-500 mb-4">Client #{client.client_number}</p>}
          {isManager && (
            <div className="space-y-3 text-sm mt-4">
              {client.company_name && <p>🏢 {client.company_name}</p>}
              {client.email && <p>📧 {client.email}</p>}
              {client.phone && <p>📱 {client.phone}</p>}
              {client.notes && <p className="text-gray-600 whitespace-pre-wrap">{client.notes}</p>}
            </div>
          )}
        </Box>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold">Briefs</h3>
            {isManager && (
              <button
                onClick={() => setShowBriefForm(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
              >
                <Plus size={18} />
                <span>Add Brief</span>
              </button>
            )}
          </div>

          {isManager && showBriefForm && (
            <BriefForm
              call={call}
              clientId={client.id}
              team={team}
              onClose={() => setShowBriefForm(false)}
              onSave={() => {
                setShowBriefForm(false);
                load();
              }}
            />
          )}

          {briefs.length === 0 && <p className="text-gray-500">No briefs yet.</p>}

          {briefs.map((b) => {
            const overdue = b.due_date && b.status === 'active' && new Date(b.due_date) < today;
            return (
              <Box key={b.id} className={overdue ? 'border-l-4 border-red-500' : ''}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-xs text-gray-500">Brief #{b.brief_number}</p>
                    <h4
                      className="font-semibold text-lg text-blue-600 hover:underline cursor-pointer"
                      onClick={() => setOpenBriefId(b.id)}
                    >
                      {b.title || 'Untitled brief'}
                    </h4>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${STATUS_COLORS[b.status] || ''}`}>
                    {STATUS_LABELS[b.status] || b.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div><p className="text-gray-500">Budget</p><p className="font-semibold">{gbp(b.price_min)} – {gbp(b.price_max)}</p></div>
                  <div><p className="text-gray-500">Beds / Baths / Cars</p><p className="font-semibold">{b.bedrooms ?? '—'} / {b.bathrooms ?? '—'} / {b.car_spaces ?? '—'}</p></div>
                  <div><p className="text-gray-500">Min plot size</p><p className="font-semibold">{b.min_plot_size ? `${b.min_plot_size} m²` : '—'}</p></div>
                  <div><p className="text-gray-500">Min yield</p><p className="font-semibold">{b.min_yield ? `${b.min_yield}%` : '—'}</p></div>
                  <div><p className="text-gray-500">Max age</p><p className="font-semibold">{b.max_property_age ? `${b.max_property_age} yrs` : '—'}</p></div>
                  <div>
                    <p className="text-gray-500">Due</p>
                    <p className={`font-semibold ${overdue ? 'text-red-600' : ''}`}>
                      {b.due_date ? new Date(b.due_date).toLocaleDateString() : '—'}
                      {overdue && ' (overdue)'}
                    </p>
                  </div>
                </div>

                {b.preferred_areas && <p className="text-sm mt-3"><span className="text-gray-500">Areas:</span> {b.preferred_areas}</p>}
                {b.notes && <p className="text-sm mt-1 text-gray-600 whitespace-pre-wrap">{b.notes}</p>}

                {isManager && (
                  <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500 mb-1">Assigned to</p>
                      <select
                        className={inputClass}
                        value={b.assigned_to || ''}
                        onChange={(e) => updateBrief(b.id, { assigned_to: e.target.value })}
                      >
                        <option value="">Unassigned</option>
                        {team.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">Status</p>
                      <select
                        className={inputClass}
                        value={b.status}
                        onChange={(e) => updateBrief(b.id, { status: e.target.value })}
                      >
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">Your commission</p>
                      <p className="font-semibold">{gbp(b.commission_amount)}</p>
                      <p className="text-xs text-gray-500">Fee: {b.fee_status.replace('_', ' ')}</p>
                    </div>
                  </div>
                )}
              </Box>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ==================== ADD BRIEF (MANAGER) ====================
const BRIEF_INPUTS = [
  ['title', 'Brief title (e.g. 4-bed houses in Victoria)', 'text'],
  ['property_type', 'Property type', 'text'],
  ['price_min', 'Minimum price (£)', 'number'],
  ['price_max', 'Maximum price (£)', 'number'],
  ['min_plot_size', 'Minimum plot size (m²)', 'number'],
  ['min_yield', 'Minimum yield (%)', 'number'],
  ['bedrooms', 'Bedrooms', 'number'],
  ['bathrooms', 'Bathrooms', 'number'],
  ['car_spaces', 'Car spaces', 'number'],
  ['max_property_age', 'Maximum property age (years)', 'number'],
  ['due_date', 'Due date', 'date'],
  ['commission_amount', 'Your commission for this brief (£)', 'number']
];

function BriefForm({ call, clientId, team, onClose, onSave }) {
  const [form, setForm] = useState({ preferred_areas: '', notes: '', assigned_to: '' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await call('/briefs', {
        method: 'POST',
        body: JSON.stringify({ ...form, client_id: clientId })
      });
      onSave();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Box>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Add Brief</h2>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-800">✕</button>
      </div>
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {BRIEF_INPUTS.map(([key, label, type]) => (
          <div key={key}>
            <label className="text-xs text-gray-600">{label}</label>
            <input className={inputClass} type={type} value={form[key] || ''} onChange={set(key)} />
          </div>
        ))}
        <div className="md:col-span-2">
          <label className="text-xs text-gray-600">Preferred areas</label>
          <input className={inputClass} value={form.preferred_areas} onChange={set('preferred_areas')} />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-gray-600">Notes</label>
          <textarea className={inputClass} value={form.notes} onChange={set('notes')} />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-gray-600">Assign to employee</label>
          <select className={inputClass} value={form.assigned_to} onChange={set('assigned_to')}>
            <option value="">Unassigned</option>
            {team.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        {error && <p className="text-red-600 text-sm md:col-span-2">{error}</p>}
        <button type="submit" className="md:col-span-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">
          Save Brief
        </button>
      </form>
    </Box>
  );
}