# Architektur — Sprachbot

## 1. Systemüberblick

```
┌──────────────────┐    ┌────────────────────────────────────┐
│  NUTZER          │    │  NUTZER (optional: Telefonie)       │
│  (Browser/Mikro) │    │  (Telefon / SIP / PSTN)            │
└────────┬─────────┘    └──────────────┬─────────────────────┘
         │ WebSocket/HTTP               │ Twilio/Vonage WS
         │                             │ oder SIP (Asterisk)
┌────────▼─────────────────────────────▼─────────────────────┐
│                    BACKEND (FastAPI/Python)                 │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │             CHANNEL-ABSTRAKTIONS-LAYER              │   │
│  │  BrowserChannelHandler │ TelephoneChannelHandler*   │   │
│  │  (* optionale Erweiterung)                          │   │
│  └──────────────────────────┬──────────────────────────┘   │
│                             │                               │
│  ┌──────────┐  ┌──────────┐ │ ┌──────────┐  ┌───────────┐  │
│  │  Auth    │  │  STT     │ │ │  LLM     │  │  TTS      │  │
│  │  (JWT)   │  │ Service  │ │ │ Service  │  │ Service   │  │
│  └──────────┘  └──────────┘ │ └──────────┘  └───────────┘  │
│                             ▼                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │               FLOW ENGINE                           │   │
│  │  Intent Match → Slot Fill → Validate → Execute      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │  Flow    │  │ Session  │  │  Audit   │  │ Webhook   │  │
│  │ Storage  │  │ Storage  │  │ Storage  │  │ Service   │  │
│  └──────────┘  └──────────┘  └──────────┘  └───────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
┌───────▼──────┐ ┌───────▼──────┐ ┌──────▼────────┐
│  Supabase    │ │  Mistral AI  │ │  Externe      │
│ (PostgreSQL) │ │     API      │ │  Systeme      │
│              │ │ LLM/STT/TTS  │ │ (Webhooks)    │
└──────────────┘ └──────────────┘ └───────────────┘
```

---

## 2. Konversationsfluss (Detail)

```
1. AUFNAHME
   Nutzer drückt Mikrofon-Button → Browser MediaRecorder API
   → Audio-Blob (WebM/WAV) wird gesammelt

2. TRANSKRIPTION (STT)
   Audio-Blob → POST /api/session/{id}/transcribe
   → Backend: STT-Service (Mistral Speech API)
   → Rückgabe: { text: "Ich möchte mein Passwort zurücksetzen" }

3. INTENT-ERKENNUNG (LLM)
   Transkription + Gesprächskontext + Flow-Liste
   → LLM Service (Mistral API)
   → Prompt: "Wähle den passenden Flow, extrahiere Slots, oder frage nach"
   → Rückgabe: { intent: "password_reset", slots: {}, needs_clarification: true }

4. FLOW-ENGINE ENTSCHEIDUNG
   Intent → Flow-Storage lookup
   Slots vollständig? → Ja: Aktion ausführen
                     → Nein: Rückfrage generieren

5. RÜCKFRAGE (falls nötig)
   Flow-Engine → LLM: "Generiere freundliche Rückfrage für Slot 'username'"
   → Text → TTS-Service → Audio
   → WebSocket: Audio + Text an Frontend

6. AKTIONSAUSFÜHRUNG
   Alle Slots gefüllt und validiert
   → Webhook-Service: POST an konfigurierten Endpunkt
   → Antwort verarbeiten
   → Bestätigungstext → TTS → Nutzer

7. SESSION-ABSCHLUSS
   Flow abgeschlossen → Session-Status: completed
   → Protokoll gespeichert
```

---

## 3. Datenmodell (Supabase / PostgreSQL)

### Tabellen-Übersicht

| Tabelle | Beschreibung |
|---------|-------------|
| `sb_users` | Benutzerkonten mit Rollen |
| `sb_sessions` | Gesprächs-Sessions |
| `sb_messages` | Nachrichten pro Session (Turns) |
| `sb_flows` | Flow-Definitionen |
| `sb_flow_versions` | Versionshistorie von Flows |
| `sb_actions` | Aktionsdefinitionen (Webhooks, intern) |
| `sb_config_providers` | STT/TTS/LLM Provider-Konfigurationen |
| `sb_config_webhooks` | Webhook-Endpunkte und Auth |
| `sb_audit_log` | Audit-Trail aller Ereignisse |
| `sb_tenants` | Mandanten (Multi-Tenant) |

### Kern-Schema

```sql
-- Flows
CREATE TABLE sb_flows (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID REFERENCES sb_tenants(id),
  name         TEXT NOT NULL,
  description  TEXT,
  intent_name  TEXT NOT NULL UNIQUE,      -- eindeutiger Intent-Bezeichner
  definition   JSONB NOT NULL,            -- vollständige Flow-Definition
  system_prompt TEXT,                     -- optionaler LLM-System-Prompt
  is_active    BOOLEAN DEFAULT true,
  priority     INTEGER DEFAULT 0,         -- bei mehreren passenden Flows
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  created_by   UUID REFERENCES sb_users(id)
);

-- Sessions
CREATE TABLE sb_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID REFERENCES sb_tenants(id),
  user_id      UUID REFERENCES sb_users(id),  -- NULL = anonym
  flow_id      UUID REFERENCES sb_flows(id),  -- NULL = noch nicht bestimmt
  status       TEXT DEFAULT 'active',         -- active, completed, abandoned, error
  current_slots JSONB DEFAULT '{}',           -- gesammelte Slot-Werte
  context      JSONB DEFAULT '{}',            -- zusätzlicher Kontext
  started_at   TIMESTAMPTZ DEFAULT now(),
  ended_at     TIMESTAMPTZ,
  timeout_at   TIMESTAMPTZ
);

-- Nachrichten (Turns)
CREATE TABLE sb_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID REFERENCES sb_sessions(id) ON DELETE CASCADE,
  role         TEXT NOT NULL,      -- user, assistant, system
  content      TEXT NOT NULL,      -- transkribierter Text oder LLM-Antwort
  audio_url    TEXT,               -- optionale Referenz auf Audio-Datei
  intent       TEXT,               -- erkannter Intent (bei role=user)
  slots        JSONB,              -- extrahierte Slots (bei role=user)
  metadata     JSONB DEFAULT '{}', -- Latenz, Confidence, etc.
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Provider-Konfigurationen
CREATE TABLE sb_config_providers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID REFERENCES sb_tenants(id),
  type         TEXT NOT NULL,      -- stt, tts, llm
  provider     TEXT NOT NULL,      -- openai, anthropic, elevenlabs, whisper_local
  config       JSONB NOT NULL,     -- provider-spezifische Konfiguration
  api_key_enc  TEXT,               -- verschlüsselter API-Key
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Audit Log
CREATE TABLE sb_audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID REFERENCES sb_tenants(id),
  user_id      UUID REFERENCES sb_users(id),
  event_type   TEXT NOT NULL,      -- flow_created, session_started, action_executed, etc.
  entity_type  TEXT,               -- flow, session, user, config
  entity_id    UUID,
  details      JSONB DEFAULT '{}',
  ip_address   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

### Flow-Definition (JSONB-Schema)

```json
{
  "intent_name": "password_reset",
  "display_name": "Passwort zurücksetzen",
  "description": "Setzt das Passwort eines Benutzers zurück",
  "slots": [
    {
      "name": "username",
      "type": "string",
      "required": true,
      "prompt": "Für welchen Benutzernamen soll das Passwort zurückgesetzt werden?",
      "validation": {
        "pattern": "^[a-zA-Z0-9._-]{3,50}$",
        "error_message": "Ungültiger Benutzername. Bitte nur Buchstaben, Zahlen und Punkte."
      }
    },
    {
      "name": "confirmation",
      "type": "boolean",
      "required": true,
      "prompt": "Soll ich das Passwort für '{{username}}' wirklich zurücksetzen?",
      "depends_on": "username"
    }
  ],
  "conditions": [
    {
      "if": "confirmation == false",
      "then": "abort",
      "message": "Vorgang abgebrochen."
    }
  ],
  "actions": [
    {
      "type": "webhook",
      "webhook_id": "{{webhook_id}}",
      "payload_template": {
        "action": "reset_password",
        "username": "{{username}}"
      },
      "on_success": "Das Passwort für '{{username}}' wurde erfolgreich zurückgesetzt.",
      "on_error": "Fehler beim Zurücksetzen. Bitte wenden Sie sich an den Support."
    }
  ]
}
```

---

## 4. API-Übersicht

### Authentifizierung
| Method | Endpoint | Beschreibung |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login, gibt JWT zurück |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Aktueller Benutzer |

### Sessions (Kern-API)
| Method | Endpoint | Beschreibung |
|--------|----------|-------------|
| POST | `/api/sessions` | Neue Session starten |
| GET | `/api/sessions/{id}` | Session-Details |
| DELETE | `/api/sessions/{id}` | Session abbrechen |
| POST | `/api/sessions/{id}/transcribe` | Audio → Text + Intent |
| POST | `/api/sessions/{id}/message` | Text-Nachricht senden |
| GET | `/api/sessions/{id}/messages` | Gesprächsverlauf |
| POST | `/api/sessions/{id}/tts` | Text → Audio |
| WS | `/ws/sessions/{id}` | WebSocket für Echtzeit |

### Flows (Admin)
| Method | Endpoint | Beschreibung |
|--------|----------|-------------|
| GET | `/api/flows` | Alle Flows auflisten |
| POST | `/api/flows` | Neuen Flow erstellen |
| GET | `/api/flows/{id}` | Flow-Details |
| PUT | `/api/flows/{id}` | Flow aktualisieren |
| DELETE | `/api/flows/{id}` | Flow löschen |
| POST | `/api/flows/{id}/toggle` | Flow aktivieren/deaktivieren |
| GET | `/api/flows/{id}/versions` | Versionshistorie |
| POST | `/api/flows/import` | Flows importieren (JSON) |
| GET | `/api/flows/export` | Flows exportieren (JSON) |

### Admin
| Method | Endpoint | Beschreibung |
|--------|----------|-------------|
| GET | `/api/admin/sessions` | Alle Sessions (gefiltert) |
| GET | `/api/admin/users` | Benutzerliste |
| POST | `/api/admin/users` | Benutzer erstellen |
| PUT | `/api/admin/users/{id}` | Benutzer bearbeiten |
| GET | `/api/admin/audit-log` | Audit-Log |
| GET | `/api/admin/stats` | System-Statistiken |
| GET | `/api/config/providers` | Provider-Konfigurationen |
| PUT | `/api/config/providers/{id}` | Provider konfigurieren |
| GET | `/api/config/webhooks` | Webhook-Definitionen |
| POST | `/api/config/webhooks` | Webhook erstellen |
| POST | `/api/config/webhooks/{id}/test` | Webhook testen |

### System
| Method | Endpoint | Beschreibung |
|--------|----------|-------------|
| GET | `/health` | Health-Check |
| GET | `/api/system/info` | System-Informationen |

---

## 5. WebSocket-Protokoll

Der WebSocket-Kanal dient für die Echtzeit-Kommunikation während einer Session.

### Client → Server

```json
// Audio-Chunk senden
{ "type": "audio_chunk", "data": "<base64-encoded-audio>", "sequence": 1 }

// Aufnahme beendet
{ "type": "audio_end" }

// Text-Nachricht (ohne Sprache)
{ "type": "text_message", "content": "Ich möchte mein Passwort zurücksetzen" }

// Session abbrechen
{ "type": "abort" }
```

### Server → Client

```json
// Transkription verfügbar
{ "type": "transcription", "text": "Ich möchte mein Passwort zurücksetzen" }

// Intent erkannt
{ "type": "intent_detected", "intent": "password_reset", "confidence": 0.95 }

// Rückfrage als Text
{ "type": "assistant_message", "text": "Für welchen Benutzernamen?" }

// TTS-Audio
{ "type": "audio_response", "data": "<base64-audio>", "format": "mp3" }

// Aktion ausgeführt
{ "type": "action_completed", "action": "webhook", "success": true }

// Session abgeschlossen
{ "type": "session_ended", "status": "completed" }

// Fehler
{ "type": "error", "code": "STT_FAILED", "message": "Transkription fehlgeschlagen" }
```

---

## 6. Deployment-Architektur (Coolify)

```
Coolify Platform
├── Service: backend
│   ├── Image: python:3.11-slim
│   ├── Port: 8000
│   ├── Env: JWT_SECRET, SUPABASE_*, MISTRAL_API_KEY, ...
│   └── Health: GET /health
│
├── Service: frontend
│   ├── Build: node:20-alpine → nginx:1.27-alpine
│   ├── Port: 80
│   ├── Build-Arg: VITE_API_BASE
│   └── Depends on: backend
│
├── [Optional] Service: asterisk  ← nur bei Telefonie-Erweiterung
│   ├── Image: asterisk (self-hosted SIP-Server)
│   ├── Port: 5060 (SIP), 10000-20000/UDP (RTP)
│   └── Konfiguration: dialplan, SIP-Trunk
│
└── External Services:
    ├── Supabase (PostgreSQL)
    ├── Mistral AI API (LLM + STT + TTS)
    └── [Optional] Twilio / Vonage  ← bei Cloud-Telefonie-Erweiterung
```

---

## 7. Sicherheitsarchitektur

```
┌─────────────────────────────────────────┐
│  EINGABE-VALIDIERUNG                    │
│  • Audio-Größenlimit (max 10MB)         │
│  • Text-Länge begrenzt (max 2000 Zeichen)│
│  • Rate-Limiting: 20 Req/Min pro IP     │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│  AUTHENTIFIZIERUNG                      │
│  • JWT (HS256, 8h Ablauf)               │
│  • Refresh Token (7 Tage)               │
│  • API-Key für Maschine-zu-Maschine     │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│  AUTORISIERUNG (RBAC)                   │
│  ADMIN:    Alles                        │
│  OPERATOR: Flows lesen/erstellen, Sessions│
│  USER:     Eigene Sessions              │
│  GUEST:    Anonym, nur öffentliche Flows│
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│  DATENSCHUTZ                            │
│  • Audio wird nicht persistent gespeichert│
│  • Session-Logs: konfigurierbare Retention│
│  • API-Keys AES-256 verschlüsselt       │
│  • HTTPS enforced (Coolify Proxy)       │
└─────────────────────────────────────────┘
```
