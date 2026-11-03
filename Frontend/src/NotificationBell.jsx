import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';

// What each notification says and where it takes you
const ITEMS = {
  pending_briefs: { one: 'brief awaiting your approval', many: 'briefs awaiting your approval', page: 'clients' },
  properties_in_review: { one: 'property awaiting your approval', many: 'properties awaiting your approval', page: 'properties', params: { status: 'review' } },
  rejected_to_fix: { one: 'rejected property to fix', many: 'rejected properties to fix', page: 'properties', params: { status: 'rejected' } },
  overdue_briefs: { one: 'overdue brief', many: 'overdue briefs', page: 'dashboard' },
  unassigned_briefs: { one: 'active brief with no employee', many: 'active briefs with no employee', page: 'dashboard' },
  fees_due: { one: 'fee due to be collected', many: 'fees due to be collected', page: 'fees' },
  unread_chats: { one: 'unread chat message', many: 'unread chat messages', page: 'chats' }
};

export default function NotificationBell({ call, onNavigate, isManager }) {
  const [data, setData] = useState({ total: 0, items: [] });
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [n, f] = await Promise.all([
          call('/notifications'),
          isManager ? call('/fees/summary').catch(() => null) : Promise.resolve(null)
        ]);
        const items = [...n.items];
        let total = n.total;
        if (f && f.due_count > 0) {
          items.push({ key: 'fees_due', count: f.due_count });
          total += f.due_count;
        }
        if (alive) setData({ total, items });
      } catch (e) {
        // ignore
      }
    };
    load();
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, 60000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [call, isManager]);

  useEffect(() => {
    const close = (e) => {
      if (box.current && !box.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="relative" ref={box}>
      <button onClick={() => setOpen(!open)} className="relative p-2 hover:bg-gray-100 rounded-lg" title="Notifications">
        <Bell size={22} />
        {data.total > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-600 text-white text-xs rounded-full flex items-center justify-center">
            {data.total > 99 ? '99+' : data.total}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed sm:absolute right-3 sm:right-0 top-16 sm:top-auto mt-2 w-[calc(100vw-1.5rem)] sm:w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
          <p className="px-4 py-3 font-semibold border-b border-gray-100">Notifications</p>
          {data.items.length === 0 ? (
            <p className="px-4 py-4 text-sm text-gray-500">You are all caught up.</p>
          ) : (
            data.items.map((item) => {
              const info = ITEMS[item.key];
              if (!info) return null;
              return (
                <button
                  key={item.key}
                  onClick={() => {
                    setOpen(false);
                    onNavigate(info.page, info.params);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm border-b border-gray-50"
                >
                  <span className="font-bold text-blue-600">{item.count}</span>{' '}
                  {item.count === 1 ? info.one : info.many}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}