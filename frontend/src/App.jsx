import { useEffect, useRef, useState } from "react"
import {
  createUser,
  getStats,
  listAuditLog,
  listUsers,
  login,
  logout,
  me,
  updateUser,
} from "./api"

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const C = {
  primary: "#4f46e5",
  primaryHover: "#4338ca",
  bg: "#f9fafb",
  surface: "#ffffff",
  border: "#e5e7eb",
  text: "#111827",
  muted: "#6b7280",
  error: "#ef4444",
  success: "#10b981",
  warning: "#f59e0b",
}

const ROLE_COLORS = {
  ADMIN: "#4f46e5",
  OPERATOR: "#0891b2",
  USER: "#059669",
  GUEST: "#9ca3af",
}

// ---------------------------------------------------------------------------
// Shared components
// ---------------------------------------------------------------------------

function Badge({ label, color }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 600,
      background: (color || C.primary) + "20",
      color: color || C.primary,
    }}>
      {label}
    </span>
  )
}

function Btn({ onClick, children, variant = "primary", disabled, small, style }) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: small ? "5px 12px" : "8px 18px",
    borderRadius: 6,
    fontSize: small ? 13 : 14,
    fontWeight: 500,
    cursor: disabled ? "not-allowed" : "pointer",
    border: "none",
    outline: "none",
    opacity: disabled ? 0.5 : 1,
    transition: "background 0.15s",
    ...style,
  }
  const variants = {
    primary: { background: C.primary, color: "#fff" },
    secondary: { background: C.border, color: C.text },
    danger: { background: "#fee2e2", color: C.error },
    ghost: { background: "transparent", color: C.muted, border: `1px solid ${C.border}` },
  }
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant] }}>
      {children}
    </button>
  )
}

function Input({ label, value, onChange, type = "text", placeholder, required, small }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && <label style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{label}{required && " *"}</label>}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          padding: small ? "6px 10px" : "8px 12px",
          border: `1px solid ${C.border}`,
          borderRadius: 6,
          fontSize: 14,
          color: C.text,
          background: C.surface,
          outline: "none",
        }}
      />
    </div>
  )
}

function ErrorBanner({ msg }) {
  if (!msg) return null
  return (
    <div style={{
      padding: "10px 14px",
      borderRadius: 6,
      background: "#fee2e2",
      color: C.error,
      fontSize: 13,
      marginBottom: 12,
    }}>
      {msg}
    </div>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
    }}>
      <div style={{
        background: C.surface, borderRadius: 10, padding: 28,
        width: 440, maxWidth: "90vw", boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: C.text }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: C.muted }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Login view
// ---------------------------------------------------------------------------

function LoginView({ onLogin }) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      await login(username, password)
      const user = await me()
      onLogin(user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: "100vh", background: C.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: C.surface, borderRadius: 12, padding: 40,
        width: 380, boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎤</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.text }}>Sprachbot</h1>
          <p style={{ margin: "6px 0 0", color: C.muted, fontSize: 14 }}>Melden Sie sich an</p>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <ErrorBanner msg={error} />
          <Input label="Benutzername" value={username} onChange={setUsername} required />
          <Input label="Passwort" type="password" value={password} onChange={setPassword} required />
          <Btn disabled={loading} style={{ width: "100%", justifyContent: "center", marginTop: 4 }}>
            {loading ? "Anmelden..." : "Anmelden"}
          </Btn>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Voice view (user interface — Sprint 2+ for STT/TTS/WebSocket)
// ---------------------------------------------------------------------------

function VoiceView({ user, onLogout }) {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Wie kann ich Ihnen helfen?", ts: new Date().toISOString() },
  ])
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const chatRef = useRef(null)

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages])

  const isAdmin = user.roles?.includes("ADMIN") || user.roles?.includes("OPERATOR")

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header style={{
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>🎤</span>
          <span style={{ fontWeight: 700, fontSize: 16, color: C.text }}>Sprachbot</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: C.muted }}>{user.username}</span>
          {isAdmin && (
            <Btn small variant="ghost" onClick={() => window.location.hash = "admin"}>
              Admin
            </Btn>
          )}
          <Btn small variant="ghost" onClick={onLogout}>Abmelden</Btn>
        </div>
      </header>

      {/* Chat area */}
      <div ref={chatRef} style={{
        flex: 1, overflowY: "auto", padding: "24px",
        display: "flex", flexDirection: "column", gap: 12,
        maxWidth: 720, width: "100%", margin: "0 auto",
      }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: "flex",
            justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
          }}>
            <div style={{
              maxWidth: "75%",
              padding: "10px 16px",
              borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              background: msg.role === "user" ? C.primary : C.surface,
              color: msg.role === "user" ? "#fff" : C.text,
              border: msg.role === "assistant" ? `1px solid ${C.border}` : "none",
              fontSize: 14,
              lineHeight: 1.5,
            }}>
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* Input area */}
      <div style={{
        background: C.surface, borderTop: `1px solid ${C.border}`,
        padding: "20px 24px",
      }}>
        <div style={{
          maxWidth: 720, margin: "0 auto",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
        }}>
          {/* Transcript display */}
          <div style={{
            width: "100%", minHeight: 36, padding: "8px 14px",
            borderRadius: 8, background: C.bg, border: `1px solid ${C.border}`,
            fontSize: 13, color: C.muted, textAlign: "center",
          }}>
            Transkription erscheint hier (verfügbar ab Sprint 2)
          </div>

          {/* Mic button */}
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <button
              disabled
              title="Spracherkennung wird in Sprint 2 implementiert"
              style={{
                width: 80, height: 80, borderRadius: "50%",
                background: C.border, color: C.muted,
                border: "none", cursor: "not-allowed",
                fontSize: 28, display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              }}
            >
              🎤
            </button>
          </div>

          {/* TTS toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.muted }}>
            <button
              onClick={() => setTtsEnabled(!ttsEnabled)}
              style={{
                padding: "4px 12px", borderRadius: 20,
                border: `1px solid ${C.border}`,
                background: ttsEnabled ? C.primary + "15" : C.bg,
                color: ttsEnabled ? C.primary : C.muted,
                cursor: "pointer", fontSize: 12, fontWeight: 500,
              }}
            >
              🔊 Sprachausgabe {ttsEnabled ? "ein" : "aus"}
            </button>
            <span style={{ fontSize: 11 }}>(TTS ab Sprint 3)</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Admin — Users section
// ---------------------------------------------------------------------------

function UsersSection({ currentUser }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [form, setForm] = useState({ username: "", email: "", password: "", roles: ["USER"] })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try { setUsers(await listUsers()) } catch (e) { setError(e.message) }
    setLoading(false)
  }

  async function handleCreate(e) {
    e.preventDefault()
    try {
      await createUser(form)
      setShowCreate(false)
      setForm({ username: "", email: "", password: "", roles: ["USER"] })
      await load()
    } catch (e) { setError(e.message) }
  }

  async function handleUpdate(e) {
    e.preventDefault()
    try {
      await updateUser(editUser.id, { roles: editUser.roles, is_active: editUser.is_active })
      setEditUser(null)
      await load()
    } catch (e) { setError(e.message) }
  }

  async function toggleActive(user) {
    try {
      await updateUser(user.id, { is_active: !user.is_active })
      await load()
    } catch (e) { setError(e.message) }
  }

  const ROLE_OPTIONS = ["ADMIN", "OPERATOR", "USER", "GUEST"]

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: C.text }}>Benutzerverwaltung</h2>
        <Btn onClick={() => setShowCreate(true)}>+ Benutzer erstellen</Btn>
      </div>

      <ErrorBanner msg={error} />

      {loading ? (
        <p style={{ color: C.muted }}>Lade...</p>
      ) : (
        <div style={{ background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                {["Benutzername", "E-Mail", "Rollen", "Status", "Erstellt", "Aktionen"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: C.muted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "12px 16px", fontSize: 14, color: C.text, fontWeight: 500 }}>{u.username}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: C.muted }}>{u.email}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {u.roles.map(r => <Badge key={r} label={r} color={ROLE_COLORS[r]} />)}
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <Badge label={u.is_active ? "Aktiv" : "Inaktiv"} color={u.is_active ? C.success : C.muted} />
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: C.muted }}>
                    {new Date(u.created_at).toLocaleDateString("de-DE")}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Btn small variant="ghost" onClick={() => setEditUser({ ...u })}>Bearbeiten</Btn>
                      {u.id !== currentUser.id && (
                        <Btn small variant={u.is_active ? "danger" : "secondary"} onClick={() => toggleActive(u)}>
                          {u.is_active ? "Deaktivieren" : "Aktivieren"}
                        </Btn>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <Modal title="Benutzer erstellen" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Input label="Benutzername" value={form.username} onChange={v => setForm(f => ({ ...f, username: v }))} required />
            <Input label="E-Mail" type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} required />
            <Input label="Passwort" type="password" value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} required />
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: C.text, display: "block", marginBottom: 6 }}>Rolle</label>
              <select
                value={form.roles[0]}
                onChange={e => setForm(f => ({ ...f, roles: [e.target.value] }))}
                style={{ padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, width: "100%" }}
              >
                {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <Btn variant="ghost" onClick={() => setShowCreate(false)}>Abbrechen</Btn>
              <Btn>Erstellen</Btn>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit modal */}
      {editUser && (
        <Modal title="Benutzer bearbeiten" onClose={() => setEditUser(null)}>
          <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ padding: "8px 12px", background: C.bg, borderRadius: 6, fontSize: 13, color: C.muted }}>
              {editUser.username} — {editUser.email}
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: C.text, display: "block", marginBottom: 6 }}>Rolle</label>
              <select
                value={editUser.roles[0]}
                onChange={e => setEditUser(u => ({ ...u, roles: [e.target.value] }))}
                style={{ padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, width: "100%" }}
              >
                {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <Btn variant="ghost" onClick={() => setEditUser(null)}>Abbrechen</Btn>
              <Btn>Speichern</Btn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Admin — Audit Log section
// ---------------------------------------------------------------------------

function AuditSection() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    listAuditLog({ limit: 100 })
      .then(setEvents)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const EVENT_COLORS = {
    admin_login: C.success, admin_logout: C.muted,
    user_created: C.primary, user_updated: C.warning,
    flow_created: C.primary, flow_updated: C.warning, flow_deleted: C.error,
    session_started: C.success, session_completed: C.success,
  }

  return (
    <div>
      <h2 style={{ margin: "0 0 20px", fontSize: 18, color: C.text }}>Audit-Log</h2>
      <ErrorBanner msg={error} />
      {loading ? (
        <p style={{ color: C.muted }}>Lade...</p>
      ) : (
        <div style={{ background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          {events.length === 0 ? (
            <p style={{ padding: 24, color: C.muted, textAlign: "center", margin: 0 }}>Keine Ereignisse</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                  {["Zeitstempel", "Ereignis", "Entity", "Details"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: C.muted }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map(e => (
                  <tr key={e.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "10px 16px", fontSize: 12, color: C.muted, whiteSpace: "nowrap" }}>
                      {new Date(e.created_at).toLocaleString("de-DE")}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      <Badge label={e.event_type} color={EVENT_COLORS[e.event_type] || C.muted} />
                    </td>
                    <td style={{ padding: "10px 16px", fontSize: 13, color: C.muted }}>
                      {e.entity_type || "—"}
                    </td>
                    <td style={{ padding: "10px 16px", fontSize: 12, color: C.muted }}>
                      {e.details && Object.keys(e.details).length > 0
                        ? JSON.stringify(e.details)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Admin — Dashboard section
// ---------------------------------------------------------------------------

function DashboardSection() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    getStats().then(setStats).catch(() => {})
  }, [])

  const tiles = [
    { label: "Aktive Sessions", value: stats?.active_sessions ?? "—", icon: "💬" },
    { label: "Sessions heute", value: stats?.sessions_today ?? "—", icon: "📊" },
    { label: "Erfolgsrate", value: stats ? `${(stats.success_rate * 100).toFixed(0)}%` : "—", icon: "✅" },
    { label: "Fehlerrate", value: stats ? `${(stats.error_rate * 100).toFixed(0)}%` : "—", icon: "⚠️" },
  ]

  return (
    <div>
      <h2 style={{ margin: "0 0 20px", fontSize: 18, color: C.text }}>Dashboard</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16, marginBottom: 32 }}>
        {tiles.map(t => (
          <div key={t.label} style={{
            background: C.surface, borderRadius: 10, padding: 20,
            border: `1px solid ${C.border}`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
          }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{t.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: C.text }}>{t.value}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{t.label}</div>
          </div>
        ))}
      </div>
      <Placeholder sprint={5} feature="Grafiken & Verlaufsdiagramme" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Placeholder for sections not yet implemented
// ---------------------------------------------------------------------------

function Placeholder({ sprint, feature }) {
  return (
    <div style={{
      padding: 40, borderRadius: 10, background: C.surface,
      border: `2px dashed ${C.border}`, textAlign: "center",
    }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🚧</div>
      <div style={{ fontWeight: 600, color: C.text, marginBottom: 6 }}>{feature}</div>
      <div style={{ fontSize: 13, color: C.muted }}>Wird in Sprint {sprint} implementiert</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Admin view
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "flows", label: "Flows", icon: "⚡" },
  { id: "sessions", label: "Sessions", icon: "💬" },
  { id: "users", label: "Benutzer", icon: "👥" },
  { id: "config", label: "Konfiguration", icon: "⚙️" },
  { id: "audit", label: "Audit-Log", icon: "📋" },
]

function AdminView({ user, onLogout, onVoice }) {
  const [section, setSection] = useState("dashboard")

  function renderContent() {
    switch (section) {
      case "dashboard": return <DashboardSection />
      case "users": return <UsersSection currentUser={user} />
      case "audit": return <AuditSection />
      case "flows": return <Placeholder sprint={3} feature="Flow-Verwaltung" />
      case "sessions": return <Placeholder sprint={4} feature="Sessions-Übersicht" />
      case "config": return <Placeholder sprint={5} feature="Provider-Konfiguration" />
      default: return null
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex" }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, background: C.surface,
        borderRight: `1px solid ${C.border}`,
        display: "flex", flexDirection: "column",
        position: "fixed", top: 0, bottom: 0, left: 0,
      }}>
        <div style={{ padding: "20px 16px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>🎤</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>Sprachbot</div>
              <div style={{ fontSize: 11, color: C.muted }}>Admin</div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: "12px 8px" }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              style={{
                width: "100%", padding: "9px 12px",
                borderRadius: 6, border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 10,
                background: section === item.id ? C.primary + "15" : "transparent",
                color: section === item.id ? C.primary : C.muted,
                fontSize: 13, fontWeight: section === item.id ? 600 : 400,
                marginBottom: 2,
              }}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div style={{ padding: "12px 8px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 12, color: C.muted, padding: "4px 12px", marginBottom: 4 }}>
            {user.username}
          </div>
          <button
            onClick={onVoice}
            style={{
              width: "100%", padding: "9px 12px", borderRadius: 6, border: "none",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
              background: "transparent", color: C.muted, fontSize: 13, marginBottom: 2,
            }}
          >
            🎤 Sprachinterface
          </button>
          <button
            onClick={onLogout}
            style={{
              width: "100%", padding: "9px 12px", borderRadius: 6, border: "none",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
              background: "transparent", color: C.muted, fontSize: 13,
            }}
          >
            ← Abmelden
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ marginLeft: 220, flex: 1, padding: 32 }}>
        {renderContent()}
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Root App
// ---------------------------------------------------------------------------

export default function App() {
  const [user, setUser] = useState(null)
  const [view, setView] = useState("login") // login | voice | admin
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    me()
      .then(u => {
        setUser(u)
        const isAdmin = u.roles?.includes("ADMIN") || u.roles?.includes("OPERATOR")
        setView(isAdmin ? "admin" : "voice")
      })
      .catch(() => {})
      .finally(() => setInitializing(false))
  }, [])

  async function handleLogin(u) {
    setUser(u)
    const isAdmin = u.roles?.includes("ADMIN") || u.roles?.includes("OPERATOR")
    setView(isAdmin ? "admin" : "voice")
  }

  async function handleLogout() {
    await logout()
    setUser(null)
    setView("login")
  }

  if (initializing) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
        <div style={{ color: C.muted, fontSize: 14 }}>Lade...</div>
      </div>
    )
  }

  if (view === "login" || !user) return <LoginView onLogin={handleLogin} />
  if (view === "admin") return <AdminView user={user} onLogout={handleLogout} onVoice={() => setView("voice")} />
  return <VoiceView user={user} onLogout={handleLogout} />
}
