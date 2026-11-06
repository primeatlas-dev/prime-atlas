import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900';

// Staff only: turn two-factor login on or off, and manage recovery codes
export default function Security({ call, open, onClose }) {
  const [status, setStatus] = useState(null);
  const [view, setView] = useState('home'); // home | password | scan | codes | manage
  const [action, setAction] = useState(''); // disable | regen
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState(null);
  const [codes, setCodes] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setView('home');
    setAction('');
    setPassword('');
    setCode('');
    setSetup(null);
    setCodes(null);
    setError('');
  };

  useEffect(() => {
    if (!open) return;
    reset();
    setStatus(null);
    call('/account/2fa/status')
      .then(setStatus)
      .catch((e) => setError(e.message));
  }, [open]);

  if (!open) return null;

  const keepToken = (data) => {
    if (data && data.token) localStorage.setItem('token', data.token);
  };

  const startSetup = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await call('/account/2fa/setup', { method: 'POST', body: JSON.stringify({ password }) });
      const qr = await QRCode.toDataURL(data.uri, { width: 220, margin: 1 });
      setSetup({ secret: data.secret, qr });
      setPassword('');
      setCode('');
      setView('scan');
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  const confirmSetup = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await call('/account/2fa/enable', { method: 'POST', body: JSON.stringify({ code }) });
      keepToken(data);
      setCodes(data.recovery_codes);
      setView('codes');
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  const runManage = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (action === 'disable') {
        const data = await call('/account/2fa/disable', { method: 'POST', body: JSON.stringify({ password, code }) });
        keepToken(data);
        window.location.reload();
        return;
      }
      const data = await call('/account/2fa/recovery-codes', { method: 'POST', body: JSON.stringify({ password, code }) });
      setCodes(data.recovery_codes);
      setView('codes');
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  const close = () => {
    if (view === 'codes') {
      window.location.reload();
      return;
    }
    onClose();
  };

  const primary = 'px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg disabled:opacity-50';
  const secondary = 'px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md text-gray-900 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-4">Two-factor login</h3>

        {!status && !error && <p className="text-sm text-gray-500">Loading…</p>}
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

        {status && view === 'home' && (
          <div className="space-y-4">
            {!status.available ? (
              <p className="text-sm text-yellow-800 bg-yellow-50 rounded-lg p-3">
                Two-factor login has not been switched on in the server settings yet (TWO_FACTOR_KEY).
              </p>
            ) : status.enabled ? (
              <>
                <p className="text-sm text-green-700">✅ Two-factor login is ON for your account.</p>
                <p className="text-sm text-gray-600">Recovery codes left: <strong>{status.recovery_left}</strong></p>
                <div className="flex flex-wrap gap-2">
                  <button className={secondary} onClick={() => { setAction('regen'); setView('manage'); }}>
                    New recovery codes
                  </button>
                  <button
                    className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg"
                    onClick={() => { setAction('disable'); setView('manage'); }}
                  >
                    Turn off
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600">
                  With two-factor login, a stolen password is not enough to get in. You will also need a 6-digit
                  code from an authenticator app on your phone.
                </p>
                <button className={primary} onClick={() => setView('password')}>Turn on</button>
              </>
            )}
          </div>
        )}

        {view === 'password' && (
          <form onSubmit={startSetup} className="space-y-3">
            <p className="text-sm text-gray-600">First, confirm it is you. Enter your password.</p>
            <input className={inputClass} type="password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className={primary}>Continue</button>
              <button type="button" className={secondary} onClick={reset}>Back</button>
            </div>
          </form>
        )}

        {view === 'scan' && setup && (
          <form onSubmit={confirmSetup} className="space-y-3">
            <p className="text-sm text-gray-600">
              1. Open an authenticator app (such as Google Authenticator, Microsoft Authenticator or Authy) and scan this picture.
            </p>
            <img src={setup.qr} alt="Scan this with your authenticator app" className="mx-auto" />
            <p className="text-xs text-gray-500 break-all">
              Can't scan? Enter this key by hand: <span className="font-mono">{setup.secret}</span>
            </p>
            <p className="text-sm text-gray-600">2. Type the 6-digit code the app shows.</p>
            <input className={`${inputClass} text-center text-xl tracking-widest`} inputMode="numeric" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} required />
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className={primary}>Turn on</button>
              <button type="button" className={secondary} onClick={reset}>Cancel</button>
            </div>
          </form>
        )}

        {view === 'manage' && (
          <form onSubmit={runManage} className="space-y-3">
            <p className="text-sm text-gray-600">
              {action === 'disable'
                ? 'To turn it off, enter your password and a current code.'
                : 'To get new recovery codes (the old ones will stop working), enter your password and a current code.'}
            </p>
            <input className={inputClass} type="password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <input className={inputClass} placeholder="6-digit code or a recovery code" value={code} onChange={(e) => setCode(e.target.value)} required />
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className={primary}>{action === 'disable' ? 'Turn off' : 'Get new codes'}</button>
              <button type="button" className={secondary} onClick={reset}>Back</button>
            </div>
          </form>
        )}

        {view === 'codes' && codes && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Save these recovery codes somewhere safe, such as a password manager. Each one works once if you lose
              your phone. <strong>They will not be shown again.</strong>
            </p>
            <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-gray-50 rounded-lg p-3">
              {codes.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
            <div className="flex gap-2">
              <button className={secondary} onClick={() => navigator.clipboard && navigator.clipboard.writeText(codes.join('\n'))}>
                Copy
              </button>
              <button className={primary} onClick={() => window.location.reload()}>I have saved them</button>
            </div>
          </div>
        )}

        {view !== 'codes' && (
          <div className="mt-5 pt-4 border-t border-gray-100 text-right">
            <button className="text-sm text-gray-500 hover:text-gray-800" onClick={close}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}