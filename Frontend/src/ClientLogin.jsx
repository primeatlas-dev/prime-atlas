import React, { useState, useEffect } from 'react';

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

function randomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint32Array(12);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

export default function ClientLogin({ call, client }) {
  const [info, setInfo] = useState(null);
  const [email, setEmail] = useState(client.email || '');
  const [password, setPassword] = useState('');
  const [shown, setShown] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setInfo(await call(`/clients/${client.id}/login`));
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
  }, [client.id]);

  const detailsText = (mail, pass) =>
    `Prime Atlas login\nWebsite: ${window.location.origin}\nEmail: ${mail}\nPassword: ${pass}`;

  const createLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await call(`/clients/${client.id}/login`, {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      setShown(detailsText(email.trim().toLowerCase(), password));
      setPassword('');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const resetPassword = async () => {
    const newPassword = randomPassword();
    setError('');
    try {
      await call(`/clients/${client.id}/login`, {
        method: 'PATCH',
        body: JSON.stringify({ password: newPassword })
      });
      setShown(detailsText(info.email, newPassword));
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleAccess = async () => {
    setError('');
    try {
      await call(`/clients/${client.id}/login`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !info.active })
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const copy = () => {
    if (navigator.clipboard) navigator.clipboard.writeText(shown);
  };

  if (!info) return <p className="text-xs text-gray-500 pt-3">{error || 'Loading login…'}</p>;

  return (
    <div className="pt-4 mt-4 border-t border-gray-200 space-y-3">
      <p className="font-semibold">Client portal login</p>
      {error && <p className="text-red-600 text-xs">{error}</p>}

      {shown && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs">
          <p className="font-semibold text-green-800 mb-1">
            Send these details to your client. The password can't be shown again.
          </p>
          <pre className="whitespace-pre-wrap text-gray-800">{shown}</pre>
          <button onClick={copy} className="mt-2 px-3 py-1 bg-green-600 text-white rounded">
            Copy
          </button>
        </div>
      )}

      {info.has_login ? (
        <div className="space-y-2">
          <p>📧 {info.email}</p>
          <p>
            Access:{' '}
            <span className={info.active ? 'text-green-700 font-semibold' : 'text-red-600 font-semibold'}>
              {info.active ? 'On' : 'Off'}
            </span>
          </p>
          <div className="flex gap-2 flex-wrap">
            <button onClick={resetPassword} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg">
              Reset password
            </button>
            <button onClick={toggleAccess} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg">
              {info.active ? 'Turn off access' : 'Turn on access'}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={createLogin} className="space-y-2">
          <input
            type="email"
            className={inputClass}
            placeholder="Client's login email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <div className="flex gap-2">
            <input
              className={inputClass}
              placeholder="Password (8+ characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setPassword(randomPassword())}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg whitespace-nowrap"
            >
              Generate
            </button>
          </div>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">
            Create login
          </button>
        </form>
      )}
    </div>
  );
}