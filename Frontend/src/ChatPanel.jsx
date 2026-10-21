import React, { useState, useEffect, useRef } from 'react';

// One conversation. Works for staff and for clients: the server decides who is shown as whom.
export default function ChatPanel({ call, basePath, onChange }) {
  const [thread, setThread] = useState(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const callRef = useRef(call);
  callRef.current = call;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const pathRef = useRef(basePath);
  pathRef.current = basePath;
  const listRef = useRef(null);

  const load = async (notify) => {
    const path = basePath;
    try {
      const data = await callRef.current(path);
      if (path !== pathRef.current) return;
      setThread(data);
      setError('');
      if (notify && onChangeRef.current) onChangeRef.current();
    } catch (e) {
      if (path === pathRef.current) setError(e.message);
    }
  };

  useEffect(() => {
    setThread(null);
    load(true);
    const timer = setInterval(() => {
      if (!document.hidden) load(false);
    }, 8000);
    return () => clearInterval(timer);
  }, [basePath]);

  const count = thread ? thread.messages.length : 0;
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [count]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError('');
    try {
      await callRef.current(basePath, { method: 'POST', body: JSON.stringify({ body }) });
      setText('');
      await load(true);
    } catch (e) {
      setError(e.message);
    }
    setSending(false);
  };

  return (
    <div className="bg-white rounded-lg shadow p-5">
      <p className="font-semibold text-blue-600">Chat</p>
      <p className="text-xs text-gray-500 mb-3">{thread ? `With ${thread.chat_with}` : 'Loading…'}</p>

      <div ref={listRef} className="h-72 overflow-y-auto space-y-3 p-3 bg-gray-50 rounded-lg">
        {thread && thread.messages.length === 0 && (
          <p className="text-sm text-gray-400 text-center mt-8">No messages yet. Say hello!</p>
        )}
        {thread &&
          thread.messages.map((m) => (
            <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 ${
                  m.mine ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200'
                }`}
              >
                <p className={`text-xs mb-1 ${m.mine ? 'text-blue-100' : 'text-gray-500'}`}>{m.from}</p>
                <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`text-xs mt-1 ${m.mine ? 'text-blue-100' : 'text-gray-400'}`}>
                  {new Date(m.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
      </div>

      {error && <p className="text-red-600 text-xs mt-2">{error}</p>}

      <div className="flex gap-2 mt-3">
        <textarea
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={2}
          maxLength={2000}
          placeholder="Type a message… (Enter to send)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button
          onClick={send}
          disabled={sending || !text.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}