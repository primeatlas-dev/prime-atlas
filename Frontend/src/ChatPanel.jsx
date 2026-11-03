import React, { useState, useEffect, useRef } from 'react';
import { getSupabase } from './supabaseClient';

const BUCKET = 'property-media';
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,application/pdf';
const MAX_BYTES = 10 * 1024 * 1024;

// One conversation. Works for staff and for clients: the server decides who is shown as whom.
export default function ChatPanel({ call, basePath, onChange }) {
  const [thread, setThread] = useState(null);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const callRef = useRef(call);
  callRef.current = call;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const pathRef = useRef(basePath);
  pathRef.current = basePath;
  const listRef = useRef(null);
  const urlCache = useRef({});

  // Keep each attachment's link steady between refreshes, so images don't reload every few seconds
  const steady = (messages) =>
    messages.map((m) => {
      if (!m.attachment) return m;
      const hit = urlCache.current[m.id];
      if (hit && Date.now() - hit.at < 40 * 60 * 1000) {
        return { ...m, attachment: { ...m.attachment, url: hit.url } };
      }
      urlCache.current[m.id] = { url: m.attachment.url, at: Date.now() };
      return m;
    });

  const load = async (notify) => {
    const path = basePath;
    try {
      const data = await callRef.current(path);
      if (path !== pathRef.current) return;
      setThread({ ...data, messages: steady(data.messages) });
      setError('');
      if (notify && onChangeRef.current) onChangeRef.current();
    } catch (e) {
      if (path === pathRef.current) setError(e.message);
    }
  };

  useEffect(() => {
    setThread(null);
    urlCache.current = {};
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

  const pickFile = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setError('Files must be under 10 MB');
      return;
    }
    setError('');
    setFile(f);
  };

  const send = async () => {
    const body = text.trim();
    if ((!body && !file) || sending) return;
    setSending(true);
    setError('');
    try {
      let attachment = null;
      if (file) {
        const { path, token } = await callRef.current(`${basePath}/upload-url`, {
          method: 'POST',
          body: JSON.stringify({ content_type: file.type, size: file.size })
        });
        const { error: upError } = await getSupabase()
          .storage.from(BUCKET)
          .uploadToSignedUrl(path, token, file, { contentType: file.type });
        if (upError) throw new Error(upError.message);
        attachment = { path, type: file.type };
      }
      await callRef.current(basePath, { method: 'POST', body: JSON.stringify({ body, attachment }) });
      setText('');
      setFile(null);
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
                {m.attachment &&
                  (m.attachment.type === 'application/pdf' ? (
                    <a
                      href={m.attachment.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block underline text-sm mb-1"
                    >
                      📄 PDF document
                    </a>
                  ) : (
                    <a href={m.attachment.url} target="_blank" rel="noreferrer">
                      <img src={m.attachment.url} alt="" className="max-h-48 rounded mb-1" />
                    </a>
                  ))}
                {m.body && <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>}
                <p className={`text-xs mt-1 ${m.mine ? 'text-blue-100' : 'text-gray-400'}`}>
                  {new Date(m.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
      </div>

      {error && <p className="text-red-600 text-xs mt-2">{error}</p>}

      {file && (
        <div className="mt-2 flex items-center justify-between bg-blue-50 rounded-lg px-3 py-1 text-xs text-blue-900">
          <span className="truncate">📎 {file.name}</span>
          <button onClick={() => setFile(null)} className="ml-2 text-blue-900 font-bold">✕</button>
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <label className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer self-end" title="Attach a photo or PDF">
          📎
          <input type="file" accept={ACCEPT} className="hidden" onChange={pickFile} />
        </label>
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
          disabled={sending || (!text.trim() && !file)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {sending ? '…' : 'Send'}
        </button>
      </div>
    </div>
  );
}