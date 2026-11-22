import React from 'react';

// Shown to a client before they confirm a property. Nothing real is in here: the server sends
// no agent details at all until the client has confirmed, so these are only placeholder characters.
function Row({ label, fake }) {
  return (
    <span className="flex items-center justify-between gap-3 py-2 border-b border-gray-100">
      <span className="text-xs text-gray-500">{label}</span>
      <span aria-hidden="true" className="font-mono text-sm text-gray-700 blur-sm select-none">
        {fake}
      </span>
    </span>
  );
}

export default function LockedAgent() {
  return (
    <span className="block">
      <Row label="Name" fake="XXXXXXX XXXXXXXX" />
      <Row label="Phone" fake="+XX XXXXX XXXXXX" />
      <Row label="Email" fake="XXXXXXX@XXXXXXX.XXX" />
      <span className="mt-3 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
        <span aria-hidden="true">🔒</span>
        <span>Unlocks when you confirm this property</span>
      </span>
    </span>
  );
}