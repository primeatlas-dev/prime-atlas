import React, { useState, useEffect, useMemo } from 'react';
import { makeCall } from './api';

const inputClass =
  'w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function TeamPage({ token }) {
  const call = useMemo(() => makeCall(token), [token]);
  const [team, setTeam] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [message, setMessage] = useState('');

  const load = async () => {
    try {
      const data = await call('/team');
      setTeam(Array.isArray(data) ? data : []);
    } catch (e) {
      setMessage(e.message);
      setTeam([]);
    }
  };

  useEffect(() => {
    load();
  }, [call]);

  const addEmployee = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const data = await call('/team', { method: 'POST', body: JSON.stringify(form) });
      setForm({ name: '', email: '', password: '' });
      setMessage(`Account created for ${data.name}`);
      load();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const toggleActive = async (member) => {
    setMessage('');
    try {
      await call(`/team/${member.id}`, { method: 'PATCH', body: JSON.stringify({ active: !member.active }) });
      load();
    } catch (err) {
      setMessage(err.message);
    }
  };

  if (!team) return <p className="text-gray-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Add Employee</h2>
        <form onSubmit={addEmployee} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input className={inputClass} placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className={inputClass} type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <input className={inputClass} type="password" placeholder="Temporary password (8+ characters)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">
            Create Account
          </button>
        </form>
        {message && <p className="mt-3 text-sm text-gray-700">{message}</p>}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Team Members</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Email</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Role</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {team.map((member) => (
                <tr key={member.id}>
                  <td className="px-4 py-3 text-sm">{member.name}</td>
                  <td className="px-4 py-3 text-sm">{member.email}</td>
                  <td className="px-4 py-3 text-sm capitalize">{member.role}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${member.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {member.active ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {member.role !== 'manager' && (
                      <button onClick={() => toggleActive(member)} className="text-blue-600 hover:text-blue-800 font-semibold">
                        {member.active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}