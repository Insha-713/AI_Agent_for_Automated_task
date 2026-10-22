/**
 * AgentFlow API Configuration
 * Resolves API URL via VITE_API_URL for production cloud deployments (e.g. Render backend with Vercel frontend)
 * with graceful fallback to relative paths for local development.
 */

const RAW_API_URL = (import.meta.env.VITE_API_URL || '').trim();

export const API_BASE_URL = RAW_API_URL.replace(/\/+$/, '');

/**
 * Returns fully-qualified API URL for a given endpoint path.
 * e.g. getApiUrl('/api/approvals/123') -> 'https://ai-agent-for-automated-task.onrender.com/api/approvals/123'
 * If VITE_API_URL is not set, returns '/api/approvals/123' for Vite dev proxy.
 */
export function getApiUrl(path = '') {
  if (!path) return API_BASE_URL;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (!API_BASE_URL) return cleanPath;
  return `${API_BASE_URL}${cleanPath}`;
}
