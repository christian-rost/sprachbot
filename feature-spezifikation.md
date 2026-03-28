# Feature-Spezifikation — Sprachbot

## 1. Nutzer-Interface (Frontend)

### 1.1 Sprachkanal (Hauptansicht)

**Beschreibung:** Die primäre Interaktionsfläche für Endnutzer. Minimal, fokussiert auf Sprache.

**Layout:**
```
┌─────────────────────────────────────────┐
│  [Logo/Name]                [Einstellungen]
│                                         │
│                                         │
│   ┌──────────────────────────────────┐  │
│   │  Gesprächsverlauf                │  │
│   │                                  │  │
│   │  🤖 Wie kann ich Ihnen helfen?   │  │
│   │  👤 Passwort zurücksetzen        │  │
│   │  🤖 Für welchen Benutzer?        │  │
│   │  👤 max.mustermann               │  │
│   │  🤖 Soll ich wirklich...?        │  │
│   │                                  │  │
│   └──────────────────────────────────┘  │
│                                         │
│   ┌──────────────────────────────────┐  │
│   │  Transkription: [live text...]   │  │
│   └──────────────────────────────────┘  │
│                                         │
│         [●  AUFNAHME STARTEN]           │
│         [  TTS ein/aus  ]               │
│                                         │
└─────────────────────────────────────────┘
```

**Funktionen:**
- Mikrofon-Button: Halten zum Sprechen (Push-to-Talk) oder Toggle-Modus
- Echtzeit-Anzeige der Transkription während/nach Aufnahme
- Gesprächsverlauf mit visueller Unterscheidung Nutzer/Bot
- Bot-Antworten werden automatisch vorgelesen (TTS)
- Ladeanimation während Verarbeitung
- Fehlermeldungen mit Klartextbeschreibung
- Session-Reset (Neu starten)

---

### 1.2 Einstellungen-Panel

- TTS aktivieren/deaktivieren
- TTS-Stimme auswählen (falls mehrere verfügbar)
- Sprechlautstärke / Wiedergabelautstärke
- Sprache der Transkription (Deutsch / Englisch)
- Datenschutz-Hinweis

---

## 2. Admin-Panel (Frontend)

Der Admin-Bereich ist über `/admin` erreichbar und nur für authentifizierte ADMIN/OPERATOR-Nutzer.

### 2.1 Dashboard / Übersicht

**Kennzahlen (Echtzeit):**
- Aktive Sessions (jetzt)
- Abgeschlossene Sessions heute
- Erfolgsrate (completed / total)
- Häufigste Intents (Top 5)
- Durchschnittliche Gesprächsdauer
- Fehlerrate (letzte 24h)
- Durchschnittliche Antwortlatenz (STT / LLM / TTS)

**Grafik:** Verlauf der Sessions und Fehlerrate (7 Tage)

---

### 2.2 Flow-Verwaltung

**Liste:**
- Tabellarische Übersicht aller Flows
- Spalten: Name, Intent, Status (aktiv/inaktiv), Priorität, Aktionen-Typ, Erstellt, Letzte Änderung
- Filter: Aktiv/Inaktiv, Suchfeld
- Sortierung nach allen Spalten

**Flow-Editor:**
- Strukturierter Editor (kein Roh-JSON-Edit für Basisfunktionen)
- Formular-basierte Slot-Definition
- Drag & Drop Slot-Reihenfolge
- Aktions-Konfiguration (Webhook auswählen, Payload-Template)
- Roh-JSON-Ansicht für Fortgeschrittene (toggle)
- Live-Vorschau der Rückfragen
- Speichern / Abbrechen / Als Entwurf speichern

**Flow-Test:**
- Testmodus: Text-Input simuliert Nutzer-Äußerung
- Zeigt: erkannter Intent, extrahierte Slots, generierte Antwort
- Kein echter Webhook-Aufruf im Test (dry-run)

**Import / Export:**
- Export als JSON (einzeln oder alle)
- Import aus JSON-Datei
- Merge-Strategie bei Konflikten (überschreiben, überspringen)

---

### 2.3 Sessions-Übersicht

**Liste:**
- Alle Sessions (paginiert, 50 pro Seite)
- Filter: Datum, Status, Flow, Nutzer
- Spalten: Session-ID, Startzeitpunkt, Dauer, Flow, Status, Turns, Nutzer
- Klick auf Session → Detailansicht

**Session-Detail:**
- Vollständiger Gesprächsverlauf (Turn für Turn)
- Jeweils: Zeitstempel, Rolle (user/assistant), Text, erkannter Intent, extrahierte Slots
- Ausgeführte Aktionen (Webhook-Call, Response-Code, Payload)
- Session-Metadaten: IP, Browser, Nutzer
- Rohformat (JSON) exportierbar

---

### 2.4 Benutzerverwaltung

**Liste:**
- Alle Benutzer mit Rollen, Status, letzter Anmeldung

**Aktionen:**
- Benutzer erstellen (Username, E-Mail, Passwort, Rolle)
- Benutzer deaktivieren/aktivieren
- Passwort zurücksetzen (generiert temporäres PW)
- Rolle ändern
- Benutzer löschen (mit Bestätigung, Audit-Log)

**Rollen:**
| Rolle | Rechte |
|-------|--------|
| ADMIN | Alles, inkl. Benutzerverwaltung und Systemkonfiguration |
| OPERATOR | Flows verwalten, Sessions einsehen, Webhooks konfigurieren |
| USER | Eigene Sessions starten und einsehen |
| GUEST | Anonym, nur öffentlich freigegebene Flows |

---

### 2.5 Provider-Konfiguration

**STT-Provider:**
- Auswahl: Mistral Speech API (Standard), erweiterbar per Adapter
- API-Key (verschlüsselt gespeichert)
- Modell-Auswahl (verfügbare Mistral STT-Modelle)
- Sprach-Einstellung (Deutsch, Englisch)
- Test-Funktion: Upload kurzer Audioclip → Transkription

**TTS-Provider:**
- Auswahl: Mistral TTS API (Standard), erweiterbar per Adapter
- API-Key
- Stimme auswählen (Dropdown mit verfügbaren Mistral-Stimmen)
- Geschwindigkeit, Tonhöhe
- Test-Funktion: Text eingeben → Audio abspielen

**LLM-Provider:**
- Auswahl: Mistral AI (Standard), erweiterbar per Adapter
- API-Key
- Modell-Auswahl (mistral-large-latest, mistral-small-latest, etc.)
- Globaler System-Prompt (für alle Flows)
- Max-Tokens, Temperature (0.0 – 1.0)
- Test: Direktes Prompt senden und Antwort sehen

---

### 2.6 Webhook-Verwaltung

**Liste:**
- Alle konfigurierten Webhooks
- Status (erreichbar/nicht erreichbar — periodisch geprüft)

**Webhook-Editor:**
- Name, URL, HTTP-Methode
- Authentifizierung: None, Bearer Token, Basic Auth, API-Key-Header
- Custom Headers
- Timeout-Konfiguration
- Retry-Konfiguration

**Test-Funktion:**
- Test-Payload senden
- HTTP-Response und Latenz anzeigen
- Fehlerdetails bei HTTP 4xx/5xx

---

### 2.7 Audit-Log

**Übersicht:**
- Chronologisch, neueste zuerst
- Filter: Zeitraum, Event-Typ, Benutzer, Entity

**Ereignis-Typen:**
- `flow_created`, `flow_updated`, `flow_deleted`, `flow_toggled`
- `user_created`, `user_deactivated`, `user_role_changed`
- `config_updated` (Provider, Webhook)
- `session_started`, `session_completed`, `session_error`
- `action_executed` (Webhook-Aufruf mit Ergebnis)
- `admin_login`, `admin_logout`

**Export:** CSV-Download mit aktivem Filter

---

### 2.8 System-Informationen

- Backend-Version, Commit-Hash
- Provider-Status (erreichbar/nicht erreichbar, Latenz)
- Datenbankverbindung
- Umgebung (development/production)
- Letzte Deployment-Zeit
- Aktuelle Konfiguration (ohne sensitive Daten)

---

## 3. API-Features (Backend)

### 3.1 Session-Lifecycle

```
POST /api/sessions
  Body: { tenant_id?, user_id?, context? }
  → 201: { session_id, websocket_url }

WebSocket /ws/sessions/{id}
  → Bidirektional, JSON-Protokoll (siehe architektur.md)

DELETE /api/sessions/{id}
  → Session als "abandoned" markieren
```

### 3.2 Audio-Verarbeitung

```
POST /api/sessions/{id}/transcribe
  Body: multipart/form-data { audio: Blob }
  Constraints: max 10MB, WAV/WebM/OGG
  → 200: { text, language_detected, confidence, duration_ms }
  → 400: { error: "AUDIO_TOO_LARGE" | "UNSUPPORTED_FORMAT" }
```

### 3.3 Flow-Engine

```
POST /api/sessions/{id}/process
  Body: { text: "Ich möchte mein Passwort zurücksetzen" }
  → 200: {
      intent: "password_reset",
      confidence: 0.95,
      extracted_slots: { username: null },
      response_text: "Für welchen Benutzernamen?",
      audio_url: "/api/audio/{id}",
      session_status: "active",
      current_flow: "password_reset",
      missing_slots: ["username"]
    }
```

### 3.4 TTS-Endpoint

```
POST /api/tts
  Body: { text: "Ihre Antwort...", voice?: "...", speed?: 1.0 }
  → 200: audio/mpeg (binary)
  → cached by content hash
```

---

## 4. Nicht-funktionale Features

### 4.1 Rate Limiting

- Anonym (GUEST): 10 Sessions/Stunde, 5 Requests/Minute
- Authentifiziert (USER): 50 Sessions/Tag, 20 Requests/Minute
- Admin/Operator: kein Limit

### 4.2 Caching

- Flow-Definitionen: In-Memory-Cache (60s TTL, invalidiert bei Änderung)
- TTS-Audio: Content-Hash-basiertes Caching (24h TTL)
- Provider-Konfigurationen: In-Memory-Cache (300s TTL)

### 4.3 Observability

- Strukturiertes JSON-Logging (alle API-Requests)
- Metriken-Endpoint: `/metrics` (Prometheus-Format)
- Tracing-Header (X-Request-ID wird durchgereicht)
- Health-Check: `/health` mit Abhängigkeits-Status

### 4.4 Datenschutz

- Audio-Uploads: werden nach Transkription sofort gelöscht
- Session-Protokolle: konfigurierbare Retention (Standard: 90 Tage)
- Möglichkeit: Session-Daten anonymisieren nach Abschluss
- DSGVO-Löschanfrage: Admin kann alle Daten einer User-ID löschen
