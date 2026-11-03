import React, { useState } from 'react';

// Manager only: download everything held about a client, or delete it all permanently
export default function ClientDataTools({ call, client, onDeleted }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const download = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await call(`/clients/${client.id}/export`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `client-${client.client_number}-data.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  const erase = async () => {
    setBusy(true);
    setError('');
    try {
      await call(`/clients/${client.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ confirm_name: typed })
      });
      onDeleted();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="pt-4 mt-4 border-t border-gray-200 space-y-3">
      <p className="font-semibold">Privacy and data</p>
      {error && <p className="text-red-600 text-xs">{error}</p>}

      <button
        onClick={download}
        disabled={busy}
        className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
      >
        Download all data
      </button>

      {!open ? (
        <div>
          <button
            onClick={() => setOpen(true)}
            className="px-3 py-2 text-sm bg-red-50 text-red-600 hover:bg-red-100 rounded-lg"
          >
            Delete client permanently…
          </button>
        </div>
      ) : (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
          <p className="text-xs text-red-800">
            This permanently deletes {client.name}, their login, every brief, property, photo and chat
            message. It cannot be undone. Download their data first if you may need it.
          </p>
          <input
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="Type the client's full name to confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={erase}
              disabled={busy || !typed.trim()}
              className="px-3 py-2 text-sm bg-red-600 text-white hover:bg-red-700 rounded-lg disabled:opacity-50"
            >
              Delete everything
            </button>
            <button
              onClick={() => {
                setOpen(false);
                setTyped('');
              }}
              className="px-3 py-2 text-sm bg-white border border-gray-300 hover:bg-gray-50 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}