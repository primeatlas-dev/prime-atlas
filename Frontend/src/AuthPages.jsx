import React, { useState } from 'react';
import { API_URL } from './api';

const inputClass =
  'w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

async function post(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export function AuthShell({ children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow p-6 w-full max-w-md text-gray-900">
        <h1 className="text-3xl font-bold mb-6 text-center">Prime Atlas</h1>
        {children}
      </div>
    </div>
  );
}

const linkButton = 'text-blue-600 hover:text-blue-800 text-sm font-semibold';
const mainButton =
  'w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50';

// Login step 2: the code from the authenticator app (or a recovery code)
export function TwoFactorStep({ challenge, onSuccess, onBack }) {
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { ok, data } = await post('/auth/2fa', { challenge, code });
      if (ok && data.token) {
        onSuccess(data);
        return;
      }
      setError(data.error || 'That code is not correct');
      if (/timed out/i.test(data.error || '')) setTimeout(onBack, 1500);
    } catch (err) {
      setError('Could not reach the server');
    }
    setBusy(false);
  };

  return (
    <AuthShell>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-gray-600">
          {recovery
            ? 'Enter one of your recovery codes. Each one works only once.'
            : 'Open your authenticator app and enter the 6-digit code for Prime Atlas.'}
        </p>
        <input
          className={`${inputClass} ${recovery ? '' : 'text-center text-2xl tracking-widest'}`}
          placeholder={recovery ? 'xxxxx-xxxxx' : '123456'}
          inputMode={recovery ? 'text' : 'numeric'}
          autoComplete="one-time-code"
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" disabled={busy} className={mainButton}>
          {busy ? 'Checking…' : 'Log in'}
        </button>
        <div className="flex justify-between">
          <button
            type="button"
            className={linkButton}
            onClick={() => {
              setRecovery(!recovery);
              setCode('');
              setError('');
            }}
          >
            {recovery ? 'Use the app code' : 'Use a recovery code'}
          </button>
          <button type="button" className={linkButton} onClick={onBack}>
            Back
          </button>
        </div>
      </form>
    </AuthShell>
  );
}

export function ForgotPassword({ onBack, defaultEmail }) {
  const [email, setEmail] = useState(defaultEmail || '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await post('/auth/forgot', { email });
      setMessage(data.message || 'If that email belongs to an account, we have sent a link to reset the password.');
    } catch (err) {
      setMessage('Could not reach the server');
    }
    setBusy(false);
  };

  return (
    <AuthShell>
      {message ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-700">{message}</p>
          <p className="text-xs text-gray-500">The link works for 30 minutes. Check your spam folder too.</p>
          <button type="button" className={linkButton} onClick={onBack}>
            Back to login
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-gray-600">Enter your email and we will send you a link to choose a new password.</p>
          <input
            className={inputClass}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button type="submit" disabled={busy} className={mainButton}>
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
          <button type="button" className={linkButton} onClick={onBack}>
            Back to login
          </button>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPassword({ token, onDone }) {
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Your new password needs at least 8 characters');
      return;
    }
    if (password !== again) {
      setError('The two passwords do not match');
      return;
    }
    setBusy(true);
    try {
      const { ok, data } = await post('/auth/reset', { token, password });
      if (ok) setDone(true);
      else setError(data.error || 'Something went wrong');
    } catch (err) {
      setError('Could not reach the server');
    }
    setBusy(false);
  };

  return (
    <AuthShell>
      {done ? (
        <div className="space-y-4">
          <p className="text-green-700 text-sm">Your password has been changed. You can now log in.</p>
          <button type="button" onClick={onDone} className={mainButton}>
            Go to login
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-gray-600">Choose a new password for your account.</p>
          <input
            className={inputClass}
            type="password"
            placeholder="New password (8+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
          <button type="submit" disabled={busy} className={mainButton}>
            {busy ? 'Saving…' : 'Change password'}
          </button>
          <button type="button" className={linkButton} onClick={onDone}>
            Back to login
          </button>
        </form>
      )}
    </AuthShell>
  );
}