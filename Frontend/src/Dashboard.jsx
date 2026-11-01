import React, { useState, useEffect, useMemo } from 'react';
import { makeCall } from './api';

const TONES = {
  blue: 'border-blue-500',
  green: 'border-green-500',
  yellow: 'border-yellow-400',
  red: 'border-red-500',
  purple: 'border-purple-500',
  gray: 'border-gray-300'
};

const DECISION_LABEL = {
  interested: ['Interested', 'bg-blue-100 text-blue-800'],
  rejected: ['Rejected', 'bg-red-100 text-red-800'],
  confirmed: ['Confirmed', 'bg-green-100 text-green-800']
};

const TASK = {
  rejected: ['✏️', 'Fix rejected property'],
  overdue: ['⏰', 'Overdue brief'],
  empty: ['📭', 'No properties yet'],
  clusters: ['🗺️', 'No clusters yet']
};

const day = (v) => (v ? new Date(v).toLocaleDateString() : '—');

function Box({ children, className = '' }) {
  return <div className={`bg-white rounded-lg shadow p-5 ${className}`}>{children}</div>;
}

function Stat({ title, value, tone = 'blue', onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg shadow p-4 border-t-4 ${TONES[tone]} ${onClick ? 'cursor-pointer hover:shadow-lg' : ''}`}
    >
      <p className="text-xs text-gray-500">{title}</p>
      <p className="text-3xl font-bold text-gray-800">{value}</p>
    </div>
  );
}

function Bar({ label, count, total, color }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm mb-2">
      <span className="w-28 text-gray-600">{label}</span>
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-2 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right font-semibold">{count}</span>
    </div>
  );
}

function Banner({ name, text }) {
  return (
    <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white rounded-lg p-6">
      <h2 className="text-2xl font-bold">Welcome back{name ? `, ${name}` : ''} 👋</h2>
      <p className="text-blue-100 text-sm mt-1">{text}</p>
      <p className="text-blue-200 text-xs mt-3">
        {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
    </div>
  );
}

function ListBox({ title, empty, children, hasItems }) {
  return (
    <Box>
      <p className="font-semibold mb-3">{title}</p>
      {hasItems ? <div className="divide-y divide-gray-100">{children}</div> : <p className="text-sm text-gray-400">{empty}</p>}
    </Box>
  );
}

function Decisions({ list }) {
  return (
    <ListBox
      title="Recent client decisions"
      empty="No client decisions yet."
      hasItems={list.length > 0}
    >
      {list.map((d) => {
        const [label, cls] = DECISION_LABEL[d.decision] || [d.decision, 'bg-gray-100 text-gray-800'];
        return (
          <div key={`${d.property_id}-${d.at}`} className="py-2 text-sm">
            <div className="flex justify-between gap-2">
              <p className="font-semibold">{d.title}</p>
              <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${cls}`}>{label}</span>
            </div>
            <p className="text-xs text-gray-500">
              {d.client_label} · {day(d.at)}
            </p>
            {d.comment && <p className="text-gray-700 mt-1">“{d.comment}”</p>}
          </div>
        );
      })}
    </ListBox>
  );
}

// ==================== MANAGER ====================
function ManagerView({ data, user, onNavigate }) {
  const s = data.stats;
  const p = data.pipeline;
  const d = data.decisions;
  const totalApproval = p.review + p.approved + p.rejected;
  const totalDecisions = d.pending + d.interested + d.rejected + d.confirmed;

  return (
    <div className="space-y-6">
      <Banner name={user?.name} text="Here is what is happening across your team today." />

      <div className="flex flex-wrap gap-3">
        {s.overdue_briefs > 0 && (
          <span className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold">
            Overdue ({s.overdue_briefs})
          </span>
        )}
        {s.pending_briefs > 0 && (
          <button
            onClick={() => onNavigate('clients')}
            className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-semibold hover:bg-yellow-600"
          >
            Briefs awaiting approval ({s.pending_briefs})
          </button>
        )}
        {s.properties_in_review > 0 && (
          <button
            onClick={() => onNavigate('properties', { status: 'review' })}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
          >
            Properties to approve ({s.properties_in_review})
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <Stat title="Total clients" value={s.total_clients} tone="blue" onClick={() => onNavigate('clients')} />
        <Stat title="Active briefs" value={s.active_briefs} tone="green" />
        <Stat title="Briefs awaiting approval" value={s.pending_briefs} tone="yellow" onClick={() => onNavigate('clients')} />
        <Stat title="Properties to approve" value={s.properties_in_review} tone="purple" onClick={() => onNavigate('properties', { status: 'review' })} />
        <Stat title="Overdue briefs" value={s.overdue_briefs} tone={s.overdue_briefs ? 'red' : 'gray'} />
        <Stat title="Confirmed by clients" value={s.clients_confirmed} tone="green" onClick={() => onNavigate('properties', { decision: 'confirmed' })} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Box>
          <p className="font-semibold mb-3">Properties by approval</p>
          <Bar label="Review" count={p.review} total={totalApproval} color="bg-yellow-500" />
          <Bar label="Approved" count={p.approved} total={totalApproval} color="bg-green-500" />
          <Bar label="Rejected" count={p.rejected} total={totalApproval} color="bg-red-500" />
        </Box>
        <Box>
          <p className="font-semibold mb-3">Client decisions (approved properties)</p>
          <Bar label="Awaiting" count={d.pending} total={totalDecisions} color="bg-gray-400" />
          <Bar label="Interested" count={d.interested} total={totalDecisions} color="bg-blue-500" />
          <Bar label="Rejected" count={d.rejected} total={totalDecisions} color="bg-red-500" />
          <Bar label="Confirmed" count={d.confirmed} total={totalDecisions} color="bg-green-500" />
        </Box>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ListBox title="Briefs awaiting approval" empty="Nothing waiting." hasItems={data.awaiting_briefs.length > 0}>
          {data.awaiting_briefs.map((b) => (
            <div key={b.id} className="py-2 text-sm cursor-pointer hover:bg-gray-50" onClick={() => onNavigate('clients')}>
              <p className="font-semibold text-blue-600">{b.title}</p>
              <p className="text-xs text-gray-500">{b.client_label} · {day(b.at)}</p>
            </div>
          ))}
        </ListBox>
        <ListBox title="Overdue briefs" empty="No overdue briefs." hasItems={data.overdue.length > 0}>
          {data.overdue.map((b) => (
            <div key={b.id} className="py-2 text-sm">
              <p className="font-semibold">{b.title}</p>
              <p className="text-xs text-gray-500">{b.client_label} · due {day(b.due_date)} · {b.assigned_name}</p>
            </div>
          ))}
        </ListBox>
        <ListBox title="Active briefs with no employee" empty="Every active brief is assigned." hasItems={data.unassigned.length > 0}>
          {data.unassigned.map((b) => (
            <div key={b.id} className="py-2 text-sm cursor-pointer hover:bg-gray-50" onClick={() => onNavigate('clients')}>
              <p className="font-semibold">{b.title}</p>
              <p className="text-xs text-gray-500">{b.client_label}</p>
            </div>
          ))}
        </ListBox>
      </div>

      <Box className="overflow-x-auto">
        <p className="font-semibold mb-3">Team activity</p>
        {data.team.length === 0 ? (
          <p className="text-sm text-gray-400">No active employees yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Employee</th>
                <th className="px-3 py-2 text-left">Active briefs</th>
                <th className="px-3 py-2 text-left">Overdue</th>
                <th className="px-3 py-2 text-left">Properties</th>
                <th className="px-3 py-2 text-left">In review</th>
                <th className="px-3 py-2 text-left">Approved</th>
                <th className="px-3 py-2 text-left">Rejected</th>
                <th className="px-3 py-2 text-left">Last activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.team.map((t) => (
                <tr key={t.id}>
                  <td className="px-3 py-3 font-semibold">{t.name}</td>
                  <td className="px-3 py-3">{t.active_briefs}</td>
                  <td className={`px-3 py-3 ${t.overdue ? 'text-red-600 font-semibold' : ''}`}>{t.overdue}</td>
                  <td className="px-3 py-3">{t.properties}</td>
                  <td className="px-3 py-3">{t.in_review}</td>
                  <td className="px-3 py-3">{t.approved}</td>
                  <td className="px-3 py-3">{t.rejected}</td>
                  <td className="px-3 py-3">{day(t.last_activity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Box>

      <Decisions list={data.recent_decisions} />
    </div>
  );
}

// ==================== EMPLOYEE ("MY WORK") ====================
function EmployeeView({ data, user, onNavigate }) {
  const s = data.stats;
  const p = data.pipeline;
  const totalApproval = p.review + p.approved + p.rejected;

  const go = (kind) => {
    if (kind === 'rejected') onNavigate('properties', { status: 'rejected' });
    else onNavigate('clients');
  };

  return (
    <div className="space-y-6">
      <Banner name={user?.name} text="Your briefs, and what needs your attention." />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat title="My active briefs" value={s.active_briefs} tone="blue" onClick={() => onNavigate('clients')} />
        <Stat title="Overdue" value={s.overdue_briefs} tone={s.overdue_briefs ? 'red' : 'gray'} />
        <Stat title="Waiting for approval" value={s.in_review} tone="yellow" onClick={() => onNavigate('properties', { status: 'review' })} />
        <Stat title="Rejected, to fix" value={s.rejected_to_fix} tone={s.rejected_to_fix ? 'red' : 'gray'} onClick={() => onNavigate('properties', { status: 'rejected' })} />
        <Stat title="Approved" value={s.approved} tone="green" onClick={() => onNavigate('properties', { status: 'approved' })} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ListBox title="My pending work" empty="Nothing needs your attention right now. Nice work." hasItems={data.todo.length > 0}>
          {data.todo.map((t, i) => {
            const [icon, label] = TASK[t.kind] || ['•', t.kind];
            return (
              <div key={i} className="py-2 text-sm cursor-pointer hover:bg-gray-50 flex gap-3" onClick={() => go(t.kind)}>
                <span>{icon}</span>
                <div>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="font-semibold">{t.title}</p>
                  <p className="text-xs text-gray-500">{t.subtitle}</p>
                </div>
              </div>
            );
          })}
        </ListBox>

        <Box>
          <p className="font-semibold mb-3">My properties by approval</p>
          <Bar label="Review" count={p.review} total={totalApproval} color="bg-yellow-500" />
          <Bar label="Approved" count={p.approved} total={totalApproval} color="bg-green-500" />
          <Bar label="Rejected" count={p.rejected} total={totalApproval} color="bg-red-500" />
        </Box>
      </div>

      <Decisions list={data.recent_decisions} />
    </div>
  );
}

export default function Dashboard({ token, user, isManager, onNavigate }) {
  const call = useMemo(() => makeCall(token), [token]);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    const load = () =>
      call('/overview')
        .then((d) => alive && setData(d))
        .catch((e) => alive && setError(e.message));
    load();
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, 60000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [call]);

  if (!data) return <p className="text-gray-500">{error || 'Loading…'}</p>;

  return data.role === 'manager' && isManager ? (
    <ManagerView data={data} user={user} onNavigate={onNavigate} />
  ) : (
    <EmployeeView data={data} user={user} onNavigate={onNavigate} />
  );
}