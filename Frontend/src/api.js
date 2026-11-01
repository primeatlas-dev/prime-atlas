export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Returns a function that calls the backend with the logged-in token
export function makeCall(token) {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  return async (path, options = {}) => {
    const res = await fetch(`${API_URL}${path}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  };
}