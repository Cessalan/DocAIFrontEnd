import { auth } from '../Firebase/config';
import { API_BASE_URL } from './config';
export async function adminRequest(path, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in to access administration.');
  const token = await user.getIdToken();
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers } });
  } catch {
    const error = new Error(`Cannot connect to the admin backend at ${API_BASE_URL}. Check that the backend is running, then retry.`);
    error.code = 'unavailable';
    throw error;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(response.status === 404 ? 'The admin API is unavailable. Restart the backend with the latest code.' : typeof data.detail === 'string' ? data.detail : 'Admin request failed.');
    error.status = response.status;
    throw error;
  }
  return data;
}
