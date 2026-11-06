import React, { useState, useEffect, useMemo } from 'react';
import { makeCall } from './api';

const ACTIONS = {
  client_data_exported: ["Downloaded a client's data", 'bg-yellow-100 text-yellow-800'],
  client_deleted: ['Deleted a client permanently', 'bg-red-100 text-red-800'],
  client_login_created: ['Created a client login', 'bg-blue-100 text-blue-800'],
  client_password_reset: ["Reset a client's password", 'bg-yellow-100 text-yellow-800'],
  client_access_on: ["Turned a client's access on", 'bg-green-100 text-green-800'],
  client_access_off: ["Turned a client's access off", 'bg-gray-100 text-gray-800'],
  employee_created: ['Created an employee account', 'bg-blue-100 text-blue-800'],
  employee_password_reset: ["Reset an employee's password", 'bg-yellow-100 text-yellow-800'],
  employee_activated: ['Reactivated an employee', 'bg-green-100 text-green-800'],
  employee_deactivated: ['Deactivated an employee', 'bg-gray-100 text-gray-800'],
  password_changed: ['Changed their own password', 'bg-gray-100 text-gray-800'],
  brief_approved: ['Approved a brief', 'bg-green-100 text-green-800'],
  brief_declined: ['Declined a brief', 'bg-red-100 text-red-800'],
  fee_marked_paid: ['Marked a fee as paid', 'bg-green-100 text-green-800'],
  fee_undo_paid: ['Undid a paid fee', 'bg-yellow-100 text-yellow-800'],
  seller_confirmed: ['Confirmed with the seller', 'bg-blue-100 text-blue-800'],
  seller_unconfirmed: ['Removed a seller confirmation', 'bg-gray-100 text-gray-800'],
  data_exported: ['Exported data to CSV', 'bg-yellow-100 text-yellow-800'],
  login_locked: ['Login locked after too many failed attempts', 'bg-red-100 text-red-800'],
  password_reset_by_email: ['Password reset using an email link', 'bg-yellow-100 text-yellow-800'],
  two_factor_enabled: ['Turned on two-factor login', 'bg-green-100 text-green-800'],
  two_factor_disabled: ['Turned off two-factor login', 'bg-red-100 text-red-800'],
  employee_2fa_reset: ["Reset an employee's two-factor login", 'bg-yellow-100 text-yellow-800']
};

function Box({ children, className = '' }) {
  return <div className={`bg-white rounded-lg shadow p-5 ${className}`}>{children}</div>;
}

export default function AdminPage({ token }) {
  const call = useMemo(() => makeCall(token), [token]);
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    call(`/audit?page=${page}`)
      .then((d) => {
        setData(d);
        setError('');
      })
      .catch((e) => setError(e.message));
  }, [call, page]);

  const download = async (what) => {
    setBusy(what);
    setError('');
    try {
      const out = await call(`/export/${what}`);
      const blob = new Blob(['\uFEFF' + out.csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = out.filename;
      a.click();
      URL.revokeObjectURL(url);
      setPage(1);
    } catch (e) {
      setError(e.message);
    }
    setBusy('');
  };

  return (
    <div className="space-y-6">
      <Box>
        <p className="font-semibold text-blue-600 mb-1">Export data</p>
        <p className="text-sm text-gray-600 mb-4">
          Download a spreadsheet (CSV) that opens in Excel. Exports contain personal data, so keep them
          somewhere private. Each export is recorded in the activity log below.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => download('briefs')}
            disabled={!!busy}
            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg disabled:opacity-50"
          >
            {busy === 'briefs' ? 'Preparing…' : 'Download briefs'}
          </button>
          <button
            onClick={() => download('properties')}
            disabled={!!busy}
            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg disabled:opacity-50"
          >
            {busy === 'properties' ? 'Preparing…' : 'Download properties'}
          </button>
        </div>
      </Box>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <Box className="overflow-x-auto">
        <p className="font-semibold text-blue-600 mb-1">Activity log</p>
        <p className="text-sm text-gray-600 mb-4">
          Sensitive actions: who did what, to whom, and when. Entries cannot be edited here.
        </p>

        {!data ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : data.rows.length === 0 ? (
          <p className="text-gray-500 text-sm">Nothing recorded yet.</p>
        ) : (
          <>
            <table className="w-full text-sm min-w-[640px]">
              <thead className="text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">When</th>
                  <th className="px-3 py-2 text-left">Who</th>
                  <th className="px-3 py-2 text-left">What</th>
                  <th className="px-3 py-2 text-left">About</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.rows.map((r) => {
                  const [text, cls] = ACTIONS[r.action] || [r.action, 'bg-gray-100 text-gray-800'];
                  return (
                    <tr key={r.id}>
                      <td className="px-3 py-3 whitespace-nowrap text-gray-600">{new Date(r.at).toLocaleString()}</td>
                      <td className="px-3 py-3">{r.actor_name || '—'}</td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${cls}`}>{text}</span>
                      </td>
                      <td className="px-3 py-3 text-gray-700">
                        {r.target_label || ''}
                        {r.detail && <p className="text-xs text-gray-500">{r.detail}</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-gray-500">
                Page {data.page} of {data.pages} · {data.total} entries
              </p>
              <div className="flex gap-2">
                <button
                  disabled={data.page <= 1}
                  onClick={() => setPage(data.page - 1)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-40"
                >
                  ← Newer
                </button>
                <button
                  disabled={data.page >= data.pages}
                  onClick={() => setPage(data.page + 1)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-40"
                >
                  Older →
                </button>
              </div>
            </div>
          </>
        )}
      </Box>
    </div>
  );
}