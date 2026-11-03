import React, { useState, useEffect, useMemo } from 'react';
import { Menu, Home, Users, TrendingUp, MessageCircle, LogOut } from 'lucide-react';
import ClientsPage from './Clients';
import ClientPortal from './ClientPortal';
import ChatsPage from './ChatsPage';
import Dashboard from './Dashboard';
import AllProperties from './AllProperties';
import TeamPage from './TeamPage';
import FeesPage from './Fees';
import NotificationBell from './NotificationBell';
import { API_URL, makeCall } from './api';

function readUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch (e) {
    return null;
  }
}

function Card({ children, className = '' }) {
  return <div className={`bg-white rounded-lg shadow p-6 ${className}`}>{children}</div>;
}

const PoundIcon = ({ size = 20 }) => (
  <span className="font-bold text-center" style={{ width: size, fontSize: size, lineHeight: 1 }}>
    £
  </span>
);

const SIDEBAR_CLASSES = 'bg-gradient-to-b from-blue-900 to-blue-800 text-white flex flex-col';

// ==================== MAIN APP ====================
export default function PrimeAtlasApp() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(readUser);
  const [page, setPage] = useState({ name: 'dashboard', params: null, n: 0 });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const call = useMemo(() => makeCall(token), [token]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  // Refresh who the user is (and their role) every time the app loads
  useEffect(() => {
    if (!token) return;
    call('/me')
      .then((me) => {
        if (me && me.id) {
          setUser(me);
          localStorage.setItem('user', JSON.stringify(me));
        }
      })
      .catch((e) => {
        if (/not logged in|invalid or expired|not active/i.test(e.message)) handleLogout();
      });
  }, [call]);

  if (!token) return <LoginPage setToken={setToken} setUser={setUser} />;

  if (user?.role === 'client') {
    return <ClientPortal token={token} user={user} onLogout={handleLogout} />;
  }

  const isManager = user?.role === 'manager';

  // Changing "n" re-opens the page fresh, so clicking a menu item always returns to its start
  const navigate = (name, params) => {
    setPage({ name, params: params || null, n: Date.now() });
    setMobileOpen(false);
  };

  const items = [
    { id: 'dashboard', label: isManager ? 'Dashboard' : 'My Work', icon: TrendingUp },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'properties', label: 'All Properties', icon: Home },
    { id: 'chats', label: 'Chats', icon: MessageCircle },
    ...(isManager
      ? [
          { id: 'fees', label: 'Fees', icon: PoundIcon },
          { id: 'team', label: 'Team', icon: Users }
        ]
      : [])
  ];
  const titles = Object.fromEntries(items.map((i) => [i.id, i.label]));

  const toggleMenu = () => {
    if (window.matchMedia('(min-width: 768px)').matches) setSidebarOpen(!sidebarOpen);
    else setMobileOpen(!mobileOpen);
  };

  const sidebarContent = (expanded, drawer) => (
    <>
      <div className="p-4 border-b border-blue-700 flex items-center justify-center">
        <div className="text-2xl font-bold">{expanded ? 'Prime Atlas' : 'PA'}</div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                page.name === item.id ? 'bg-blue-600 text-white' : 'text-blue-100 hover:bg-blue-700'
              }`}
            >
              <Icon size={20} />
              {expanded && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {!drawer && (
        <div className="p-4 border-t border-blue-700">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full py-2 text-blue-100 hover:bg-blue-700 rounded-lg"
          >
            {sidebarOpen ? '←' : '→'}
          </button>
        </div>
      )}
    </>
  );

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Computer: sidebar */}
      <div className={`hidden md:flex ${sidebarOpen ? 'w-64' : 'w-20'} ${SIDEBAR_CLASSES} transition-all duration-300`}>
        {sidebarContent(sidebarOpen, false)}
      </div>

      {/* Phone: slide-in menu */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className={`w-64 ${SIDEBAR_CLASSES}`}>{sidebarContent(true, true)}</div>
          <div className="flex-1 bg-black/40" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-white border-b border-gray-200 px-3 sm:px-6 py-3 sm:py-4 flex justify-between items-center gap-2">
          <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
            <button onClick={toggleMenu} className="p-2 hover:bg-gray-100 rounded-lg">
              <Menu size={24} />
            </button>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 truncate">{titles[page.name] || ''}</h1>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <NotificationBell call={call} onNavigate={navigate} />
            {user && (
              <span className="hidden md:inline text-sm text-gray-600">
                {user.name || user.email} · <span className="capitalize">{user.role}</span>
              </span>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-3 sm:px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-3 sm:p-6">
          {page.name === 'dashboard' && (
            <Dashboard key={page.n} token={token} user={user} isManager={isManager} onNavigate={navigate} />
          )}
          {page.name === 'clients' && <ClientsPage key={page.n} token={token} isManager={isManager} />}
          {page.name === 'properties' && (
            <AllProperties key={page.n} token={token} isManager={isManager} initialFilters={page.params} />
          )}
          {page.name === 'chats' && <ChatsPage key={page.n} token={token} />}
          {page.name === 'fees' && isManager && <FeesPage key={page.n} token={token} />}
          {page.name === 'team' && isManager && <TeamPage key={page.n} token={token} />}
        </div>
      </div>
    </div>
  );
}

// ==================== LOGIN PAGE ====================
function LoginPage({ setToken, setUser }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
        setToken(data.token);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Could not reach the server');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <h1 className="text-3xl font-bold mb-6 text-center">Prime Atlas</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
          >
            Login
          </button>
        </form>

        <p className="text-center text-gray-500 text-sm mt-4">Accounts are created by your manager.</p>
      </Card>
    </div>
  );
}