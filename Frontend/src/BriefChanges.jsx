import React, { useState, useEffect } from 'react';

// What changed in the client's requirements after the brief was approved
export default function BriefChanges({ call, briefId, version }) {
  const [list, setList] = useState(null);

  useEffect(() => {
    call(`/briefs/${briefId}/changes`)
      .then(setList)
      .catch(() => setList([]));
  }, [briefId, version]);

  if (!list || list.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow p-5 mt-6">
      <p className="font-semibold text-blue-600 mb-1">Changes to the requirements</p>
      <p className="text-xs text-gray-500 mb-4">
        Every time the requirements change after approval, the brief moves to a new version.
      </p>
      <div className="space-y-5">
        {list.map((v) => (
          <div key={v.id}>
            <p className="text-sm font-semibold">
              Version {v.version}
              <span className="text-gray-500 font-normal"> · {new Date(v.at).toLocaleString()}</span>
            </p>
            <div className="mt-1 space-y-1">
              {v.changes.map((c) => (
                <p key={c.field} className="text-sm text-gray-700">
                  <span className="font-semibold">{c.label}:</span>{' '}
                  <span className="text-gray-500 whitespace-pre-wrap">{c.from || 'empty'}</span>
                  {' → '}
                  <span className="whitespace-pre-wrap">{c.to || 'empty'}</span>
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}