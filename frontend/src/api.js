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
