import { useEffect, useRef, useState } from "react"
import {
  createFlow,
  createUser,
  createWebhook,
  deleteFlow,
  deleteWebhook,
  getProvider,
  getStats,
  listAdminSessions,
  listAuditLog,
  listFlows,
  listProviders,
  listUsers,
  listWebhooks,
  login,
  logout,
  me,
  processAudio,
  startSession,
  testWebhook,
  updateFlow,
  updateUser,
  updateWebhook,
  upsertProvider,
} from "./api"
import VoiceRecorder from "./VoiceRecorder"
import FlowEditor from "./FlowEditor"

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

function Btn({ onClick, children, variant = "primary", disabled, small, style, type = "submit" }) {
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
    <button type={type} onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant] }}>
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

function Modal({ title, onClose, children, width = 440 }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
      overflowY: "auto", padding: "20px 0",
    }}>
      <div style={{
        background: C.surface, borderRadius: 10, padding: 28,
        width, maxWidth: "95vw", boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        margin: "auto",
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
  const [ttsEnabled, setTtsEnabled] = useState(false)
  const [ttsPlaying, setTtsPlaying] = useState(false)
  const [micMode, setMicMode] = useState(() => localStorage.getItem("sb_mic_mode") || "click")
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
      if (result.tts_error) setShowDebug(true)

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
      } else if (result.tts_error) {
        console.warn("TTS-Fehler:", result.tts_error)
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
    setTtsPlaying(true)
    audio.onended = () => setTtsPlaying(false)
    audio.onerror = () => setTtsPlaying(false)
    audio.play().catch(() => { setTtsPlaying(false) })
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
            mode={micMode}
            onTranscript={handleTranscript}
            onError={setError}
            disabled={!session || processing}
            listeningPaused={ttsPlaying}
          />

          {/* Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            {/* Mic mode toggle */}
            <div style={{
              display: "flex", borderRadius: 20, overflow: "hidden",
              border: `1px solid ${C.border}`, fontSize: 12,
            }}>
              {[["click", "🎤 Klicken"], ["hold", "🤏 Halten"], ["auto", "👂 Auto"]].map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => { setMicMode(m); localStorage.setItem("sb_mic_mode", m) }}
                  style={{
                    padding: "4px 12px", border: "none", cursor: "pointer",
                    fontWeight: micMode === m ? 600 : 400,
                    background: micMode === m ? C.primary : C.bg,
                    color: micMode === m ? "#fff" : C.muted,
                    fontSize: 12,
                  }}
                >{label}</button>
              ))}
            </div>

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
              maxHeight: 240, overflowY: "auto",
            }}>
              {debugData.tts_error && (
                <div style={{ color: "#f38ba8", marginBottom: 8, fontFamily: "sans-serif" }}>
                  ⚠ TTS-Fehler: {debugData.tts_error}
                </div>
              )}
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
              <Btn type="button" variant="ghost" onClick={() => setShowCreate(false)}>Abbrechen</Btn>
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
  const [sttModel, setSttModel] = useState("voxtral-mini-latest")
  const [ttsModel, setTtsModel] = useState("voxtral-mini-tts-2603")
  const [ttsVoice, setTtsVoice] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    getProvider("mistral").then(cfg => {
      if (!cfg) return
      if (cfg.llm_model) setLlmModel(cfg.llm_model)
      if (cfg.stt_model) setSttModel(cfg.stt_model)
      if (cfg.tts_model) setTtsModel(cfg.tts_model)
      if (cfg.tts_voice) setTtsVoice(cfg.tts_voice)
    }).catch(() => {})
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true); setError(""); setSaved(false)
    try {
      await upsertProvider("mistral", {
        ...(apiKey ? { api_key: apiKey } : {}),
        llm_model: llmModel,
        stt_model: sttModel,
        tts_model: ttsModel,
        ...(ttsVoice ? { tts_voice: ttsVoice } : {}),
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
    <div style={{ maxWidth: 560 }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24 }}>
        <div style={{ fontWeight: 600, fontSize: 15, color: C.text, marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>🤖</span> Mistral AI
        </div>
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <ErrorBanner msg={error} />
          {saved && (
            <div style={{ padding: "8px 12px", borderRadius: 6, background: "#d1fae5", color: "#065f46", fontSize: 13 }}>
              ✓ Konfiguration gespeichert
            </div>
          )}
          <Input
            label="API-Key (leer lassen um bestehenden zu behalten)"
            type="password"
            value={apiKey}
            onChange={setApiKey}
            placeholder="sk-..."
          />
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Modelle</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Input label="LLM-Modell" value={llmModel} onChange={setLlmModel} placeholder="mistral-large-latest" />
              <Input label="STT-Modell" value={sttModel} onChange={setSttModel} placeholder="voxtral-mini-latest" />
              <Input label="TTS-Modell" value={ttsModel} onChange={setTtsModel} placeholder="voxtral-mini-tts-2603" />
              <Input
                label="TTS-Stimme (leer = automatisch)"
                value={ttsVoice}
                onChange={setTtsVoice}
                placeholder="leer lassen für automatische Auswahl"
              />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 4 }}>
            <Btn disabled={saving}>{saving ? "Speichern..." : "Speichern"}</Btn>
          </div>
        </form>
      </div>
    </div>
  )
}

function DashboardSection() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getStats().then(setStats).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const tiles = [
    { label: "Aktive Sessions", value: stats?.active_sessions ?? "—", icon: "💬", color: C.success },
    { label: "Sessions heute", value: stats?.sessions_today ?? "—", icon: "📅", color: C.primary },
    { label: "Sessions gesamt", value: stats?.total_sessions ?? "—", icon: "📊", color: C.text },
    { label: "Abgeschlossen", value: stats?.completed_sessions ?? "—", icon: "✅", color: C.success },
    { label: "Erfolgsrate", value: stats ? `${(stats.success_rate * 100).toFixed(0)}%` : "—", icon: "📈", color: stats?.success_rate > 0.7 ? C.success : C.warning },
  ]

  return (
    <div>
      {loading ? (
        <p style={{ color: C.muted }}>Lade...</p>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16, marginBottom: 32 }}>
            {tiles.map(t => (
              <div key={t.label} style={{
                background: C.surface, borderRadius: 10, padding: 20,
                border: `1px solid ${C.border}`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>{t.icon}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: t.color }}>{t.value}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{t.label}</div>
              </div>
            ))}
          </div>

          {stats?.top_intents?.length > 0 && (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 16 }}>Top Intents</div>
              {stats.top_intents.map((item, i) => {
                const max = stats.top_intents[0].count
                return (
                  <div key={item.intent} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                    <div style={{ width: 20, fontSize: 12, color: C.muted, textAlign: "right" }}>{i + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 13, color: C.text }}>{item.intent}</span>
                        <span style={{ fontSize: 12, color: C.muted }}>{item.count}</span>
                      </div>
                      <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 3,
                          background: C.primary,
                          width: `${(item.count / max) * 100}%`,
                        }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Admin — Sessions section
// ---------------------------------------------------------------------------

const STATUS_COLORS = {
  active: C.success,
  completed: C.primary,
  timeout: C.warning,
  abandoned: C.error,
  cancelled: C.muted,
}

function SessionsSection() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    listAdminSessions(200)
      .then(setSessions)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <ErrorBanner msg={error} />
      {loading ? (
        <p style={{ color: C.muted }}>Lade...</p>
      ) : (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                {["ID", "Benutzer", "Status", "Intent", "Turns", "Erstellt"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: C.muted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: C.muted }}>Keine Sessions</td></tr>
              ) : sessions.map(s => (
                <tr key={s.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "10px 16px", fontSize: 12, color: C.muted, fontFamily: "monospace" }}>
                    {s.id.slice(0, 8)}…
                  </td>
                  <td style={{ padding: "10px 16px", fontSize: 13, color: C.muted }}>
                    {s.user_id?.slice(0, 8)}…
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <Badge label={s.status} color={STATUS_COLORS[s.status] || C.muted} />
                  </td>
                  <td style={{ padding: "10px 16px", fontSize: 13, color: C.text }}>
                    {s.intent || "—"}
                  </td>
                  <td style={{ padding: "10px 16px", fontSize: 13, color: C.muted, textAlign: "center" }}>
                    {s.turn_count}
                  </td>
                  <td style={{ padding: "10px 16px", fontSize: 12, color: C.muted, whiteSpace: "nowrap" }}>
                    {new Date(s.created_at).toLocaleString("de-DE")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Admin — Flow Modal (create / edit)
// ---------------------------------------------------------------------------

const SLOT_TYPES = ["string", "email", "boolean", "enum"]

function emptySlot() {
  return { name: "", type: "string", required: true, question: "", values: "", min_length: 1, max_length: 500 }
}

function FlowModal({ flow, webhooks, onClose, onSave }) {
  const isEdit = !!flow?.id
  const def = flow?.definition || {}

  const [tab, setTab] = useState("basic")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  // Basic
  const [name, setName] = useState(flow?.name || "")
  const [intentName, setIntentName] = useState(flow?.intent_name || "")
  const [description, setDescription] = useState(flow?.description || "")
  const [priority, setPriority] = useState(String(flow?.priority ?? 0))
  const [maxTurns, setMaxTurns] = useState(String(def.max_turns ?? 10))
  const [isActive, setIsActive] = useState(flow?.is_active !== false)

  // Slots
  const [slots, setSlots] = useState(() => {
    const entries = Object.entries(def.slots || {})
    if (entries.length === 0) return [emptySlot()]
    return entries.map(([sName, sDef]) => ({
      name: sName,
      type: sDef.type || "string",
      required: sDef.required !== false,
      question: sDef.question || "",
      values: Array.isArray(sDef.values) ? sDef.values.join(", ") : (sDef.values || ""),
      min_length: sDef.min_length ?? 1,
      max_length: sDef.max_length ?? 500,
    }))
  })

  // Messages
  const [confirmation, setConfirmation] = useState(def.confirmation || "")
  const [successMsg, setSuccessMsg] = useState(def.success_message || "Ihre Anfrage wurde erfolgreich ausgeführt.")

  // Action
  const [actionType, setActionType] = useState(def.action?.type || "none")
  const [webhookId, setWebhookId] = useState(def.action?.webhook_id || "")
  const [payloadTemplate, setPayloadTemplate] = useState(
    def.action?.payload_template ? JSON.stringify(def.action.payload_template, null, 2) : ""
  )

  function updateSlot(idx, field, value) {
    setSlots(s => s.map((sl, i) => i === idx ? { ...sl, [field]: value } : sl))
  }
  function addSlot() { setSlots(s => [...s, emptySlot()]) }
  function removeSlot(idx) { setSlots(s => s.filter((_, i) => i !== idx)) }

  function buildDefinition() {
    const slotDefs = {}
    for (const sl of slots) {
      if (!sl.name.trim()) continue
      const d = { type: sl.type, required: sl.required, question: sl.question }
      if (sl.type === "enum") d.values = sl.values.split(",").map(v => v.trim()).filter(Boolean)
      if (sl.type === "string") { d.min_length = Number(sl.min_length); d.max_length = Number(sl.max_length) }
      slotDefs[sl.name.trim()] = d
    }
    const action = { type: actionType }
    if (actionType === "webhook") {
      action.webhook_id = webhookId
      if (payloadTemplate.trim()) {
        try { action.payload_template = JSON.parse(payloadTemplate) } catch (_) {}
      }
    }
    return {
      slots: slotDefs,
      ...(confirmation.trim() ? { confirmation: confirmation.trim() } : {}),
      success_message: successMsg,
      max_turns: Number(maxTurns) || 10,
      action,
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !intentName.trim()) { setError("Name und Intent sind Pflichtfelder."); return }
    setSaving(true); setError("")
    try {
      const data = {
        name: name.trim(),
        intent_name: intentName.trim(),
        description: description.trim(),
        priority: Number(priority) || 0,
        is_active: isActive,
        definition: buildDefinition(),
      }
      await onSave(isEdit ? flow.id : null, data)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const tabStyle = (t) => ({
    padding: "8px 14px", border: "none", background: "transparent",
    cursor: "pointer", fontSize: 13, fontWeight: tab === t ? 600 : 400,
    color: tab === t ? C.primary : C.muted,
    borderBottom: tab === t ? `2px solid ${C.primary}` : "2px solid transparent",
    marginBottom: -1,
  })

  const slotNames = slots.filter(s => s.name.trim()).map(s => `{{${s.name}}}`)

  return (
    <Modal title={isEdit ? `Flow bearbeiten: ${flow.name}` : "Flow erstellen"} onClose={onClose} width={680}>
      <div style={{ borderBottom: `1px solid ${C.border}`, display: "flex", marginBottom: 20 }}>
        {[["basic", "Allgemein"], ["slots", `Slots (${slots.filter(s=>s.name).length})`], ["messages", "Nachrichten"], ["action", "Aktion"]].map(([id, label]) => (
          <button key={id} style={tabStyle(id)} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      <ErrorBanner msg={error} />

      <form onSubmit={handleSubmit}>
        {tab === "basic" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 2 }}><Input label="Name *" value={name} onChange={setName} placeholder="Passwort zurücksetzen" /></div>
              <div style={{ flex: 1 }}><Input label="Priorität" value={priority} onChange={setPriority} type="number" /></div>
            </div>
            <Input label="Intent-Name *" value={intentName} onChange={setIntentName} placeholder="passwort_reset" />
            <Input label="Beschreibung" value={description} onChange={setDescription} />
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}><Input label="Max. Turns" value={maxTurns} onChange={setMaxTurns} type="number" /></div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Status</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 8 }}>
                  <Toggle checked={isActive} onChange={setIsActive} />
                  <span style={{ fontSize: 13, color: C.muted }}>{isActive ? "Aktiv" : "Inaktiv"}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "slots" && (
          <div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
              Slots werden in der definierten Reihenfolge abgefragt.
            </div>
            {slots.map((sl, idx) => (
              <div key={idx} style={{
                border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, marginBottom: 10,
                background: C.bg,
              }}>
                <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                  <div style={{ flex: 2 }}>
                    <Input label="Slot-Name" value={sl.name} onChange={v => updateSlot(idx, "name", v)} placeholder="benutzername" small />
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 500, color: C.text }}>Typ</label>
                    <select
                      value={sl.type}
                      onChange={e => updateSlot(idx, "type", e.target.value)}
                      style={{ padding: "6px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13 }}
                    >
                      {SLOT_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 500, color: C.text }}>Pflicht</label>
                    <div style={{ paddingTop: 8 }}>
                      <Toggle checked={sl.required} onChange={v => updateSlot(idx, "required", v)} />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSlot(idx)}
                    style={{ alignSelf: "flex-end", padding: "6px 10px", border: "none", borderRadius: 6, background: "#fee2e2", color: C.error, cursor: "pointer", fontSize: 13 }}
                  >✕</button>
                </div>
                <Input label="Frage" value={sl.question} onChange={v => updateSlot(idx, "question", v)} placeholder="Wie lautet Ihr Benutzername?" small />
                {sl.type === "enum" && (
                  <div style={{ marginTop: 8 }}>
                    <Input label="Erlaubte Werte (kommagetrennt)" value={sl.values} onChange={v => updateSlot(idx, "values", v)} placeholder="Option1, Option2, Option3" small />
                  </div>
                )}
                {sl.type === "string" && (
                  <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                    <Input label="Min. Länge" value={String(sl.min_length)} onChange={v => updateSlot(idx, "min_length", v)} type="number" small />
                    <Input label="Max. Länge" value={String(sl.max_length)} onChange={v => updateSlot(idx, "max_length", v)} type="number" small />
                  </div>
                )}
              </div>
            ))}
            <Btn type="button" variant="ghost" small onClick={addSlot}>+ Slot hinzufügen</Btn>
          </div>
        )}

        {tab === "messages" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {slotNames.length > 0 && (
              <div style={{ padding: "8px 12px", background: C.bg, borderRadius: 6, fontSize: 12, color: C.muted }}>
                Verfügbare Platzhalter: {slotNames.join("  ")}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: C.text }}>
                Bestätigungsfrage <span style={{ fontWeight: 400, color: C.muted }}>(optional)</span>
              </label>
              <textarea
                value={confirmation}
                onChange={e => setConfirmation(e.target.value)}
                placeholder="Soll ich das Passwort für {{benutzername}} zurücksetzen?"
                rows={3}
                style={{ padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, resize: "vertical" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Erfolgsmeldung</label>
              <textarea
                value={successMsg}
                onChange={e => setSuccessMsg(e.target.value)}
                rows={3}
                style={{ padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, resize: "vertical" }}
              />
            </div>
          </div>
        )}

        {tab === "action" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Aktionstyp</label>
              <select
                value={actionType}
                onChange={e => setActionType(e.target.value)}
                style={{ padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14 }}
              >
                <option value="none">Keine Aktion</option>
                <option value="webhook">Webhook ausführen</option>
              </select>
            </div>
            {actionType === "webhook" && (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Webhook</label>
                  <select
                    value={webhookId}
                    onChange={e => setWebhookId(e.target.value)}
                    style={{ padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14 }}
                  >
                    <option value="">— Webhook wählen —</option>
                    {(webhooks || []).map(wh => (
                      <option key={wh.id} value={wh.id}>{wh.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: C.text }}>
                    Payload-Template <span style={{ fontWeight: 400, color: C.muted }}>(JSON, optional)</span>
                  </label>
                  {slotNames.length > 0 && (
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>
                      Platzhalter: {slotNames.join("  ")}
                    </div>
                  )}
                  <textarea
                    value={payloadTemplate}
                    onChange={e => setPayloadTemplate(e.target.value)}
                    placeholder={'{\n  "user": "{{benutzername}}",\n  "email": "{{email}}"\n}'}
                    rows={6}
                    style={{ padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, fontFamily: "monospace", resize: "vertical" }}
                  />
                </div>
              </>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
          <Btn type="button" variant="ghost" onClick={onClose}>Abbrechen</Btn>
          <Btn disabled={saving}>{saving ? "Speichern..." : (isEdit ? "Speichern" : "Erstellen")}</Btn>
        </div>
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Admin — Flows section
// ---------------------------------------------------------------------------

function FlowsSection() {
  const [flows, setFlows] = useState([])
  const [webhooks, setWebhooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [editFlow, setEditFlow] = useState(null)   // null = closed, false = create new, flow obj = edit
  const [showModal, setShowModal] = useState(false)
  const [editorFlow, setEditorFlow] = useState(null) // flow obj for visual editor, null = closed

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [f, w] = await Promise.all([listFlows(), listWebhooks()])
      setFlows(f); setWebhooks(w)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  async function handleSave(flowId, data) {
    if (flowId) {
      await updateFlow(flowId, data)
    } else {
      await createFlow(data)
    }
    await load()
  }

  async function handleDelete(id, name) {
    if (!confirm(`Flow "${name}" wirklich löschen?`)) return
    try { await deleteFlow(id); await load() } catch (e) { setError(e.message) }
  }

  async function handleToggle(f) {
    try { await updateFlow(f.id, { is_active: !f.is_active }); await load() } catch (e) { setError(e.message) }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <Btn small onClick={() => { setEditFlow(false); setShowModal(true) }}>+ Flow erstellen</Btn>
      </div>
      <ErrorBanner msg={error} />
      {loading ? (
        <p style={{ color: C.muted }}>Lade...</p>
      ) : (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                {["Name", "Intent", "Slots", "Aktion", "Aktiv", "Aktionen"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: C.muted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {flows.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: C.muted }}>Keine Flows konfiguriert</td></tr>
              ) : flows.map(f => {
                const slotCount = Object.keys(f.definition?.slots || {}).length
                const actionType = f.definition?.action?.type || "none"
                const wh = webhooks.find(w => w.id === f.definition?.action?.webhook_id)
                return (
                  <tr key={f.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{f.name}</div>
                      {f.description && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{f.description}</div>}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <Badge label={f.intent_name} color={C.primary} />
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: C.muted }}>
                      {slotCount === 0 ? "—" : `${slotCount} Slot${slotCount !== 1 ? "s" : ""}`}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: C.muted }}>
                      {actionType === "webhook" ? (
                        <span title={wh?.name}><Badge label="Webhook" color={C.success} /></span>
                      ) : "—"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <Toggle checked={f.is_active} onChange={() => handleToggle(f)} />
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Btn small variant="ghost" onClick={() => { setEditFlow(f); setShowModal(true) }}>Bearbeiten</Btn>
                        <Btn small variant="outline" onClick={() => setEditorFlow(f)}>⚡ Graph</Btn>
                        <Btn small variant="danger" onClick={() => handleDelete(f.id, f.name)}>Löschen</Btn>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {showModal && (
        <FlowModal
          flow={editFlow || undefined}
          webhooks={webhooks}
          onClose={() => { setShowModal(false); setEditFlow(null) }}
          onSave={handleSave}
        />
      )}
      {editorFlow && (
        <FlowEditor
          flow={editorFlow}
          webhooks={webhooks}
          onClose={() => setEditorFlow(null)}
          onSave={async (flowId, data) => { await handleSave(flowId, data); setEditorFlow(null) }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Admin — Webhooks section
// ---------------------------------------------------------------------------

function WebhooksSection() {
  const [webhooks, setWebhooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [testResults, setTestResults] = useState({})
  const [form, setForm] = useState({ name: "", url: "", method: "POST", auth_type: "none", auth_data: "", timeout_seconds: 15, retry_max: 3 })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try { setWebhooks(await listWebhooks()) } catch (e) { setError(e.message) }
    setLoading(false)
  }

  async function handleCreate(e) {
    e.preventDefault()
    try {
      await createWebhook(form)
      setShowCreate(false)
      setForm({ name: "", url: "", method: "POST", auth_type: "none", auth_data: "", timeout_seconds: 15, retry_max: 3 })
      await load()
    } catch (e) { setError(e.message) }
  }

  async function handleDelete(id) {
    if (!confirm("Webhook wirklich löschen?")) return
    try { await deleteWebhook(id); await load() } catch (e) { setError(e.message) }
  }

  async function handleToggle(wh) {
    try {
      await updateWebhook(wh.id, { is_active: !wh.is_active })
      await load()
    } catch (e) { setError(e.message) }
  }

  async function handleTest(id) {
    setTestResults(r => ({ ...r, [id]: "..." }))
    try {
      const res = await testWebhook(id)
      setTestResults(r => ({ ...r, [id]: res.success ? `✓ HTTP ${res.status_code}` : `✗ ${res.error}` }))
    } catch (e) {
      setTestResults(r => ({ ...r, [id]: `✗ ${e.message}` }))
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <Btn small onClick={() => setShowCreate(true)}>+ Webhook</Btn>
      </div>
      <ErrorBanner msg={error} />
      {loading ? (
        <p style={{ color: C.muted }}>Lade...</p>
      ) : (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                {["Name", "URL", "Auth", "Aktiv", "Test", "Aktionen"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: C.muted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {webhooks.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: C.muted }}>Keine Webhooks konfiguriert</td></tr>
              ) : webhooks.map(wh => (
                <tr key={wh.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 500, color: C.text }}>{wh.name}</td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: C.muted, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {wh.url}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <Badge label={wh.auth_type} color={wh.auth_type !== "none" ? C.primary : C.muted} />
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <Toggle checked={wh.is_active} onChange={() => handleToggle(wh)} />
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: testResults[wh.id]?.startsWith("✓") ? C.success : C.error }}>
                    <Btn small variant="ghost" onClick={() => handleTest(wh.id)}>Test</Btn>
                    {testResults[wh.id] && <span style={{ marginLeft: 8 }}>{testResults[wh.id]}</span>}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <Btn small variant="danger" onClick={() => handleDelete(wh.id)}>Löschen</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <Modal title="Webhook erstellen" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Input label="Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} required />
            <Input label="URL" value={form.url} onChange={v => setForm(f => ({ ...f, url: v }))} placeholder="https://..." required />
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Methode</label>
                <select
                  value={form.method}
                  onChange={e => setForm(f => ({ ...f, method: e.target.value }))}
                  style={{ padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14 }}
                >
                  {["POST", "PUT", "PATCH", "GET"].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Auth-Typ</label>
                <select
                  value={form.auth_type}
                  onChange={e => setForm(f => ({ ...f, auth_type: e.target.value }))}
                  style={{ padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14 }}
                >
                  {["none", "bearer", "basic", "api_key"].map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
            </div>
            {form.auth_type !== "none" && (
              <Input
                label={form.auth_type === "bearer" ? "Bearer Token" : form.auth_type === "basic" ? "user:password" : "Header-Name:Wert"}
                type="password"
                value={form.auth_data}
                onChange={v => setForm(f => ({ ...f, auth_data: v }))}
              />
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <Btn type="button" variant="ghost" onClick={() => setShowCreate(false)}>Abbrechen</Btn>
              <Btn>Erstellen</Btn>
            </div>
          </form>
        </Modal>
      )}
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
  { id: "webhooks",    label: "Webhooks" },
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
      case "sessions":    return <SessionsSection />
      case "flows":       return <FlowsSection />
      case "webhooks":    return <WebhooksSection />
      case "config":      return <ProviderSection />
      case "audit":       return <AuditSection />
      case "statistiken": return <DashboardSection />
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
