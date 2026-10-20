import React, { useState, useEffect, useMemo } from 'react';
import { SECTIONS, AGENT_FIELDS, FieldView, gbp } from './PropertyPage';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const BRIEF_STATUS = {
  active: ['Active', 'bg-green-100 text-green-800'],
  on_hold: ['On hold', 'bg-gray-100 text-gray-800'],
  closed: ['Closed', 'bg-red-100 text-red-800']
};

const DECISION = {
  pending: ['Awaiting your decision', 'bg-gray-100 text-gray-800'],
  interested: ['Interested', 'bg-blue-100 text-blue-800'],
  rejected: ['Not for me', 'bg-red-100 text-red-800'],
  confirmed: ['Confirmed', 'bg-green-100 text-green-800']
};

const money = (n) => (n === null || n === undefined || n === '' ? '—' : gbp(n));
const hasValue = (p, spec) => p[spec.key] !== null && p[spec.key] !== undefined && p[spec.key] !== '';

function makeCall(token) {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  return async (path, options = {}) => {
    const res = await fetch(`${API_URL}${path}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  };
}

function Box({ children, className = '', onClick }) {
  return (
    <div onClick={onClick} className={`bg-white rounded-lg shadow p-5 ${className}`}>
      {children}
    </div>
  );
}

function Item({ label, value }) {
  return (
    <div>
      <p className="text-gray-500 text-xs">{label}</p>
      <p className="font-semibold text-sm text-gray-800">{value}</p>
    </div>
  );
}

// ==================== PORTAL SHELL ====================
export default function ClientPortal({ token, user, onLogout }) {
  const call = useMemo(() => makeCall(token), [token]);
  const [view, setView] = useState({ page: 'briefs' });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-blue-900 to-blue-800 text-white px-6 py-4 flex justify-between items-center">
        <div
          className="text-2xl font-bold cursor-pointer"
          onClick={() => setView({ page: 'briefs' })}
        >
          Prime Atlas
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-blue-100">{user?.name}</span>
          <button onClick={onLogout} className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-sm">
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        {view.page === 'briefs' && (
          <BriefList call={call} onOpen={(id) => setView({ page: 'brief', id })} />
        )}
        {view.page === 'brief' && (
          <ClientBrief
            call={call}
            briefId={view.id}
            onBack={() => setView({ page: 'briefs' })}
            onOpen={(id) => setView({ page: 'property', id, briefId: view.id })}
          />
        )}
        {view.page === 'property' && (
          <ClientProperty
            call={call}
            propertyId={view.id}
            onBack={() => setView({ page: 'brief', id: view.briefId })}
          />
        )}
      </main>
    </div>
  );
}

// ==================== MY SEARCHES ====================
function BriefList({ call, onOpen }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    call('/portal/briefs').then(setData).catch((e) => setError(e.message));
  }, [call]);

  if (!data) return <p className="text-gray-500">{error || 'Loading…'}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Welcome, {data.client.name}</h1>
        <p className="text-gray-600">Your searches, and the properties we have found for you.</p>
      </div>

      {data.briefs.length === 0 ? (
        <Box>
          <p className="text-gray-600">
            Your first search is being set up. You will see it here as soon as it is ready.
          </p>
        </Box>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.briefs.map((b) => {
            const [label, cls] = BRIEF_STATUS[b.status] || [b.status, ''];
            return (
              <Box key={b.id} onClick={() => onOpen(b.id)} className="cursor-pointer hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-lg text-blue-600">{b.title || 'Your property search'}</h3>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${cls}`}>{label}</span>
                </div>
                <p className="text-sm text-gray-600 mb-1">
                  Budget: <strong>{money(b.price_min)} – {money(b.price_max)}</strong>
                </p>
                {b.preferred_areas && <p className="text-sm text-gray-600 mb-3">Areas: {b.preferred_areas}</p>}
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-1 bg-gray-100 rounded">{b.property_count} properties</span>
                  {b.new_count > 0 && (
                    <span className="px-2 py-1 bg-blue-600 text-white rounded">{b.new_count} new</span>
                  )}
                  {b.awaiting_count > 0 && (
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                      {b.awaiting_count} awaiting your decision
                    </span>
                  )}
                </div>
              </Box>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ==================== ONE SEARCH + ITS PROPERTIES ====================
function ClientBrief({ call, briefId, onBack, onOpen }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    call(`/portal/briefs/${briefId}`).then(setData).catch((e) => setError(e.message));
  }, [call, briefId]);

  if (!data) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-blue-600 hover:text-blue-800">← Back</button>
        <p className="text-gray-500">{error || 'Loading…'}</p>
      </div>
    );
  }

  const { brief, properties } = data;
  const shown = properties.filter((p) => filter === 'all' || p.client_decision === filter);
  const filters = [
    ['all', 'All'],
    ['pending', 'Awaiting your decision'],
    ['interested', 'Interested'],
    ['rejected', 'Not for me'],
    ['confirmed', 'Confirmed']
  ];

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-blue-600 hover:text-blue-800">← Back to your searches</button>
      <h2 className="text-2xl font-bold">{brief.title || 'Your property search'}</h2>

      <Box>
        <p className="font-semibold mb-3">Your requirements</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Item label="Budget" value={`${money(brief.price_min)} – ${money(brief.price_max)}`} />
          <Item label="Property type" value={brief.property_type || '—'} />
          <Item label="Beds / Baths / Cars" value={`${brief.bedrooms ?? '—'} / ${brief.bathrooms ?? '—'} / ${brief.car_spaces ?? '—'}`} />
          <Item label="Min plot size" value={brief.min_plot_size ? `${brief.min_plot_size} m²` : '—'} />
          <Item label="Min yield" value={brief.min_yield ? `${brief.min_yield}%` : '—'} />
          <Item label="Max property age" value={brief.max_property_age ? `${brief.max_property_age} yrs` : '—'} />
        </div>
        {brief.preferred_areas && <p className="text-sm mt-4"><span className="text-gray-500">Areas:</span> {brief.preferred_areas}</p>}
      </Box>

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

      {shown.length === 0 ? (
        <p className="text-gray-500">
          {properties.length === 0
            ? 'We are still searching. Properties will appear here as soon as they are ready for you.'
            : 'No properties in this view.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shown.map((p) => {
            const [label, cls] = DECISION[p.client_decision] || DECISION.pending;
            return (
              <Box key={p.id} onClick={() => onOpen(p.id)} className="cursor-pointer hover:shadow-lg transition-shadow">
                {p.cover_url ? (
                  <img src={p.cover_url} alt="" className="w-full h-40 object-cover rounded-lg mb-3" />
                ) : (
                  <div className="h-40 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm mb-3">
                    No photo yet
                  </div>
                )}
                <div className="flex justify-between items-start gap-2 mb-1">
                  <h3 className="font-semibold text-blue-600">{p.property_title}</h3>
                  {!p.viewed_at && (
                    <span className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-semibold">New</span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-2">📍 {p.address}</p>
                <p className="font-semibold mb-2">
                  {money(p.price)}
                  {p.price_max ? ` – ${money(p.price_max)}` : ''}
                </p>
                <p className="text-sm text-gray-600 mb-3">
                  🛏 {p.bedrooms ?? '—'} · 🛁 {p.bathrooms ?? '—'} · 🚗 {p.car_parking ?? '—'}
                  {p.plot_size ? ` · ${p.plot_size} m²` : ''}
                </p>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${cls}`}>{label}</span>
                {p.client_comment && (
                  <p className="mt-3 p-2 bg-gray-50 rounded text-sm text-gray-700">“{p.client_comment}”</p>
                )}
              </Box>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ==================== ONE PROPERTY (READ-ONLY + DECISION) ====================
function ReadOnlyFields({ fields, p }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {fields.map((spec) => (
        <div key={spec.key} className={spec.type === 'textarea' || spec.wide ? 'md:col-span-2' : ''}>
          <p className="text-xs text-gray-500 mb-1">{spec.label.replace(' *', '')}</p>
          <div className="text-sm font-semibold text-gray-800">
            <FieldView spec={spec} p={p} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ClientProperty({ call, propertyId, onBack }) {
  const [data, setData] = useState(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const load = () =>
    call(`/portal/properties/${propertyId}`)
      .then((d) => {
        setData(d);
        setComment(d.property.client_comment || '');
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, [propertyId]);

  if (!data) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-blue-600 hover:text-blue-800">← Back</button>
        <p className="text-gray-500">{error || 'Loading…'}</p>
      </div>
    );
  }

  const { property: p, media } = data;
  const cover = media.find((m) => m.kind === 'cover');
  const location = media.find((m) => m.kind === 'location');
  const extras = media.filter((m) => m.kind === 'extra');
  const [decisionLabel, decisionClass] = DECISION[p.client_decision] || DECISION.pending;
  const locked = p.client_decision === 'confirmed';

  const agentFields = AGENT_FIELDS.filter((spec) => spec.key !== 'sourced_from' && hasValue(p, spec));

  const decide = async (decision) => {
    if (
      decision === 'confirmed' &&
      !window.confirm('Confirm this property? Our team will then contact the selling agent to move things forward.')
    ) {
      return;
    }
    setSaving(true);
    setError('');
    try {
      await call(`/portal/properties/${propertyId}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision, comment })
      });
      await load();
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-blue-600 hover:text-blue-800">← Back to your search</button>

      <div className="flex flex-wrap justify-between items-start gap-3">
        <div>
          <h2 className="text-2xl font-bold">{p.property_title}</h2>
          <p className="text-gray-600">📍 {p.address}</p>
        </div>
        <span className={`px-3 py-1 rounded text-sm font-semibold ${decisionClass}`}>{decisionLabel}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: details */}
        <div className="lg:col-span-2 space-y-6">
          {agentFields.length > 0 && (
            <Box>
              <p className="font-semibold text-blue-600 mb-4">Selling agent</p>
              <ReadOnlyFields fields={agentFields} p={p} />
            </Box>
          )}

          <Box>
            <div className="space-y-8">
              {SECTIONS.map((s) => {
                const visible = s.fields.filter((spec) => hasValue(p, spec));
                if (visible.length === 0) return null;
                return (
                  <div key={s.title}>
                    <p className="font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">{s.title}</p>
                    <ReadOnlyFields fields={visible} p={p} />
                  </div>
                );
              })}
            </div>
          </Box>
        </div>

        {/* RIGHT: pictures and decision */}
        <div className="space-y-6">
          {cover?.url && (
            <a href={cover.url} target="_blank" rel="noreferrer">
              <img src={cover.url} alt="" className="w-full h-56 object-cover rounded-lg shadow" />
            </a>
          )}

          <Box>
            <p className="font-semibold text-blue-600 mb-3">Your decision</p>
            {locked ? (
              <p className="text-sm text-green-700">
                You have confirmed this property. We will be in touch shortly to move things forward with the
                selling agent.
              </p>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-2">
                  Tell us what you think. A short comment helps us find better matches.
                </p>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Your comment (optional)"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    disabled={saving}
                    onClick={() => decide('interested')}
                    className="px-3 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg disabled:opacity-50"
                  >
                    I’m interested
                  </button>
                  <button
                    disabled={saving}
                    onClick={() => decide('rejected')}
                    className="px-3 py-2 text-sm bg-red-50 text-red-600 hover:bg-red-100 rounded-lg disabled:opacity-50"
                  >
                    Not for me
                  </button>
                  <button
                    disabled={saving}
                    onClick={() => decide('confirmed')}
                    className="px-3 py-2 text-sm bg-green-600 text-white hover:bg-green-700 rounded-lg disabled:opacity-50"
                  >
                    Confirm this property
                  </button>
                </div>
              </>
            )}
            {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
          </Box>

          {location?.url && (
            <Box>
              <p className="font-semibold mb-3">Location</p>
              <a href={location.url} target="_blank" rel="noreferrer">
                <img src={location.url} alt="Location" className="w-full h-48 object-cover rounded-lg" />
              </a>
            </Box>
          )}

          {extras.length > 0 && (
            <Box>
              <p className="font-semibold mb-3">More photos & videos</p>
              <div className="grid grid-cols-2 gap-3">
                {(showAll ? extras : extras.slice(0, 4)).map((m) => (
                  <div key={m.id}>
                    {m.content_type?.startsWith('image/') ? (
                      <a href={m.url} target="_blank" rel="noreferrer">
                        <img src={m.url} alt="" className="w-full h-28 object-cover rounded-lg" />
                      </a>
                    ) : m.content_type?.startsWith('video/') ? (
                      <video src={m.url} controls preload="metadata" className="w-full h-28 object-cover rounded-lg bg-black" />
                    ) : (
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noreferrer"
                        className="h-28 bg-gray-100 rounded-lg flex items-center justify-center text-sm text-blue-600 px-2 text-center"
                      >
                        📄 {m.file_name || 'Document'}
                      </a>
                    )}
                    <p className="text-xs text-gray-500 mt-1">{new Date(m.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
              {extras.length > 4 && (
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="mt-3 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  {showAll ? 'Show less' : `See more (${extras.length - 4})`}
                </button>
              )}
            </Box>
          )}
        </div>
      </div>
    </div>
  );
}