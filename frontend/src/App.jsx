import { useEffect, useRef, useState } from "react"
import {
  createUser,
  getStats,
  listAuditLog,
  listProviders,
  listUsers,
  login,
  logout,
  me,
  processAudio,
  startSession,
  updateUser,
  upsertProvider,
} from "./api"
import VoiceRecorder from "./VoiceRecorder"

// ---------------------------------------------------------------------------
// Design tokens — xqt5 design system
// ---------------------------------------------------------------------------
const C = {
  primary: "#ee7f00",
  primaryHover: "#cc6d00",
  sidebar: "#213452",
  sidebarHover: "#2d4263",
  bg: "#f5f5f5",
  surface: "#ffffff",
  border: "#e0e0e0",
  text: "#111827",
  muted: "#888888",
  error: "#ef4444",
  success: "#10b981",
  warning: "#f59e0b",
}

const ROLE_COLORS = {
  ADMIN: "#ee7f00",
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
    outline: { background: "transparent", color: C.primary, border: `1px solid ${C.primary}` },
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
      minHeight: "100vh", background: C.sidebar,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: C.surface, borderRadius: 12, padding: 40,
        width: 380, boxShadow: "0 8px 32px rgba(0,0,0,0.24)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: C.primary, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, margin: "0 auto 16px",
          }}>🎤</div>
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
// Voice view — Sprint 2: echte STT + Intent-Erkennung
// ---------------------------------------------------------------------------

function VoiceView({ user, onLogout, onAdmin }) {
  const [session, setSession] = useState(null)
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Wie kann ich Ihnen helfen?", id: "init" },
  ])
  const [transcript, setTranscript] = useState("")
  const [processing, setProcessing] = useState(false)
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const [debugData, setDebugData] = useState(null)
  const [showDebug, setShowDebug] = useState(false)
  const [error, setError] = useState("")
  const chatRef = useRef(null)
  const audioRef = useRef(null)
  const isAdmin = user.roles?.includes("ADMIN") || user.roles?.includes("OPERATOR")

  useEffect(() => {
    startSession().then(setSession).catch(e => setError(e.message))
  }, [])

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages])

  async function handleTranscript(blob, mimeType) {
    if (!session) throw new Error("Keine aktive Session")
    setError("")
    setTranscript("")
    setProcessing(true)

    try {
      const result = await processAudio(session.id, blob, mimeType)

      if (!result.transcript) {
        setTranscript("(Kein Text erkannt)")
        return
      }

      setTranscript(result.transcript)
      setDebugData(result)

      // Nutzer-Nachricht anzeigen
      setMessages(m => [...m, {
        id: "u" + Date.now(),
        role: "user",
        content: result.transcript,
      }])

      // Bot-Antwort anzeigen
      if (result.reply) {
        setMessages(m => [...m, {
          id: "a" + Date.now(),
          role: "assistant",
          content: result.reply,
          action: result.action,
        }])
      }

      // TTS abspielen
      if (ttsEnabled && result.audio_b64) {
        playAudio(result.audio_b64, result.audio_format || "mp3")
      }

      // Session nach Abschluss neu starten
      if (result.action === "complete") {
        const s = await startSession()
        setSession(s)
      }
    } finally {
      setProcessing(false)
    }
  }

  function playAudio(b64, format) {
    const binary = atob(b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const blob = new Blob([bytes], { type: `audio/${format}` })
    const url = URL.createObjectURL(blob)
    if (audioRef.current) {
      audioRef.current.pause()
      URL.revokeObjectURL(audioRef.current.src)
    }
    const audio = new Audio(url)
    audioRef.current = audio
    audio.play().catch(() => {})
  }

  async function handleReset() {
    if (audioRef.current) audioRef.current.pause()
    const s = await startSession()
    setSession(s)
    setMessages([{ role: "assistant", content: "Wie kann ich Ihnen helfen?", id: "init" }])
    setTranscript("")
    setDebugData(null)
    setError("")
  }

  const statusText = processing
    ? "Verarbeite..."
    : transcript || "Transkription erscheint hier..."

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header style={{
        background: C.sidebar,
        padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: C.primary, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 14,
          }}>🎤</div>
          <span style={{ fontWeight: 700, fontSize: 16, color: "#ffffff" }}>Sprachbot</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>{user.username}</span>
          {isAdmin && <Btn small variant="outline" onClick={onAdmin}>Admin</Btn>}
          <Btn small variant="outline" onClick={handleReset}>Neu starten</Btn>
          <Btn small variant="outline" onClick={onLogout}>Abmelden</Btn>
        </div>
      </header>

      {/* Chat */}
      <div ref={chatRef} style={{
        flex: 1, overflowY: "auto", padding: "24px",
        display: "flex", flexDirection: "column", gap: 12,
        maxWidth: 720, width: "100%", margin: "0 auto",
      }}>
        {messages.map(msg => (
          <div key={msg.id} style={{
            display: "flex",
            justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
          }}>
            <div style={{
              maxWidth: "75%", padding: "10px 16px",
              borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              background: msg.role === "user" ? C.primary : C.surface,
              color: msg.role === "user" ? "#fff" : C.text,
              border: msg.role === "assistant" ? `1px solid ${C.border}` : "none",
              fontSize: 14, lineHeight: 1.5,
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {/* Ladeindikator */}
        {processing && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{
              padding: "10px 16px", borderRadius: "16px 16px 16px 4px",
              background: C.surface, border: `1px solid ${C.border}`,
              fontSize: 14, color: C.muted,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{
                display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                background: C.primary,
                animation: "pulse 1s infinite",
              }} />
              <span style={{
                display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                background: C.primary, opacity: 0.6,
                animation: "pulse 1s 0.2s infinite",
              }} />
              <span style={{
                display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                background: C.primary, opacity: 0.3,
                animation: "pulse 1s 0.4s infinite",
              }} />
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div style={{ background: C.surface, borderTop: `1px solid ${C.border}`, padding: "20px 24px", flexShrink: 0 }}>
        <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>

          <div style={{
            width: "100%", minHeight: 38, padding: "8px 14px",
            borderRadius: 8, background: C.bg, border: `1px solid ${C.border}`,
            fontSize: 13, color: processing ? C.muted : (transcript ? C.text : C.muted),
            textAlign: "center", fontStyle: processing ? "italic" : "normal",
          }}>
            {statusText}
          </div>

          <ErrorBanner msg={error} />

          <VoiceRecorder
            onTranscript={handleTranscript}
            onError={setError}
            disabled={!session || processing}
          />

          {/* TTS Toggle + Debug */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              onClick={() => setTtsEnabled(t => !t)}
              style={{
                padding: "4px 12px", borderRadius: 20, cursor: "pointer",
                border: `1px solid ${C.border}`, fontSize: 12, fontWeight: 500,
                background: ttsEnabled ? C.primary + "15" : C.bg,
                color: ttsEnabled ? C.primary : C.muted,
              }}
            >
              🔊 Sprachausgabe {ttsEnabled ? "ein" : "aus"}
            </button>
            <button
              onClick={() => setShowDebug(d => !d)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: C.muted }}
            >
              {showDebug ? "▲" : "▼"} Debug
            </button>
          </div>

          {showDebug && debugData && (
            <div style={{
              width: "100%", padding: "12px 14px", borderRadius: 8,
              background: "#1e1e2e", color: "#cdd6f4",
              fontSize: 12, fontFamily: "monospace", textAlign: "left",
              maxHeight: 200, overflowY: "auto",
            }}>
              <div style={{ color: "#a6e3a1", marginBottom: 4 }}>Turn-Result</div>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                {JSON.stringify(debugData, null, 2)}
              </pre>
            </div>
          )}
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
  const [showInactive, setShowInactive] = useState(false)
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

  async function toggleActive(u) {
    try {
      await updateUser(u.id, { is_active: !u.is_active })
      await load()
    } catch (e) { setError(e.message) }
  }

  async function toggleAdmin(u) {
    const isAdmin = u.roles.includes("ADMIN")
    const newRoles = isAdmin
      ? u.roles.filter(r => r !== "ADMIN")
      : [...u.roles.filter(r => r !== "USER"), "ADMIN"]
    try {
      await updateUser(u.id, { roles: newRoles })
      await load()
    } catch (e) { setError(e.message) }
  }

  const visible = showInactive ? users : users.filter(u => u.is_active)

  const TH = ({ children }) => (
    <th style={{
      padding: "10px 16px", textAlign: "left", fontSize: 13,
      fontWeight: 600, color: C.text, background: C.bg,
      borderBottom: `1px solid ${C.border}`,
    }}>{children}</th>
  )

  return (
    <div>
      <ErrorBanner msg={error} />

      {/* Deaktivierte anzeigen */}
      <label style={{
        display: "flex", alignItems: "center", gap: 8,
        fontSize: 14, color: C.text, cursor: "pointer", marginBottom: 20,
      }}>
        <input
          type="checkbox"
          checked={showInactive}
          onChange={e => setShowInactive(e.target.checked)}
          style={{ width: 16, height: 16, cursor: "pointer" }}
        />
        Deaktivierte anzeigen
      </label>

      {loading ? (
        <p style={{ color: C.muted }}>Lade...</p>
      ) : (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <TH>Username</TH>
                <TH>Email</TH>
                <TH>Registriert</TH>
                <TH>Aktiv</TH>
                <TH>Admin</TH>
                <TH>Aktionen</TH>
              </tr>
            </thead>
            <tbody>
              {visible.map(u => (
                <tr key={u.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "14px 16px", fontSize: 14, color: C.text }}>{u.username}</td>
                  <td style={{ padding: "14px 16px", fontSize: 14, color: C.muted }}>{u.email}</td>
                  <td style={{ padding: "14px 16px", fontSize: 14, color: C.muted }}>
                    {new Date(u.created_at).toLocaleDateString("de-DE")}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <Toggle
                      checked={u.is_active}
                      onChange={() => toggleActive(u)}
                      disabled={u.id === currentUser.id}
                    />
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <Toggle
                      checked={u.roles.includes("ADMIN")}
                      onChange={() => toggleAdmin(u)}
                      disabled={u.id === currentUser.id}
                    />
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    {u.id !== currentUser.id && (
                      <button
                        onClick={() => toggleActive(u)}
                        style={{
                          padding: "6px 16px", borderRadius: 6, border: "none",
                          background: "#e53e3e", color: "#fff",
                          fontSize: 13, fontWeight: 500, cursor: "pointer",
                        }}
                      >
                        Löschen
                      </button>
                    )}
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
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <Btn variant="ghost" onClick={() => setShowCreate(false)}>Abbrechen</Btn>
              <Btn>Erstellen</Btn>
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

function ProviderSection() {
  const [apiKey, setApiKey] = useState("")
  const [llmModel, setLlmModel] = useState("mistral-large-latest")
  const [sttModel, setSttModel] = useState("mistral-stt-latest")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    listProviders().catch(() => {})
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError("")
    setSaved(false)
    try {
      await upsertProvider("mistral", {
        ...(apiKey ? { api_key: apiKey } : {}),
        llm_model: llmModel,
        stt_model: sttModel,
      })
      setSaved(true)
      setApiKey("")
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <h2 style={{ margin: "0 0 20px", fontSize: 18, color: C.text }}>Provider-Konfiguration</h2>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: C.text, marginBottom: 16 }}>Mistral AI</div>
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <ErrorBanner msg={error} />
          {saved && (
            <div style={{ padding: "8px 12px", borderRadius: 6, background: "#d1fae5", color: "#065f46", fontSize: 13 }}>
              Gespeichert
            </div>
          )}
          <Input
            label="API-Key (leer lassen um bestehenden zu behalten)"
            type="password"
            value={apiKey}
            onChange={setApiKey}
            placeholder="sk-..."
          />
          <Input label="LLM-Modell" value={llmModel} onChange={setLlmModel} />
          <Input label="STT-Modell" value={sttModel} onChange={setSttModel} />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Btn disabled={saving}>{saving ? "Speichern..." : "Speichern"}</Btn>
          </div>
        </form>
      </div>
    </div>
  )
}

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
// Toggle switch component
// ---------------------------------------------------------------------------

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      style={{
        position: "relative", width: 44, height: 24,
        borderRadius: 12, border: "none", cursor: disabled ? "not-allowed" : "pointer",
        background: checked ? C.primary : "#cccccc",
        transition: "background 0.2s", padding: 0, flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{
        position: "absolute", top: 3, left: checked ? 23 : 3,
        width: 18, height: 18, borderRadius: "50%", background: "#fff",
        transition: "left 0.2s", display: "block",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }} />
    </button>
  )
}

// ---------------------------------------------------------------------------
// Admin — icon-only sidebar
// ---------------------------------------------------------------------------

const SIDEBAR_ICONS = [
  { icon: "💬", action: "voice", title: "Sprachinterface" },
  { icon: "👤", action: "users", title: "Benutzer" },
]

const SIDEBAR_BOTTOM_ICONS = [
  { icon: "📊", action: "statistiken", title: "Statistiken" },
  { icon: "📄", action: "audit", title: "Audit-Logs" },
  { icon: "⚙️", action: "config", title: "Konfiguration" },
]

function AdminSidebar({ user, onLogout, onVoice, section, onSection }) {
  const initial = (user.username || "?")[0].toUpperCase()

  return (
    <aside style={{
      width: 52, background: C.sidebar,
      display: "flex", flexDirection: "column", alignItems: "center",
      position: "fixed", top: 0, bottom: 0, left: 0,
      paddingTop: 12, paddingBottom: 12,
    }}>
      {/* Logo */}
      <div style={{
        fontSize: 9, fontWeight: 800, color: C.primary, letterSpacing: 0.5,
        marginBottom: 20, textAlign: "center", lineHeight: 1.2,
      }}>
        XQT5
      </div>

      {/* Top icons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        {SIDEBAR_ICONS.map(item => (
          <button
            key={item.action}
            title={item.title}
            onClick={() => item.action === "voice" ? onVoice() : onSection(item.action)}
            style={{
              width: 36, height: 36, borderRadius: 8, border: "none",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              background: section === item.action ? "rgba(255,255,255,0.15)" : "transparent",
              fontSize: 16, color: "rgba(255,255,255,0.7)",
            }}
          >
            {item.icon}
          </button>
        ))}

        <div style={{ height: 1, background: "rgba(255,255,255,0.1)", margin: "8px 6px" }} />

        {SIDEBAR_BOTTOM_ICONS.map(item => (
          <button
            key={item.action}
            title={item.title}
            onClick={() => onSection(item.action)}
            style={{
              width: 36, height: 36, borderRadius: 8, border: "none",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              background: section === item.action ? `${C.primary}30` : "transparent",
              fontSize: 16, color: section === item.action ? C.primary : "rgba(255,255,255,0.7)",
            }}
          >
            {item.icon}
          </button>
        ))}
      </div>

      {/* User avatar + logout */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <div
          title={user.username}
          style={{
            width: 32, height: 32, borderRadius: "50%",
            background: C.primary, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700,
          }}
        >
          {initial}
        </div>
        <button
          title="Abmelden"
          onClick={onLogout}
          style={{
            width: 36, height: 36, borderRadius: 8, border: "none",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            background: "transparent", fontSize: 16, color: "rgba(255,255,255,0.5)",
          }}
        >
          →
        </button>
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------------------
// Admin — horizontal tab bar
// ---------------------------------------------------------------------------

const TABS = [
  { id: "users",       label: "Benutzer" },
  { id: "sessions",    label: "Sessions" },
  { id: "flows",       label: "Flows" },
  { id: "config",      label: "Provider" },
  { id: "audit",       label: "Audit-Logs" },
  { id: "statistiken", label: "Statistiken" },
]

function TabBar({ active, onChange }) {
  return (
    <div style={{
      display: "flex", gap: 0,
      borderBottom: `1px solid ${C.border}`,
      marginBottom: 24,
    }}>
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          style={{
            padding: "12px 16px", border: "none", background: "transparent",
            cursor: "pointer", fontSize: 14,
            color: active === tab.id ? C.primary : C.muted,
            fontWeight: active === tab.id ? 600 : 400,
            borderBottom: active === tab.id ? `2px solid ${C.primary}` : "2px solid transparent",
            marginBottom: -1,
            whiteSpace: "nowrap",
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Admin view
// ---------------------------------------------------------------------------

function AdminView({ user, onLogout, onVoice }) {
  const [section, setSection] = useState("users")

  function renderContent() {
    switch (section) {
      case "users":       return <UsersSection currentUser={user} />
      case "audit":       return <AuditSection />
      case "statistiken": return <DashboardSection />
      case "sessions":    return <Placeholder sprint={4} feature="Sessions-Übersicht" />
      case "flows":       return <Placeholder sprint={3} feature="Flow-Verwaltung" />
      case "config":      return <ProviderSection />
      default:            return null
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: C.surface, display: "flex" }}>
      <AdminSidebar
        user={user}
        onLogout={onLogout}
        onVoice={onVoice}
        section={section}
        onSection={setSection}
      />

      {/* Main content */}
      <main style={{ marginLeft: 52, flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Page header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 32px", borderBottom: `1px solid ${C.border}`,
        }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.text }}>Admin-Dashboard</h1>
          <Btn variant="ghost" onClick={onVoice}>Zurück zum Chat</Btn>
        </div>

        {/* Tabs + content */}
        <div style={{ padding: "0 32px 32px" }}>
          <div style={{ paddingTop: 20 }}>
            <TabBar active={section} onChange={setSection} />
            {renderContent()}
          </div>
        </div>
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
  return <VoiceView user={user} onLogout={handleLogout} onAdmin={() => setView("admin")} />
}
