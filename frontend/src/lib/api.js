/**
 * api.js — Typed API client
 * All requests return { data, error, status } — never throw.
 */

const BASE = import.meta.env.VITE_API_URL || '';

async function request(path, options = {}) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const json = await res.json();
    if (!res.ok) {
      return { data: null, error: json.error || `HTTP ${res.status}`, status: res.status };
    }
    return { data: json.data ?? json, error: null, status: res.status };
  } catch (err) {
    // Network failure → DB unavailable state
    return { data: null, error: 'Cannot reach API server', status: 0 };
  }
}

// ── Health ─────────────────────────────────────────────────────────────────────
export const getHealth = () => request('/api/health');

// ── Packages ──────────────────────────────────────────────────────────────────
export const getPackages = (ecosystem) =>
  request(`/api/packages${ecosystem ? `?ecosystem=${ecosystem}` : ''}`);

export const searchPackages = (q) =>
  request(`/api/packages/search?q=${encodeURIComponent(q)}`);

export const getPackage = (id) => request(`/api/packages/${id}`);

// ── Developers ────────────────────────────────────────────────────────────────
export const getDevelopers = () => request('/api/developers');

export const searchDevelopers = (q) =>
  request(`/api/developers/search?q=${encodeURIComponent(q)}`);

export const getDeveloper = (id) => request(`/api/developers/${id}`);

// ── Queries ───────────────────────────────────────────────────────────────────
export const getTransitiveDeps = (name) =>
  request(`/api/queries/transitive-deps?name=${encodeURIComponent(name)}`);

export const getBusFactor = () => request('/api/queries/bus-factor');

export const getBlastRadius = (username) =>
  request(`/api/queries/blast-radius?username=${encodeURIComponent(username)}`);

export const getShortestPath = (from, to) =>
  request(`/api/queries/shortest-path?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);

export const getTopPackages = (limit = 25) =>
  request(`/api/queries/top-packages?limit=${limit}`);

export const getDepGraph = (name) =>
  request(`/api/packages/graph?name=${encodeURIComponent(name)}`);
