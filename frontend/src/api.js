const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000"

function getToken() { return localStorage.getItem("sb_token") }
function setToken(t) { localStorage.setItem("sb_token", t) }
function clearToken() { localStorage.removeItem("sb_token") }

async function request(method, path, body) {
  const headers = { "Content-Type": "application/json" }
  const token = getToken()
  if (token) headers["Authorization"] = `Bearer ${token}`
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return null
  const data = await res.json().catch(() => ({ detail: res.statusText }))
  if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`)
  return data
}

export const login = async (username, password) => {
  const data = await request("POST", "/api/auth/login", { username, password })
  setToken(data.access_token)
  return data
}

export const logout = async () => {
  try { await request("POST", "/api/auth/logout") } catch (_) {}
  clearToken()
}

export const me = () => request("GET", "/api/auth/me")

export const listUsers = () => request("GET", "/api/admin/users")
export const createUser = (data) => request("POST", "/api/admin/users", data)
export const updateUser = (id, data) => request("PUT", `/api/admin/users/${id}`, data)

export const listAuditLog = (params = {}) => {
  const qs = new URLSearchParams(params).toString()
  return request("GET", `/api/admin/audit-log${qs ? `?${qs}` : ""}`)
}

export const getStats = () => request("GET", "/api/admin/stats")

// Sessions
export const startSession = () => request("POST", "/api/sessions")
export const getSession = (id) => request("GET", `/api/sessions/${id}`)
export const getMessages = (id) => request("GET", `/api/sessions/${id}/messages`)

export const processAudio = async (sessionId, blob, mimeType) => {
  const token = getToken()
  const form = new FormData()
  const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "mp4" : "webm"
  form.append("audio", blob, `audio.${ext}`)
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/process`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })
  const data = await res.json().catch(() => ({ detail: res.statusText }))
  if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`)
  return data
}

export const tts = (text) => request("POST", "/api/tts", { text })

// Provider-Konfiguration (Admin)
export const listProviders = () => request("GET", "/api/admin/providers")
export const getProvider = (name) => request("GET", `/api/admin/providers/${name}`)
export const upsertProvider = (name, data) => request("PUT", `/api/admin/providers/${name}`, data)

// Admin — Sessions
export const listAdminSessions = (limit = 200) => request("GET", `/api/admin/sessions?limit=${limit}`)

// Flows (Admin)
export const listFlows = () => request("GET", "/api/admin/flows")
export const getFlow = (id) => request("GET", `/api/admin/flows/${id}`)
export const createFlow = (data) => request("POST", "/api/admin/flows", data)
export const updateFlow = (id, data) => request("PUT", `/api/admin/flows/${id}`, data)
export const deleteFlow = (id) => request("DELETE", `/api/admin/flows/${id}`)

// Webhooks (Admin)
export const listWebhooks = () => request("GET", "/api/admin/webhooks")
export const getWebhook = (id) => request("GET", `/api/admin/webhooks/${id}`)
export const createWebhook = (data) => request("POST", "/api/admin/webhooks", data)
export const updateWebhook = (id, data) => request("PUT", `/api/admin/webhooks/${id}`, data)
export const deleteWebhook = (id) => request("DELETE", `/api/admin/webhooks/${id}`)
export const testWebhook = (id) => request("POST", `/api/admin/webhooks/${id}/test`)
