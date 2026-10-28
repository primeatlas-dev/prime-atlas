import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
const cellInput =
  'w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

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

const gbp = (n) =>
  n === null || n === undefined || n === '' ? '—' : `£${Number(n).toLocaleString()}`;

function shortMoney(n) {
  if (n === null || n === undefined || n === '') return '—';
  const v = Number(n);
  return v >= 1000 ? `£${+(v / 1000).toFixed(1)}k` : `£${v}`;
}

const dash = (v) => (v === null || v === undefined || v === '' ? '—' : v);
const yesNo = (v) => (v === true ? 'Yes' : v === false ? 'No' : '—');

function Box({ children, className = '' }) {
  return <div className={`bg-white rounded-lg shadow p-5 ${className}`}>{children}</div>;
}

function Chip({ suburb, suitability }) {
  const [label, cls] = LEVELS[suitability] || LEVELS.medium;
  return (
    <span className={`inline-block px-2 py-1 rounded text-xs font-semibold mr-2 mb-2 ${cls}`}>
      {suburb} ({label})
    </span>
  );
}

function ScoreBar({ score }) {
  const color = score >= 65 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-2 ${color}`} style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
      </div>
      <span className="font-semibold text-sm">{score}</span>
    </div>
  );
}

// Read-only table of one cluster's suburbs
function SuburbTable({ suburbs }) {
  const th = 'px-3 py-2 text-left font-semibold';
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-100 text-xs text-gray-600">
          <tr>
            <th className={th}>Suburb</th>
            <th className={th}>Matching properties sold (last 3 months)</th>
            <th className={th}>Matching properties on market</th>
            <th className={th}>Overlay over 75%</th>
            <th className={th}>Suitability</th>
            <th className={th}>Median price</th>
            <th className={th}>Median yield</th>
            <th className={th}>Score</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {suburbs.map((s) => {
            const [label, cls] = LEVELS[s.suitability] || LEVELS.medium;
            return (
              <tr key={s.id || s.suburb}>
                <td className="px-3 py-2 font-semibold">{s.suburb}</td>
                <td className="px-3 py-2">{dash(s.sold_last_3m)}</td>
                <td className="px-3 py-2">{dash(s.on_market_count)}</td>
                <td className="px-3 py-2">{yesNo(s.overlay_over_75)}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${cls}`}>{label}</span>
                </td>
                <td className="px-3 py-2">{shortMoney(s.median_price)}</td>
                <td className="px-3 py-2">
                  {s.median_yield === null || s.median_yield === undefined ? '—' : `${s.median_yield}%`}
                </td>
                <td className="px-3 py-2 font-semibold">{dash(s.score)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Points behind each suburb's score
function ScoreTable({ suburbs }) {
  const th = 'px-3 py-2 text-left font-semibold';
  const pts = (v) => (v === undefined || v === null ? '—' : v > 0 ? `+${v}` : `${v}`);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-100 text-xs text-gray-600">
          <tr>
            <th className={th}>Suburb</th>
            <th className={th}>Suitability (35)</th>
            <th className={th}>Budget fit (20)</th>
            <th className={th}>Yield (15)</th>
            <th className={th}>Sold (10)</th>
            <th className={th}>On market (10)</th>
            <th className={th}>Overlay (10 / −20)</th>
            <th className={th}>Score</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {suburbs.map((s) => (
            <tr key={s.id || s.suburb}>
              <td className="px-3 py-2">
                <p className="font-semibold">{s.suburb}</p>
                {s.missing && s.missing.length > 0 && (
                  <p className="text-xs text-yellow-700">Missing: {s.missing.join(', ')}</p>
                )}
              </td>
              <td className="px-3 py-2">{pts(s.breakdown?.suitability)}</td>
              <td className="px-3 py-2">{pts(s.breakdown?.budget)}</td>
              <td className="px-3 py-2">{pts(s.breakdown?.yield)}</td>
              <td className="px-3 py-2">{pts(s.breakdown?.sold)}</td>
              <td className="px-3 py-2">{pts(s.breakdown?.on_market)}</td>
              <td className="px-3 py-2">{pts(s.breakdown?.overlay)}</td>
              <td className="px-3 py-2 font-semibold">{dash(s.score)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const emptyRow = () => ({
  suburb: '',
  sold_last_3m: '',
  on_market_count: '',
  overlay_over_75: '',
  suitability: 'medium',
  median_price: '',
  median_yield: ''
});

const toRow = (s) => ({
  suburb: s.suburb,
  sold_last_3m: s.sold_last_3m ?? '',
  on_market_count: s.on_market_count ?? '',
  overlay_over_75: s.overlay_over_75 === true ? 'yes' : s.overlay_over_75 === false ? 'no' : '',
  suitability: s.suitability,
  median_price: s.median_price ?? '',
  median_yield: s.median_yield ?? ''
});

const PRINT_CSS = `
#cluster-print { display: none; }
@media print {
  body * { visibility: hidden !important; }
  #cluster-print, #cluster-print * { visibility: visible !important; }
  #cluster-print { display: block !important; position: absolute; left: 0; top: 0; width: 100%; padding: 16px; }
}
`;

// What gets printed / saved as PDF
function PrintView({ brief, client, clusters }) {
  return (
    <div id="cluster-print">
      <h1 className="text-xl font-bold">Cluster priority: {brief.title || `Brief #${brief.brief_number}`}</h1>
      <p className="text-sm text-gray-600 mb-2">
        {client.name} · Brief #{brief.brief_number} · {new Date().toLocaleDateString()}
      </p>
      <p className="text-sm mb-4">
        Budget {gbp(brief.price_min)} – {gbp(brief.price_max)} · {brief.bedrooms ?? '—'} bed /{' '}
        {brief.bathrooms ?? '—'} bath / {brief.car_spaces ?? '—'} car
        {brief.min_plot_size ? ` · min plot ${brief.min_plot_size} m²` : ''}
        {brief.min_yield ? ` · min yield ${brief.min_yield}%` : ''}
      </p>
      {clusters.map((c) => (
        <div key={c.id} className="mb-6" style={{ pageBreakInside: 'avoid' }}>
          <p className="font-bold mb-1">
            {ordinal(c.rank)} priority · {c.name}
            {c.state ? ` (${c.state})` : ''} · score {c.score}/100
          </p>
          <SuburbTable suburbs={c.cluster_suburbs} />
        </div>
      ))}
    </div>
  );
}

export default function ClustersTab({ call, brief, client, isManager }) {
  const briefId = brief.id;
  const [data, setData] = useState(null);
  const [view, setView] = useState('list');
  const [editor, setEditor] = useState(null);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState(null);
  const [whyId, setWhyId] = useState(null);
  const [bulk, setBulk] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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

  const allSuburbs = clusters.flatMap((c) =>
    c.cluster_suburbs.map((s) => `${s.suburb}${c.state ? ' ' + c.state : ''}`)
  );

  // ----- navigation -----
  const goList = () => {
    setView('list');
    setEditor(null);
    setError('');
  };
  const goPriority = () => {
    setView('priority');
    setEditor(null);
    setError('');
  };
  const startNew = () => {
    setEditor({ id: null, name: '', state: '', suburbs: [emptyRow()] });
    setBulk('');
    setView('form');
    setError('');
  };
  const startEdit = (c) => {
    setEditor({
      id: c.id,
      name: c.name || '',
      state: c.state || '',
      suburbs: c.cluster_suburbs.map(toRow)
    });
    setBulk('');
    setView('form');
    setError('');
  };

  // ----- form helpers -----
  const setRow = (i, patch) =>
    setEditor({ ...editor, suburbs: editor.suburbs.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const removeRow = (i) => setEditor({ ...editor, suburbs: editor.suburbs.filter((_, j) => j !== i) });
  const addRow = () => setEditor({ ...editor, suburbs: [...editor.suburbs, emptyRow()] });

  const addBulk = () => {
    const names = bulk.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    const kept = editor.suburbs.filter((s) => s.suburb.trim());
    const known = new Set(kept.map((s) => s.suburb.trim().toLowerCase()));
    const fresh = names
      .filter((n) => !known.has(n.toLowerCase()))
      .map((n) => ({ ...emptyRow(), suburb: n }));
    setEditor({ ...editor, suburbs: [...kept, ...fresh] });
    setBulk('');
  };

  const saveCluster = async () => {
    setError('');
    setBusy(true);
    const body = JSON.stringify({ name: editor.name, state: editor.state, suburbs: editor.suburbs });
    try {
      if (editor.id) await call(`/clusters/${editor.id}`, { method: 'PATCH', body });
      else await call(`/briefs/${briefId}/clusters`, { method: 'POST', body });
      setEditor(null);
      setView('list');
      await load();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  const removeCluster = async (c) => {
    if (!window.confirm(`Delete cluster "${c.name}"?`)) return;
    try {
      await call(`/clusters/${c.id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  // ----- finalise -----
  const setStatus = async (value) => {
    setError('');
    setBusy(true);
    try {
      await call(`/briefs/${briefId}/clusters/status`, { method: 'POST', body: JSON.stringify({ status: value }) });
      await load();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  const pill = (active) =>
    `px-4 py-2 rounded-lg text-sm font-semibold ${
      active ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 shadow hover:bg-gray-50'
    }`;

  const q = search.trim().toLowerCase();
  const shown = clusters.filter(
    (c) =>
      !q ||
      (c.name || '').toLowerCase().includes(q) ||
      (c.state || '').toLowerCase().includes(q) ||
      c.cluster_suburbs.some((s) => s.suburb.toLowerCase().includes(q))
  );

  return (
    <div className="space-y-4">
      <style>{PRINT_CSS}</style>
      <PrintView brief={brief} client={client} clusters={clusters} />

      <div className="flex flex-wrap gap-2">
        <button className={pill(view === 'list')} onClick={goList}>Cluster list</button>
        <button className={pill(view === 'priority')} onClick={goPriority}>Priority</button>
        {can_edit && (
          <button className={pill(view === 'form')} onClick={startNew}>
            <span className="inline-flex items-center gap-1"><Plus size={14} /> Add cluster</span>
          </button>
        )}
      </div>

      <div
        className={`rounded-lg p-3 text-sm flex flex-wrap items-center justify-between gap-3 ${
          isFinal ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'
        }`}
      >
        <p>
          {isFinal
            ? 'The priority is finalised. Only the manager can change the clusters.'
            : 'Priority is worked out automatically from the suburb data. When the data is complete, open Priority and click Generate & Save Priority.'}
        </p>
        {isFinal && isManager && (
          <button
            onClick={() => setStatus('draft')}
            className="px-3 py-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 rounded-lg"
          >
            Reopen
          </button>
        )}
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {/* ================= LIST ================= */}
      {view === 'list' && (
        <>
          <Box>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
              <div><p className="text-gray-500">Price</p><p className="font-semibold">{gbp(brief.price_min)} – {gbp(brief.price_max)}</p></div>
              <div><p className="text-gray-500">Min plot size</p><p className="font-semibold">{brief.min_plot_size ? `${brief.min_plot_size} m²` : '—'}</p></div>
              <div><p className="text-gray-500">Specifications</p><p className="font-semibold">{brief.bedrooms ?? '—'} / {brief.bathrooms ?? '—'} / {brief.car_spaces ?? '—'}</p></div>
              <div><p className="text-gray-500">Min yield</p><p className="font-semibold">{brief.min_yield ? `${brief.min_yield}%` : '—'}</p></div>
              <div><p className="text-gray-500">Age of property</p><p className="font-semibold">{brief.max_property_age ?? '—'}</p></div>
            </div>
            <p className="text-sm">
              <span className="text-gray-500">Suburbs:</span>{' '}
              {allSuburbs.length ? allSuburbs.join(', ') : 'No suburbs yet'}
            </p>
          </Box>

          <input
            className={inputClass}
            placeholder="Search cluster name / suburbs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {clusters.length === 0 ? (
            <p className="text-gray-500">No clusters yet. Group the suburbs worth searching and fill in their data. The priority order is worked out for you.</p>
          ) : (
            <Box className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Sourcing priority</th>
                    <th className="px-3 py-2 text-left">Cluster name</th>
                    <th className="px-3 py-2 text-left">Suburbs</th>
                    <th className="px-3 py-2 text-left">State</th>
                    <th className="px-3 py-2 text-left">Score</th>
                    <th className="px-3 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {shown.map((c) => {
                    const names = c.cluster_suburbs.map((s) => s.suburb);
                    const open = openId === c.id;
                    return (
                      <React.Fragment key={c.id}>
                        <tr>
                          <td className="px-3 py-3 font-semibold">{ordinal(c.rank)}</td>
                          <td className="px-3 py-3 font-semibold text-blue-600">{c.name || 'Unnamed'}</td>
                          <td className="px-3 py-3 text-gray-700">
                            {names.slice(0, 3).join(', ')}
                            {names.length > 3 ? ` +${names.length - 3} more` : ''}
                          </td>
                          <td className="px-3 py-3">{c.state || '—'}</td>
                          <td className="px-3 py-3"><ScoreBar score={c.score} /></td>
                          <td className="px-3 py-3">
                            <div className="flex gap-2">
                              <button onClick={() => setOpenId(open ? null : c.id)} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg">
                                {open ? 'Hide' : 'View'}
                              </button>
                              {can_edit && (
                                <>
                                  <button onClick={() => startEdit(c)} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg">Edit</button>
                                  <button onClick={() => removeCluster(c)} className="px-3 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg">Delete</button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                        {open && (
                          <tr>
                            <td colSpan={6} className="px-3 pb-4 bg-gray-50">
                              <SuburbTable suburbs={c.cluster_suburbs} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </Box>
          )}
        </>
      )}

      {/* ================= PRIORITY (AUTOMATIC) ================= */}
      {view === 'priority' && (
        <Box>
          <h3 className="text-lg font-bold mb-1">Cluster priority</h3>
          <p className="text-sm text-gray-600 mb-4">
            Ranked automatically from the suburb data, measured against the brief. Change the data and the order updates.
          </p>

          <details className="mb-4 text-sm bg-gray-50 rounded-lg p-3">
            <summary className="cursor-pointer font-semibold">How the score works</summary>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-gray-700">
              <li><strong>Brief suitability (35):</strong> High = 35, Medium = 17.5, Low = 0.</li>
              <li><strong>Budget fit (20):</strong> median price inside the brief's price range = full marks, within 10% outside = half.</li>
              <li><strong>Yield (15):</strong> median yield meets the brief's minimum = full marks, within 0.5 points below = half.</li>
              <li><strong>Sold in the last 3 months (10):</strong> 10 or more matching sales = full marks.</li>
              <li><strong>On market now (10):</strong> 10 or more matching listings = full marks.</li>
              <li><strong>Overlay:</strong> not majorly covered = +10, covered over 75% = −20.</li>
              <li>A cluster's score is the average of its suburbs. Ties go to the cluster with more High suburbs, then more properties on the market.</li>
              <li>Missing data scores zero, so fill in every column for a fair score.</li>
            </ul>
          </details>

          {clusters.length === 0 ? (
            <p className="text-gray-500">Add some clusters first.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Priority</th>
                    <th className="px-3 py-2 text-left">Cluster</th>
                    <th className="px-3 py-2 text-left">Suburbs (suitability)</th>
                    <th className="px-3 py-2 text-left">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {clusters.map((c) => {
                    const why = whyId === c.id;
                    return (
                      <React.Fragment key={c.id}>
                        <tr>
                          <td className="px-3 py-3 font-bold align-top">{ordinal(c.rank)}</td>
                          <td className="px-3 py-3 font-semibold align-top">
                            {c.name || 'Unnamed'}
                            {c.state ? <span className="text-gray-500 font-normal"> · {c.state}</span> : null}
                          </td>
                          <td className="px-3 py-3">
                            {c.cluster_suburbs.map((s) => (
                              <Chip key={s.id} suburb={s.suburb} suitability={s.suitability} />
                            ))}
                            {c.missing_count > 0 && (
                              <p className="text-xs text-yellow-700">
                                ⚠ Data missing for {c.missing_count} suburb{c.missing_count > 1 ? 's' : ''}, so the score may be too low
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-3 align-top">
                            <ScoreBar score={c.score} />
                            <button onClick={() => setWhyId(why ? null : c.id)} className="text-xs text-blue-600 hover:text-blue-800 mt-1">
                              {why ? 'Hide details' : 'Why this rank?'}
                            </button>
                          </td>
                        </tr>
                        {why && (
                          <tr>
                            <td colSpan={4} className="px-3 pb-4 bg-gray-50">
                              <ScoreTable suburbs={c.cluster_suburbs} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-4">
            {can_edit && !isFinal && clusters.length > 0 && (
              <button
                onClick={() => setStatus('final')}
                disabled={busy}
                className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg font-semibold disabled:opacity-50"
              >
                Generate & Save Priority
              </button>
            )}
            {clusters.length > 0 && (
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-blue-700 text-white hover:bg-blue-800 rounded-lg font-semibold"
              >
                Download PDF
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Download PDF opens your print window. Choose “Save as PDF” as the printer.
          </p>
        </Box>
      )}

      {/* ================= ADD / EDIT ================= */}
      {view === 'form' && editor && (
        <Box>
          <h3 className="text-lg font-bold mb-4">{editor.id ? 'Edit cluster' : 'Add new cluster'}</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-600">Cluster name *</label>
              <input
                className={inputClass}
                value={editor.name}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">State / region</label>
              <input
                className={inputClass}
                placeholder="e.g. VIC"
                value={editor.state}
                onChange={(e) => setEditor({ ...editor, state: e.target.value })}
              />
            </div>
          </div>

          <p className="text-xs text-gray-600 mb-2">Suburbs *</p>
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-sm min-w-[1000px]">
              <thead className="bg-gray-100 text-xs text-gray-600 uppercase">
                <tr>
                  <th className="px-2 py-2 text-left">Suburb</th>
                  <th className="px-2 py-2 text-left">Brief matching properties sold in last 3 months</th>
                  <th className="px-2 py-2 text-left">Brief matching properties on market as on date</th>
                  <th className="px-2 py-2 text-left">Suburb majorly covered by any overlay (&gt;75%)</th>
                  <th className="px-2 py-2 text-left">Brief suitability</th>
                  <th className="px-2 py-2 text-left">Median price (£)</th>
                  <th className="px-2 py-2 text-left">Median yield (%)</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {editor.suburbs.map((s, i) => (
                  <tr key={i}>
                    <td className="px-2 py-2 min-w-[160px]">
                      <input className={cellInput} placeholder="Suburb" value={s.suburb} onChange={(e) => setRow(i, { suburb: e.target.value })} />
                    </td>
                    <td className="px-2 py-2">
                      <input className={cellInput} type="number" min="0" value={s.sold_last_3m} onChange={(e) => setRow(i, { sold_last_3m: e.target.value })} />
                    </td>
                    <td className="px-2 py-2">
                      <input className={cellInput} type="number" min="0" value={s.on_market_count} onChange={(e) => setRow(i, { on_market_count: e.target.value })} />
                    </td>
                    <td className="px-2 py-2">
                      <select className={cellInput} value={s.overlay_over_75} onChange={(e) => setRow(i, { overlay_over_75: e.target.value })}>
                        <option value="">Select</option>
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <select className={cellInput} value={s.suitability} onChange={(e) => setRow(i, { suitability: e.target.value })}>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input className={cellInput} type="number" min="0" value={s.median_price} onChange={(e) => setRow(i, { median_price: e.target.value })} />
                    </td>
                    <td className="px-2 py-2">
                      <input className={cellInput} type="number" min="0" step="0.1" value={s.median_yield} onChange={(e) => setRow(i, { median_yield: e.target.value })} />
                    </td>
                    <td className="px-2 py-2">
                      <button onClick={() => removeRow(i)} className="w-8 h-8 bg-red-600 text-white rounded hover:bg-red-700" title="Remove">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={addRow} className="mt-3 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg">
            + Add suburb
          </button>

          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 mb-2">Or paste several suburbs (one per line, or separated by commas)</p>
            <textarea className={inputClass} rows={3} value={bulk} onChange={(e) => setBulk(e.target.value)} />
            <button onClick={addBulk} className="mt-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg">
              Add to table
            </button>
          </div>

          <div className="flex gap-2 mt-4">
            <button onClick={goList} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg">Back</button>
            <button
              onClick={saveCluster}
              disabled={busy}
              className="px-4 py-2 bg-blue-700 text-white hover:bg-blue-800 rounded-lg font-semibold disabled:opacity-50"
            >
              {editor.id ? 'Update cluster' : 'Add cluster'}
            </button>
          </div>
        </Box>
      )}
    </div>
  );
}