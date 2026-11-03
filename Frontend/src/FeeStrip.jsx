import React, { useState, useEffect } from 'react';

const gbp = (n) => `£${Number(n || 0).toLocaleString()}`;

// Manager dashboard: shown only when at least one fee is due
export default function FeeStrip({ call, onNavigate }) {
  const [s, setS] = useState(null);

  useEffect(() => {
    call('/fees/summary')
      .then(setS)
      .catch(() => {});
  }, [call]);

  if (!s || s.due_count === 0) return null;

  return (
    <div
      onClick={() => onNavigate('fees')}
      className="cursor-pointer bg-yellow-50 border border-yellow-300 text-yellow-900 rounded-lg p-4 mb-6 flex flex-wrap items-center justify-between gap-2 hover:bg-yellow-100"
    >
      <p>
        💷 <strong>{gbp(s.due_total)}</strong> in fees due across {s.due_count}{' '}
        {s.due_count === 1 ? 'brief' : 'briefs'}
      </p>
      <span className="text-sm font-semibold">Open the Fees page →</span>
    </div>
  );
}