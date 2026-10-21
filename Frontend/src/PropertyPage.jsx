import React, { useState, useEffect } from 'react';
import { getSupabase } from './supabaseClient';
import ChatPanel from './ChatPanel';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const BUCKET = 'property-media';

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

const APPROVAL = {
  review: ['Review', 'bg-yellow-100 text-yellow-800'],
  approved: ['Approved', 'bg-green-100 text-green-800'],
  rejected: ['Rejected', 'bg-red-100 text-red-800']
};
const DECISION = {
  pending: ['Pending', 'bg-gray-100 text-gray-800'],
  interested: ['Interested', 'bg-blue-100 text-blue-800'],
  rejected: ['Rejected', 'bg-red-100 text-red-800'],
  confirmed: ['Confirmed', 'bg-green-100 text-green-800']
};

const ZONE = [['detected', 'Detected'], ['undetected', 'Undetected']];
const YESNO = [['yes', 'Yes'], ['no', 'No']];
const NOISE = [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']];

const BAD = ['detected', 'yes', 'high'];
const GOOD = ['undetected', 'no', 'low'];
const badgeClass = (v) =>
  BAD.includes(v)
    ? 'bg-red-100 text-red-800'
    : GOOD.includes(v)
    ? 'bg-green-100 text-green-800'
    : 'bg-yellow-100 text-yellow-800';

const gbp = (n) => `£${Number(n).toLocaleString()}`;

// ---------- Field layout (matches the sections of the reference ERP) ----------
const AGENT_FIELDS = [
  { key: 'selling_agent_name', label: 'Name', type: 'text' },
  { key: 'selling_agent_phone', label: 'Phone', type: 'text' },
  { key: 'selling_agent_email', label: 'Email', type: 'text' },
  { key: 'sourced_from', label: 'Sourced from', type: 'text' }
];

const SECTIONS = [
  {
    title: 'Property details',
    fields: [
      { key: 'property_title', label: 'Property title *', type: 'text', wide: true },
      { key: 'address', label: 'Address *', type: 'text', wide: true },
      { key: 'source', label: 'Source', type: 'text' },
      { key: 'region', label: 'Suburb / region', type: 'text' },
      { key: 'property_type', label: 'Property type', type: 'text' },
      { key: 'price', label: 'Price (or price from)', type: 'money' },
      { key: 'price_max', label: 'Price to', type: 'money' },
      { key: 'bedrooms', label: 'Bedrooms', type: 'number' },
      { key: 'bathrooms', label: 'Bathrooms', type: 'number' },
      { key: 'car_parking', label: 'Car park', type: 'number' },
      { key: 'plot_size', label: 'Plot size', type: 'number', suffix: ' m²' }
    ]
  },
  {
    title: 'Additional property details',
    fields: [
      { key: 'valuation', label: 'Valuation (from)', type: 'money' },
      { key: 'valuation_max', label: 'Valuation (to)', type: 'money' },
      { key: 'sales_comparables', label: 'Sales comparables (one per line)', type: 'textarea' },
      { key: 'notes_from_agent', label: 'Notes from agent', type: 'textarea' }
    ]
  },
  {
    title: 'Property information',
    fields: [
      { key: 'built_year', label: 'Built year', type: 'number' },
      { key: 'condition', label: 'Condition', type: 'text' },
      { key: 'occupancy_status', label: 'Occupancy status', type: 'text' },
      { key: 'current_rent_pw', label: 'Current rent per week', type: 'money' },
      { key: 'rental_appraisal_pw', label: 'Rental appraisal per week', type: 'money' },
      { key: 'est_rental_yield', label: 'Estimated rental yield', type: 'number', suffix: ' %' }
    ]
  },
  {
    title: 'Overlay information',
    fields: [
      { key: 'bushfire_zone', label: 'Bushfire zone', type: 'select', options: ZONE },
      { key: 'flood_zone', label: 'Flood zone', type: 'select', options: ZONE },
      { key: 'heritage_zone', label: 'Heritage zone', type: 'select', options: ZONE }
    ]
  },
  {
    title: 'Other information',
    fields: [
      { key: 'adjacent_main_road', label: 'Adjacent main road', type: 'yesno' },
      { key: 'easements', label: 'Easements', type: 'select', options: ZONE },
      { key: 'noise_level', label: 'Noise / disturbance', type: 'select', options: NOISE }
    ]
  },
  {
    title: 'Social housing',
    fields: [
      { key: 'social_housing_pct', label: '% of social housing in suburb', type: 'number', suffix: ' %' },
      { key: 'social_housing_nearby', label: 'Social housing nearby', type: 'yesno' },
      { key: 'other_findings_found', label: 'Other findings', type: 'yesno' },
      { key: 'other_findings', label: 'Details of other findings', type: 'textarea' }
    ]
  },
  {
    title: 'Transportation',
    fields: [
      { key: 'nearest_bus_stop', label: 'Nearest bus stop', type: 'text' },
      { key: 'airport_distance', label: 'Airport distance', type: 'text' },
      { key: 'railway_distance', label: 'Railway distance', type: 'text' }
    ]
  },
  {
    title: 'Nearby amenities (within 3 km)',
    fields: [
      { key: 'schools', label: 'Schools', type: 'textarea' },
      { key: 'hospitals', label: 'Hospitals', type: 'textarea' },
      { key: 'shopping_centers', label: 'Shopping centres', type: 'textarea' }
    ]
  }
];

const ALL_FIELDS = [...AGENT_FIELDS, ...SECTIONS.flatMap((s) => s.fields)];

function toForm(p) {
  const f = {};
  ALL_FIELDS.forEach(({ key, type }) => {
    const v = p[key];
    f[key] = type === 'yesno' ? (v === true ? 'yes' : v === false ? 'no' : '') : v ?? '';
  });
  return f;
}

function toPayload(f) {
  const out = {};
  ALL_FIELDS.forEach(({ key, type }) => {
    const v = f[key];
    out[key] = type === 'yesno' ? (v === 'yes' ? true : v === 'no' ? false : '') : v;
  });
  return out;
}

function whatsappLink(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0')) digits = '44' + digits.slice(1);
  return `https://wa.me/${digits}`;
}

// Shrink big photos before uploading
async function shrinkImage(file) {
  const shrinkable = ['image/jpeg', 'image/png', 'image/webp'];
  if (!shrinkable.includes(file.type) || file.size < 1.5 * 1024 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch (e) {
    return file;
  }
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

function Box({ children, className = '' }) {
  return <div className={`bg-white rounded-lg shadow p-5 ${className}`}>{children}</div>;
}

// ---------- Fields ----------
function FieldView({ spec, p }) {
  const v = p[spec.key];
  if (v === null || v === undefined || v === '') return <span className="text-gray-400">—</span>;

  if (spec.type === 'money') return gbp(v);
  if (spec.type === 'yesno') {
    const val = v ? 'yes' : 'no';
    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${badgeClass(val)}`}>
        {v ? 'Yes' : 'No'}
      </span>
    );
  }
  if (spec.type === 'select') {
    const label = (spec.options.find(([val]) => val === v) || [v, v])[1];
    return <span className={`px-2 py-1 rounded text-xs font-semibold ${badgeClass(v)}`}>{label}</span>;
  }
  if (spec.type === 'textarea') return <span className="whitespace-pre-wrap font-normal">{v}</span>;
  if (spec.key === 'selling_agent_phone') {
    const link = whatsappLink(v);
    return (
      <span>
        {v}{' '}
        {link && (
          <a href={link} target="_blank" rel="noreferrer" className="text-green-600 text-xs font-semibold">
            WhatsApp
          </a>
        )}
      </span>
    );
  }
  return `${v}${spec.suffix || ''}`;
}

function FieldInput({ spec, value, onChange }) {
  const common = { className: inputClass, value, onChange: (e) => onChange(e.target.value) };
  if (spec.type === 'textarea') return <textarea rows={3} {...common} />;
  if (spec.type === 'select' || spec.type === 'yesno') {
    const options = spec.type === 'yesno' ? YESNO : spec.options;
    return (
      <select {...common}>
        <option value="">Not checked</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    );
  }
  const inputType = spec.type === 'money' || spec.type === 'number' ? 'number' : 'text';
  return <input type={inputType} step="any" {...common} />;
}

function FieldGrid({ fields, editing, form, setForm, property }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {fields.map((spec) => (
        <div key={spec.key} className={spec.type === 'textarea' || spec.wide ? 'md:col-span-2' : ''}>
          <p className="text-xs text-gray-500 mb-1">{spec.label}</p>
          {editing ? (
            <FieldInput
              spec={spec}
              value={form[spec.key] ?? ''}
              onChange={(v) => setForm({ ...form, [spec.key]: v })}
            />
          ) : (
            <div className="text-sm font-semibold text-gray-800">
              <FieldView spec={spec} p={property} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------- Pictures ----------
function UploadButton({ label, accept, multiple, disabled, onFiles }) {
  return (
    <label
      className={`inline-block px-3 py-1 text-sm rounded-lg ${
        disabled ? 'bg-gray-100 text-gray-400' : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
      }`}
    >
      {label}
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          e.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
    </label>
  );
}

function SingleSlot({ title, note, item, canEdit, busy, onUpload, onDelete }) {
  return (
    <Box>
      <p className="font-semibold">{title}</p>
      <p className="text-xs text-gray-500 mb-3">{note}</p>
      {item?.url ? (
        <a href={item.url} target="_blank" rel="noreferrer">
          <img src={item.url} alt={title} className="w-full h-48 object-cover rounded-lg" />
        </a>
      ) : (
        <div className="h-48 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm">
          No picture yet
        </div>
      )}
      {canEdit && (
        <div className="flex gap-2 mt-3">
          <UploadButton
            label={item ? 'Replace' : 'Upload'}
            accept="image/*"
            disabled={busy}
            onFiles={(files) => onUpload(files.slice(0, 1))}
          />
          {item && (
            <button
              onClick={() => onDelete(item)}
              className="px-3 py-1 text-sm bg-red-50 text-red-600 hover:bg-red-100 rounded-lg"
            >
              Remove
            </button>
          )}
        </div>
      )}
    </Box>
  );
}

function ExtraMedia({ items, canEdit, busy, onUpload, onDelete }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? items : items.slice(0, 4);

  return (
    <Box>
      <div className="flex justify-between items-center mb-3">
        <div>
          <p className="font-semibold">Extra photos & videos</p>
          <p className="text-xs text-gray-500">Any number. Photos, videos (MP4, MOV, WebM) or PDFs.</p>
        </div>
        {canEdit && (
          <UploadButton
            label="Add files"
            accept="image/*,video/mp4,video/quicktime,video/webm,application/pdf"
            multiple
            disabled={busy}
            onFiles={onUpload}
          />
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-400">Nothing added yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {shown.map((m) => (
            <div key={m.id} className="relative">
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
              <p className="text-xs text-gray-500 mt-1">{new Date(m.created_at).toLocaleString()}</p>
              {canEdit && (
                <button
                  onClick={() => onDelete(m)}
                  className="absolute top-1 right-1 w-6 h-6 bg-white/90 text-red-600 rounded-full text-xs shadow"
                  title="Remove"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {items.length > 4 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-3 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
        >
          {showAll ? 'Show less' : `See more (${items.length - 4})`}
        </button>
      )}
    </Box>
  );
}

// ==================== PROPERTY PAGE ====================
export default function PropertyPage({ token, propertyId, isManager, onBack }) {
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [busy, setBusy] = useState(false);
  const call = makeCall(token);

  const load = async () => {
    try {
      setData(await call(`/properties/${propertyId}/full`));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };

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

  const { property: p, brief, client, media, can_edit } = data;
  const cover = media.find((m) => m.kind === 'cover');
  const location = media.find((m) => m.kind === 'location');
  const extras = media.filter((m) => m.kind === 'extra');
  const [approvalLabel, approvalClass] = APPROVAL[p.approval_status] || [p.approval_status, ''];
  const [decisionLabel, decisionClass] = DECISION[p.client_decision] || DECISION.pending;

  const startEdit = () => {
    setForm(toForm(p));
    setError('');
    setEditing(true);
  };

  const save = async () => {
    if (!String(form.property_title || '').trim() || !String(form.address || '').trim()) {
      setError('Title and address are required');
      return;
    }
    try {
      await call(`/properties/${propertyId}`, { method: 'PATCH', body: JSON.stringify(toPayload(form)) });
      setEditing(false);
      setError('');
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const decide = async (action) => {
    try {
      await call(`/properties/${propertyId}/decision`, { method: 'POST', body: JSON.stringify({ action }) });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const setClientDecision = async (value) => {
    try {
      await call(`/properties/${propertyId}`, { method: 'PATCH', body: JSON.stringify({ client_decision: value }) });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const upload = async (kind, files) => {
    setBusy(true);
    setUploadError('');
    try {
      const supabase = getSupabase();
      for (const original of files) {
        const file = await shrinkImage(original);
        const { path, token: uploadToken } = await call(`/properties/${propertyId}/media/upload-url`, {
          method: 'POST',
          body: JSON.stringify({ kind, content_type: file.type, size: file.size })
        });
        const { error: upError } = await supabase.storage
          .from(BUCKET)
          .uploadToSignedUrl(path, uploadToken, file, { contentType: file.type });
        if (upError) throw new Error(upError.message);
        await call(`/properties/${propertyId}/media`, {
          method: 'POST',
          body: JSON.stringify({ kind, path, file_name: original.name, content_type: file.type })
        });
      }
      await load();
    } catch (e) {
      setUploadError(e.message);
    }
    setBusy(false);
  };

  const removeMedia = async (item) => {
    if (!window.confirm('Remove this file?')) return;
    try {
      await call(`/media/${item.id}`, { method: 'DELETE' });
      load();
    } catch (e) {
      setUploadError(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-blue-600 hover:text-blue-800">← Back to brief</button>
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: details */}
        <div className="lg:col-span-2 space-y-6">
          <Box>
            <p className="font-semibold text-blue-600 mb-4">Selling agent</p>
            <FieldGrid fields={AGENT_FIELDS} editing={editing} form={form} setForm={setForm} property={p} />
          </Box>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-blue-600 text-white px-5 py-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="font-semibold">{p.property_title}</span>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${approvalClass}`}>{approvalLabel}</span>
              </div>
              {can_edit && (
                <div className="flex gap-2">
                  {editing ? (
                    <>
                      <button onClick={save} className="px-3 py-1 text-sm bg-white text-blue-700 rounded-lg font-semibold">
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditing(false);
                          setError('');
                        }}
                        className="px-3 py-1 text-sm bg-blue-700 text-white rounded-lg"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button onClick={startEdit} className="px-3 py-1 text-sm bg-white text-blue-700 rounded-lg font-semibold">
                      Edit
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="p-5 space-y-8">
              {SECTIONS.map((s) => (
                <div key={s.title}>
                  <p className="font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">{s.title}</p>
                  <FieldGrid fields={s.fields} editing={editing} form={form} setForm={setForm} property={p} />
                </div>
              ))}
              {editing && (
                <button onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">
                  Save changes
                </button>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: pictures and status */}
        <div className="space-y-6">
          {uploadError && <p className="text-red-600 text-sm">{uploadError}</p>}
          {busy && <p className="text-blue-600 text-sm">Uploading…</p>}
          {p.approval_status === 'approved' && (
            <ChatPanel call={call} basePath={`/properties/${propertyId}/chat`} />
          )}

          <SingleSlot
            title="Cover photo"
            note="One picture only. It appears on the property card."
            item={cover}
            canEdit={can_edit}
            busy={busy}
            onUpload={(files) => upload('cover', files)}
            onDelete={removeMedia}
          />
          <SingleSlot
            title="Location photo"
            note="One picture only, such as the map view."
            item={location}
            canEdit={can_edit}
            busy={busy}
            onUpload={(files) => upload('location', files)}
            onDelete={removeMedia}
          />
          <ExtraMedia
            items={extras}
            canEdit={can_edit}
            busy={busy}
            onUpload={(files) => upload('extra', files)}
            onDelete={removeMedia}
          />

          <Box>
            <p className="font-semibold text-blue-600 mb-4">Status information</p>
            <div className="space-y-3 text-sm">
              {brief && (
                <p>
                  <span className="text-gray-500">Brief:</span> #{brief.brief_number}
                  {brief.title ? ` · ${brief.title}` : ''}
                </p>
              )}
              {client && (
                <p>
                  <span className="text-gray-500">Client:</span> {client.name}
                </p>
              )}
              <p>
                <span className="text-gray-500">Approval status:</span>{' '}
                <span className={`px-2 py-1 rounded text-xs font-semibold ${approvalClass}`}>{approvalLabel}</span>
              </p>
              <div>
                <span className="text-gray-500">Client decision:</span>{' '}
                <span className={`px-2 py-1 rounded text-xs font-semibold ${decisionClass}`}>{decisionLabel}</span>
                {isManager && (
                  <select
                    className={`${inputClass} mt-2`}
                    value={p.client_decision || 'pending'}
                    onChange={(e) => setClientDecision(e.target.value)}
                  >
                    {Object.entries(DECISION).map(([value, [label]]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                )}
              </div>
              <p>
                <span className="text-gray-500">Client viewed:</span>{' '}
                {p.viewed_at ? new Date(p.viewed_at).toLocaleString() : 'Not viewed yet'}
              </p>
              {p.approval_status === 'approved' && p.approved_by_name && (
                <div>
                  <p><span className="text-gray-500">Approved by:</span> {p.approved_by_name}</p>
                  {p.approved_at && <p className="text-xs text-gray-500">{new Date(p.approved_at).toLocaleString()}</p>}
                </div>
              )}
              <div>
                <p className="text-gray-500">Created</p>
                <p>{new Date(p.created_at).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-500">Created by</p>
                <p>{p.created_by_name || 'Unknown'}</p>
              </div>
            </div>

            {isManager && (
              <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-2">
                {p.approval_status !== 'approved' && (
                  <button onClick={() => decide('approve')} className="px-3 py-1 text-sm bg-green-600 text-white hover:bg-green-700 rounded-lg">
                    Approve
                  </button>
                )}
                {p.approval_status !== 'rejected' && (
                  <button onClick={() => decide('reject')} className="px-3 py-1 text-sm bg-red-50 text-red-600 hover:bg-red-100 rounded-lg">
                    Reject
                  </button>
                )}
                {p.approval_status !== 'review' && (
                  <button onClick={() => decide('review')} className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg">
                    Back to review
                  </button>
                )}
              </div>
            )}
          </Box>
        </div>
      </div>
    </div>
  );
}
export { SECTIONS, AGENT_FIELDS, FieldView, gbp };