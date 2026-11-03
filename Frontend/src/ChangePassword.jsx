import React, { useState } from 'react';

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900';

// A button that opens a small "change my password" window. Works for staff and clients.
export default function ChangePassword({ call, light, label = 'Change password' }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const close = () => {
    setOpen(false);
    setCurrent('');
    setNext('');
    setAgain('');
    setError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (next.length < 8) {
      setError('Your new password needs at least 8 characters');
      return;
    }
    if (next !== again) {
      setError('The two new passwords do not match');
      return;
    }
    setBusy(true);
    try {
      const data = await call('/account/password', {
        method: 'POST',
        body: JSON.stringify({ current_password: current, new_password: next })
      });
      if (data.token) localStorage.setItem('token', data.token);
      setDone(true);
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          light
            ? 'px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white'
            : 'px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg'
        }
      >
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm text-gray-900">
            <h3 className="text-lg font-bold mb-4">Change password</h3>
            {done ? (
              <p className="text-green-700 text-sm">Password changed. Reloading…</p>
            ) : (
              <form onSubmit={submit} className="space-y-3">
                <input
                  className={inputClass}
                  type="password"
                  placeholder="Current password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  required
                />
                <input
                  className={inputClass}
                  type="password"
                  placeholder="New password (8+ characters)"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  required
                />
                <input
                  className={inputClass}
                  type="password"
                  placeholder="Repeat the new password"
                  value={again}
                  onChange={(e) => setAgain(e.target.value)}
                  required
                />
                {error && <p className="text-red-600 text-sm">{error}</p>}
                <p className="text-xs text-gray-500">
                  You will be signed out on every other device.
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg disabled:opacity-50"
                  >
                    Change password
                  </button>
                  <button type="button" onClick={close} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}