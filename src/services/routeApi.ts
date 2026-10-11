import { fetchAuthSession } from 'aws-amplify/auth';

// The SAM API serves routing under /api/* and storage at its root.
const base = (import.meta.env.VITE_ROUTE_API_URL?.trim() || import.meta.env.VITE_STORAGE_API_URL?.trim()
  || (import.meta.env.PROD ? 'https://xsvjrx04tl.execute-api.us-east-1.amazonaws.com' : '')).replace(/\/+$/, '');

export async function routeRequest(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  if (base) {
    const token = (await fetchAuthSession()).tokens?.idToken?.toString();
    if (!token) throw new Error('Sign in before using the route planner.');
    headers.set('Authorization', `Bearer ${token}`);
  }
  const response = await fetch(base + path, { ...options, headers });
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    throw new Error('The route planner API is not connected. Set VITE_ROUTE_API_URL to the deployed AirExpo API base URL (or use VITE_STORAGE_API_URL), then rebuild. The API must include the latest routing endpoints.');
  }
  let data;
  try { data = await response.json(); } catch { throw new Error('The routing API returned invalid JSON. Please retry.'); }
  if (!response.ok || !data?.success) throw new Error(data?.error || `Routing request failed (HTTP ${response.status}).`);
  return data;
}
