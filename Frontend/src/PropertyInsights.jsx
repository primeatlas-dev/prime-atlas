import React, { useState } from 'react';
import { matchColor } from './Match';

const gbp = (n) => (n === null || n === undefined || n === '' ? '—' : `£${Number(n).toLocaleString()}`);
const FEE_STATUS = { not_due: 'Not due yet', due: 'Due', paid: 'Paid' };

function eventText(e) {
  switch (e.action) {
    case 'created': return ['🆕', 'Property created'];
    case 'edited': return ['✏️', `Edited: ${e.detail || 'details'}`];
    case 'media_added': return ['📷', `Added ${e.detail || 'a file'}`];
    case 'media_removed': return ['🗑️', `Removed ${e.detail || 'a file'}`];
    case 'approved': return ['✅', 'Approved'];
    case 'rejected': return ['❌', 'Rejected'];
    case 'review': return ['🔁', e.detail || 'Sent back to review'];
    case 'assigned': return ['📌', e.detail || 'Assigned to a brief'];
    case 'seller_confirmed': return ['🤝', 'Confirmed with the seller'];
    case 'seller_unconfirmed': return ['↩️', 'Seller confirmation removed'];
    case 'client_viewed': return ['👁️', 'Client viewed the property'];
    case 'client_interested': return ['👍', e.detail ? `Client is interested: “${e.detail}”` : 'Client is interested'];
    case 'client_rejected': return ['👎', e.detail ? `Client said not for me: “${e.detail}”` : 'Client said not for me'];
    case 'client_confirmed': return ['🎉', e.detail ? `Client confirmed: “${e.detail}”` : 'Client confirmed the property'];
    default: return ['•', e.action];
  }
}

function Box({ children }) {
  return <div className="bg-white rounded-lg shadow p-5">{children}</div>;
}

// Match score, fee confirmation (manager only) and activity history. Staff pages only.
export default function PropertyInsights({ data, isManager, call, propertyId, reload }) {
  const { property: p, match, activity = [], fee } = data;
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const sellerConfirm = async (confirmed) => {
    setBusy(true);
    setError('');
    try {
      await call(`/properties/${propertyId}/seller-confirmation`, {
        method: 'POST',
        body: JSON.stringify({ confirmed })
      });
      await reload();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  const events = showAll ? activity : activity.slice(0, 6);

  return (
    <div className="space-y-6">
      {match && (
        <Box>
          <div className="flex justify-between items-start mb-3">
            <p className="font-semibold text-blue-600">Match with the brief</p>
            {match.score !== null && (
              <span className={`px-3 py-1 rounded text-white text-sm font-semibold ${matchColor(match.score)}`}>
                {match.score}%
              </span>
            )}
          </div>

          {match.score === null ? (
            <p className="text-sm text-gray-500">The brief has no requirements to compare with yet.</p>
          ) : (
            <>
              <p className="text-sm font-semibold mb-1">{match.label}</p>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
                <div className={`h-2 ${matchColor(match.score)}`} style={{ width: `${match.score}%` }} />
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {match.parts.map((x) => (
                    <tr key={x.key}>
                      <td className="py-2">
                        {x.label}
                        <p className="text-xs text-gray-500">{x.note}</p>
                      </td>
                      <td className="py-2 text-right font-semibold whitespace-nowrap">
                        {x.points} / {x.max}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {match.flags.length > 0 && (
                <div className="mt-3 p-2 bg-red-50 rounded text-sm text-red-800">
                  <p className="font-semibold">Red flags (−{match.penalty} points)</p>
                  {match.flags.map((f) => (
                    <p key={f}>⚠ {f}</p>
                  ))}
                </div>
              )}
              {match.missing.length > 0 && (
                <p className="mt-3 text-xs text-yellow-700">
                  Not entered yet: {match.missing.join(', ')}. Fill these in for a fairer score.
                </p>
              )}
            </>
          )}
          <p className="text-xs text-gray-400 mt-3">Only your team sees this. Clients never do.</p>
        </Box>
      )}

      {isManager && fee && p.client_confirmed_at && (
        <Box>
          <p className="font-semibold text-blue-600 mb-3">Fee and seller confirmation</p>
          <div className="text-sm space-y-2">
            <p>
              <span className="text-gray-500">Client confirmed:</span>{' '}
              {new Date(p.client_confirmed_at).toLocaleString()}
            </p>
            <p>
              <span className="text-gray-500">Seller confirmed:</span>{' '}
              {p.seller_confirmed_at ? new Date(p.seller_confirmed_at).toLocaleString() : 'Not yet'}
            </p>
            <p>
              <span className="text-gray-500">Your fee for this brief:</span> {gbp(fee.commission_amount)} ·{' '}
              {FEE_STATUS[fee.fee_status] || fee.fee_status}
            </p>
          </div>
          {(fee.commission_amount === null || fee.commission_amount === undefined) && (
            <p className="text-xs text-yellow-700 mt-2">
              No commission is set for this brief yet. Add it under Brief details.
            </p>
          )}
          {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
          <div className="mt-3">
            {p.seller_confirmed_at ? (
              <button
                disabled={busy}
                onClick={() => sellerConfirm(false)}
                className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
              >
                Undo seller confirmation
              </button>
            ) : (
              <button
                disabled={busy}
                onClick={() => sellerConfirm(true)}
                className="px-3 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                Mark seller confirmed
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            The fee becomes due once the client and the seller have both confirmed.
          </p>
        </Box>
      )}

      <Box>
        <p className="font-semibold text-blue-600 mb-3">History</p>
        {events.length === 0 ? (
          <p className="text-sm text-gray-400">No activity yet.</p>
        ) : (
          <div className="space-y-3">
            {events.map((e) => {
              const [icon, text] = eventText(e);
              return (
                <div key={e.id} className="flex gap-3 text-sm">
                  <span>{icon}</span>
                  <div>
                    <p>{text}</p>
                    <p className="text-xs text-gray-500">
                      {e.who} · {new Date(e.at).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {activity.length > 6 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="mt-3 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            {showAll ? 'Show less' : `Show all (${activity.length})`}
          </button>
        )}
      </Box>
    </div>
  );
}