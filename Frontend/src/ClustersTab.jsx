import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

const LEVELS = {
  high: ['High', 'bg-green-100 text-green-800'],
  medium: ['Medium', 'bg-yellow-100 text-yellow-800'],
  low: ['Low', 'bg-red-100 text-red-800']
};

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

function Box({ children, className = '' }) {
  return <div className={`bg-white rounded-lg shadow p-5 ${className}`}>{children}</div>;
}

function Chip({ suburb, region, suitability }) {
  const [, cls] = LEVELS[suitability] || LEVELS.medium;
  return (
    <span className={`inline-block px-2 py-1 rounded text-xs font-semibold mr-2 mb-2 ${cls}`}>
      {suburb}
      {region ? `, ${region}` : ''} ({(LEVELS[suitability] || LEVELS.medium)[0]})
    </span>
  );
}

export default function ClustersTab({ call, briefId, isManager }) {
  const [data, setData] = useState(null);
  const [editor, setEditor] = useState(null);
  const [error, setError] = useState('');
  const [bulk, setBulk] = useState('');
  const [bulkLevel, setBulkLevel] = useState('medium');

  const load = async () => {
    try {
      setData(await call(`/briefs/${briefId}/clusters`));
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
  }, [briefId]);

  if (!data) return <p className="text-gray-500">{error || 'Loading…'}</p>;

  const { clusters, status, can_edit } = data;
  const isFinal = status === 'final';

  const startNew = () => {
    setError('');
    setBulk('');
    setEditor({ id: null, name: '', priority: '', suburbs: [{ suburb: '', region: '', suitability: 'medium' }] });
  };

  const startEdit = (c) => {
    setError('');
    setBulk('');
    setEditor({
      id: c.id,
      name: c.name || '',
      priority: c.priority,
      suburbs: c.cluster_suburbs.map((s) => ({
        suburb: s.suburb,
        region: s.region || '',
        suitability: s.suitability
      }))
    });
  };

  const setSuburb = (i, patch) =>
    setEditor({ ...editor, suburbs: editor.suburbs.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  const removeSuburb = (i) =>
    setEditor({ ...editor, suburbs: editor.suburbs.filter((_, j) => j !== i) });

  const addSuburb = () =>
    setEditor({ ...editor, suburbs: [...editor.suburbs, { suburb: '', region: '', suitability: 'medium' }] });

  const addBulk = () => {
    const names = bulk.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    const kept = editor.suburbs.filter((s) => s.suburb.trim());
    const known = new Set(kept.map((s) => s.suburb.trim().toLowerCase()));
    const fresh = names
      .filter((n) => !known.has(n.toLowerCase()))
      .map((n) => ({ suburb: n, region: '', suitability: bulkLevel }));
    setEditor({ ...editor, suburbs: [...kept, ...fresh] });
    setBulk('');
  };

  const save = async () => {
    setError('');
    const body = JSON.stringify({
      name: editor.name,
      priority: editor.priority,
      suburbs: editor.suburbs
    });
    try {
      if (editor.id) await call(`/clusters/${editor.id}`, { method: 'PATCH', body });
      else await call(`/briefs/${briefId}/clusters`, { method: 'POST', body });
      setEditor(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const remove = async (c) => {
    if (!window.confirm('Delete this cluster?')) return;
    try {
      await call(`/clusters/${c.id}`, { method: 'DELETE' });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const setStatus = async (value) => {
    try {
      await call(`/briefs/${briefId}/clusters/status`, {
        method: 'POST',
        body: JSON.stringify({ status: value })
      });
      setEditor(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className={`rounded-lg p-4 text-sm flex flex-wrap items-center justify-between gap-3 ${
          isFinal ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'
        }`}
      >
        <p>
          {isFinal
            ? 'These clusters are finalised. Only the manager can change them.'
            : 'These clusters are in draft. Click Finalise when they are ready.'}
        </p>
        <div className="flex gap-2">
          {can_edit && (
            <button
              onClick={startNew}
              className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
            >
              <Plus size={16} />
              <span>Add cluster</span>
            </button>
          )}
          {!isFinal && (
            <button
              onClick={() => setStatus('final')}
              className="px-3 py-1 bg-green-600 text-white hover:bg-green-700 rounded-lg"
            >
              Finalise clusters
            </button>
          )}
          {isFinal && isManager && (
            <button
              onClick={() => setStatus('draft')}
              className="px-3 py-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 rounded-lg"
            >
              Reopen
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
        <span>Suburb suitability:</span>
        {Object.values(LEVELS).map(([label, cls]) => (
          <span key={label} className={`px-2 py-1 rounded font-semibold ${cls}`}>{label}</span>
        ))}
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {editor && (
        <Box>
          <h3 className="text-lg font-bold mb-4">{editor.id ? 'Edit cluster' : 'New cluster'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-600">Cluster name (optional)</label>
              <input
                className={inputClass}
                value={editor.name}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">Sourcing priority (1 = first)</label>
              <input
                className={inputClass}
                type="number"
                min="1"
                placeholder="Leave empty to add last"
                value={editor.priority}
                onChange={(e) => setEditor({ ...editor, priority: e.target.value })}
              />
            </div>
          </div>

          <p className="text-xs text-gray-600 mb-2">Suburbs</p>
          <div className="space-y-2">
            {editor.suburbs.map((s, i) => (
              <div key={i} className="grid grid-cols-12 gap-2">
                <input
                  className={`${inputClass} col-span-5`}
                  placeholder="Suburb"
                  value={s.suburb}
                  onChange={(e) => setSuburb(i, { suburb: e.target.value })}
                />
                <input
                  className={`${inputClass} col-span-2`}
                  placeholder="State"
                  value={s.region}
                  onChange={(e) => setSuburb(i, { region: e.target.value })}
                />
                <select
                  className={`${inputClass} col-span-4`}
                  value={s.suitability}
                  onChange={(e) => setSuburb(i, { suitability: e.target.value })}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <button
                  onClick={() => removeSuburb(i)}
                  className="col-span-1 text-red-600 hover:bg-red-50 rounded-lg"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button onClick={addSuburb} className="mt-2 text-sm text-blue-600 hover:text-blue-800">
            + Add a suburb
          </button>

          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 mb-2">Or paste several suburbs (one per line, or separated by commas)</p>
            <textarea
              className={inputClass}
              rows={3}
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
            />
            <div className="flex gap-2 mt-2">
              <select className={inputClass} value={bulkLevel} onChange={(e) => setBulkLevel(e.target.value)}>
                <option value="high">Add as High</option>
                <option value="medium">Add as Medium</option>
                <option value="low">Add as Low</option>
              </select>
              <button
                onClick={addBulk}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg whitespace-nowrap"
              >
                Add to list
              </button>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button onClick={save} className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-semibold">
              Save cluster
            </button>
            <button onClick={() => setEditor(null)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg">
              Cancel
            </button>
          </div>
        </Box>
      )}

      {clusters.length === 0 && !editor ? (
        <p className="text-gray-500">No clusters yet. Group the suburbs worth searching, with a priority order.</p>
      ) : (
        clusters.map((c, index) => (
          <Box key={c.id}>
            <div className="flex justify-between items-start gap-3 mb-3">
              <div>
                <p className="text-xs text-gray-500">Sourcing priority</p>
                <p className="text-lg font-bold">
                  {ordinal(c.priority)}
                  <span className="text-gray-500 font-normal text-base"> · {c.name || `Cluster ${index + 1}`}</span>
                </p>
              </div>
              {can_edit && (
                <div className="flex gap-2">
                  <button onClick={() => startEdit(c)} className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg">
                    Edit
                  </button>
                  <button onClick={() => remove(c)} className="px-3 py-1 text-sm bg-red-50 text-red-600 hover:bg-red-100 rounded-lg">
                    Delete
                  </button>
                </div>
              )}
            </div>
            <div>
              {c.cluster_suburbs.map((s) => (
                <Chip key={s.id} suburb={s.suburb} region={s.region} suitability={s.suitability} />
              ))}
            </div>
          </Box>
        ))
      )}
    </div>
  );
}