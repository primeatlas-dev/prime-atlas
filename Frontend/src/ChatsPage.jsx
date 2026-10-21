import React, { useState, useEffect, useMemo } from 'react';
import ChatPanel from './ChatPanel';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function makeCall(token) {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  return async (path, options = {}) => {
    const res = await fetch(`${API_URL}${path}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  };
}

export default function ChatsPage({ token }) {
  const call = useMemo(() => makeCall(token), [token]);
  const [threads, setThreads] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const load = () =>
    call('/chats')
      .then(setThreads)
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, 15000);
    return () => clearInterval(timer);
  }, [call]);

  if (!threads) return <p className="text-gray-500">{error || 'Loading…'}</p>;

  const q = search.trim().toLowerCase();
  const shown = threads.filter(
    (t) =>
      !q ||
      t.property_title.toLowerCase().includes(q) ||
      (t.address || '').toLowerCase().includes(q) ||
      t.client_label.toLowerCase().includes(q)
  );
  const open = threads.find((t) => t.property_id === openId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-white rounded-lg shadow p-4">
        <input
          className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Search chats..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="space-y-1 max-h-[70vh] overflow-y-auto">
          {shown.length === 0 && (
            <p className="text-sm text-gray-500 p-2">
              {threads.length === 0
                ? 'Chats appear here once a property is approved.'
                : 'No chats match your search.'}
            </p>
          )}
          {shown.map((t) => (
            <button
              key={t.property_id}
              onClick={() => setOpenId(t.property_id)}
              className={`w-full text-left px-3 py-3 rounded-lg transition-colors ${
                t.property_id === openId ? 'bg-blue-50 border-l-4 border-blue-600' : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex justify-between items-start gap-2">
                <p className="font-semibold text-sm truncate">{t.property_title}</p>
                {t.unread > 0 && (
                  <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-0.5">{t.unread}</span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                {t.client_label} · Brief #{t.brief_number}
              </p>
              <p className="text-xs text-gray-600 truncate">{t.last_message || 'No messages yet'}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="lg:col-span-2">
        {open ? (
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-bold">{open.property_title}</h2>
              <p className="text-sm text-gray-600">📍 {open.address}</p>
            </div>
            <ChatPanel key={open.property_id} call={call} basePath={`/properties/${open.property_id}/chat`} onChange={load} />
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow h-64 flex items-center justify-center text-gray-500">
            Select a chat to read the conversation
          </div>
        )}
      </div>
    </div>
  );
}