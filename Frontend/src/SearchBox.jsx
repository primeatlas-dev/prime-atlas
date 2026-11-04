import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

export default function SearchBox({ call, onNavigate }) {
  const [text, setText] = useState('');
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const callRef = useRef(call);
  callRef.current = call;

  useEffect(() => {
    const q = text.trim();
    if (q.length < 2) {
      setResults(null);
      return undefined;
    }
    let alive = true;
    const timer = setTimeout(() => {
      callRef
        .current(`/search?q=${encodeURIComponent(q)}`)
        .then((d) => alive && setResults(d))
        .catch(() => alive && setResults({ clients: [], briefs: [], properties: [] }));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [text]);

  useEffect(() => {
    const close = (e) => {
      if (box.current && !box.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const go = (page, params) => {
    setOpen(false);
    setText('');
    setResults(null);
    onNavigate(page, params);
  };

  const none = results && !results.clients.length && !results.briefs.length && !results.properties.length;

  const Group = ({ title, children }) => (
    <div className="py-1">
      <p className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase">{title}</p>
      {children}
    </div>
  );

  const Row = ({ label, sub, tag, onClick }) => (
    <button onClick={onClick} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm">
      <p className="font-semibold text-gray-800 truncate">
        {label}
        {tag && <span className="ml-2 text-xs font-normal text-yellow-700">{tag}</span>}
      </p>
      {sub && <p className="text-xs text-gray-500 truncate">{sub}</p>}
    </button>
  );

  return (
    <div className="relative w-full" ref={box}>
      <Search size={16} className="absolute left-3 top-3 text-gray-400" />
      <input
        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Search clients, briefs, properties..."
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />

      {open && results && (
        <div className="absolute left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-30 max-h-96 overflow-y-auto">
          {none && <p className="px-4 py-4 text-sm text-gray-500">Nothing found.</p>}

          {results.clients.length > 0 && (
            <Group title="Clients">
              {results.clients.map((c) => (
                <Row key={c.id} label={c.label} onClick={() => go('clients', { clientId: c.id })} />
              ))}
            </Group>
          )}
          {results.briefs.length > 0 && (
            <Group title="Briefs">
              {results.briefs.map((b) => (
                <Row
                  key={b.id}
                  label={b.label}
                  sub={b.sub}
                  tag={b.pending ? 'awaiting approval' : ''}
                  onClick={() => go('clients', { briefId: b.id })}
                />
              ))}
            </Group>
          )}
          {results.properties.length > 0 && (
            <Group title="Properties">
              {results.properties.map((p) => (
                <Row
                  key={p.id}
                  label={p.label}
                  sub={p.sub}
                  tag={p.in_pool ? 'not in a brief' : ''}
                  onClick={() => go('properties', { propertyId: p.id })}
                />
              ))}
            </Group>
          )}
        </div>
      )}
    </div>
  );
}