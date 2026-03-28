# Flow-Framework Konzept — Sprachbot

## 1. Überblick

Das Flow-Framework ist das Herzstück des Sprachbots. Es definiert, **welche Aktionen das System kennt**, **welche Informationen dafür nötig sind** und **was passiert, wenn alle Informationen vorliegen**. Flows werden deklarativ in JSON definiert — kein Code erforderlich.

---

## 2. Kernkonzepte

### 2.1 Intent
Ein Intent ist die **Absicht des Nutzers**. Das LLM ordnet jede Äußerung einem Intent zu.

Beispiele:
- `password_reset` — "Ich möchte mein Passwort zurücksetzen"
- `account_info` — "Zeig mir meinen Kontostand"
- `ticket_create` — "Ich brauche Hilfe mit meinem Drucker"
- `appointment_schedule` — "Ich möchte einen Termin buchen"

### 2.2 Slot
Ein Slot ist ein **benötigter Parameter** für einen Flow. Das System extrahiert Slots aus der Sprache oder fragt gezielt nach.

```
Äußerung: "Ich möchte das Passwort für Max.Mustermann zurücksetzen"
                                          └─────────────────────┘
                                               Slot: username = "Max.Mustermann"
```

### 2.3 Flow
Ein Flow ist die **vollständige Definition** einer Konversation: Intent, Slots, Validierungen, Aktionen und Antworten.

### 2.4 Action
Eine Aktion ist das, **was das System ausführt**, wenn alle Informationen vorliegen:
- **Webhook**: HTTP POST an ein externes System
- **Internal**: Datenbankoperation im Sprachbot selbst
- **Composite**: Mehrere Aktionen nacheinander

---

## 3. Flow-Definition (JSON-Schema)

```json
{
  "$schema": "sprachbot-flow/v1",
  "id": "uuid (auto)",
  "intent_name": "password_reset",
  "display_name": "Passwort zurücksetzen",
  "description": "Setzt das Passwort eines Benutzers zurück und sendet eine Bestätigungs-E-Mail",
  "is_active": true,
  "priority": 10,

  "llm_context": {
    "system_prompt": "Du hilfst bei der Passwortrücksetzung. Sei freundlich und direkt.",
    "examples": [
      { "user": "Ich kann mich nicht einloggen", "intent": "password_reset" },
      { "user": "Mein Passwort vergessen", "intent": "password_reset" }
    ]
  },

  "slots": [
    {
      "name": "username",
      "type": "string",
      "required": true,
      "prompt": "Für welchen Benutzernamen soll das Passwort zurückgesetzt werden?",
      "extraction_hint": "Benutzername, Login-Name, E-Mail-Adresse",
      "validation": {
        "min_length": 3,
        "max_length": 100,
        "pattern": "^[a-zA-Z0-9.@_-]+$",
        "error_message": "Das scheint kein gültiger Benutzername zu sein. Bitte wiederholen Sie."
      },
      "normalize": "lowercase"
    },
    {
      "name": "confirmed",
      "type": "boolean",
      "required": true,
      "prompt": "Soll ich das Passwort für '{{username}}' wirklich zurücksetzen? Bitte bestätigen Sie mit Ja oder Nein.",
      "depends_on": ["username"],
      "extraction_hint": "Ja, Nein, Bestätigung, Abbruch"
    }
  ],

  "conditions": [
    {
      "if": "confirmed == false",
      "then": "abort",
      "response": "Alles klar, der Vorgang wurde abgebrochen. Kann ich Ihnen noch anderweitig helfen?"
    }
  ],

  "actions": [
    {
      "id": "reset_action",
      "type": "webhook",
      "webhook_ref": "helpdesk_api",
      "method": "POST",
      "payload": {
        "action": "reset_password",
        "username": "{{username}}",
        "requested_by": "voice_bot",
        "timestamp": "{{now}}"
      },
      "timeout_seconds": 10,
      "on_success": {
        "response": "Das Passwort für '{{username}}' wurde erfolgreich zurückgesetzt. Sie erhalten in Kürze eine E-Mail mit weiteren Anweisungen.",
        "session_status": "completed"
      },
      "on_error": {
        "response": "Es gab ein technisches Problem beim Zurücksetzen. Bitte wenden Sie sich an den IT-Support unter 0800-123456.",
        "session_status": "error"
      }
    }
  ],

  "max_turns": 6,
  "timeout_seconds": 120,
  "abort_response": "Die Sitzung wurde aufgrund von Inaktivität beendet. Bitte starten Sie erneut."
}
```

---

## 4. Slot-Typen

| Typ | Beschreibung | Beispiel |
|-----|-------------|---------|
| `string` | Freier Text | Benutzername, Beschreibung |
| `email` | E-Mail-Adresse | max@example.com |
| `number` | Ganzzahl oder Dezimalzahl | 42, 3.14 |
| `boolean` | Ja/Nein Bestätigung | Ja, Nein, Bestätigt |
| `date` | Datum | Morgen, 15. April, nächste Woche |
| `time` | Uhrzeit | 14:30, halb drei |
| `enum` | Aus vorgegebenen Werten | [Hoch, Mittel, Niedrig] |
| `phone` | Telefonnummer | +49 89 12345678 |
| `duration` | Zeitdauer | 2 Stunden, 30 Minuten |

### Slot-Normalisierungen

```json
{
  "normalize": "lowercase"    // "MAX.MUSTERMANN" → "max.mustermann"
  "normalize": "uppercase"    // "max" → "MAX"
  "normalize": "trim"         // "  max  " → "max"
  "normalize": "date_iso"     // "morgen" → "2024-01-16"
  "normalize": "phone_e164"   // "089 12345" → "+4989012345"
}
```

---

## 5. Flow-Engine — Verarbeitungslogik

```
┌──────────────────────────────────────────────────────────┐
│                    FLOW ENGINE                           │
│                                                          │
│  INPUT: session_id, user_text                           │
│                                                          │
│  1. CONTEXT LADEN                                        │
│     • Aktive Session aus DB                              │
│     • Gesprächshistorie (max. N Turns)                   │
│     • Aktueller Flow (falls bereits erkannt)             │
│     • Gesammelte Slots bisher                            │
│                                                          │
│  2. LLM AUFRUF: Intent + Slot Extraction                │
│     Prompt enthält:                                      │
│     • Alle aktiven Flows (Kurzform: name + description) │
│     • Aktuellen Flow-Kontext (falls aktiv)               │
│     • Gesprächshistorie                                  │
│     • User-Äußerung                                      │
│     LLM antwortet mit JSON:                              │
│     { intent, extracted_slots, confidence }              │
│                                                          │
│  3. FLOW AUSWÄHLEN / WEITERFÜHREN                        │
│     • Kein Flow aktiv → Flow anhand Intent lookup        │
│     • Flow aktiv → Slots ergänzen                        │
│     • Kein passender Flow → Fallback-Antwort             │
│                                                          │
│  4. SLOTS VALIDIEREN                                     │
│     • Format-Validierung (Regex, Typ)                    │
│     • Business-Validierung (optional via Webhook)        │
│     • Normalisierung anwenden                            │
│                                                          │
│  5. VOLLSTÄNDIG?                                         │
│     Ja → CONDITIONS prüfen → ACTIONS ausführen          │
│     Nein → Nächsten fehlenden Slot erfragen             │
│            → LLM generiert kontextuelle Rückfrage        │
│                                                          │
│  6. ANTWORT GENERIEREN                                   │
│     • Template-Text oder LLM-generierte Antwort          │
│     • TTS: Text → Audio                                  │
│     • Senden an Client                                   │
│                                                          │
│  OUTPUT: assistant_text, audio, session_updated          │
└──────────────────────────────────────────────────────────┘
```

---

## 6. LLM-Prompt-Strategie

### System-Prompt (globaler Anteil)

```
Du bist ein freundlicher Sprachassistent. Du hilfst Nutzern dabei,
ihre Anliegen zu formulieren und die richtigen Aktionen auszulösen.

Verfügbare Flows:
{{flows_list}}

Regeln:
- Extrahiere Informationen präzise aus dem gesprochenen Text
- Bei Unklarheiten frage gezielt nach einem Punkt
- Fasse dich kurz — Antworten werden vorgelesen
- Bestätige immer, was du verstanden hast, bevor du handelst
- Antworte auf Deutsch, es sei denn, der Nutzer spricht Englisch
```

### LLM-Antwortformat (strukturiert)

Das LLM antwortet immer mit validem JSON in einem `<response>`-Block:

```json
{
  "intent": "password_reset",
  "confidence": 0.92,
  "extracted_slots": {
    "username": "max.mustermann"
  },
  "assistant_response": "Ich verstehe, Sie möchten das Passwort für max.mustermann zurücksetzen. Soll ich das wirklich tun?",
  "needs_clarification": false,
  "reasoning": "Nutzer nannte explizit Benutzernamen und Aktion"
}
```

---

## 7. Beispiel-Flows (Bibliothek)

### 7.1 Passwort zurücksetzen

```json
{
  "intent_name": "password_reset",
  "display_name": "Passwort zurücksetzen",
  "slots": [
    { "name": "username", "type": "string", "required": true,
      "prompt": "Für welchen Benutzernamen soll das Passwort zurückgesetzt werden?" },
    { "name": "confirmed", "type": "boolean", "required": true,
      "prompt": "Soll ich das Passwort für '{{username}}' wirklich zurücksetzen?" }
  ],
  "actions": [{ "type": "webhook", "webhook_ref": "helpdesk" }]
}
```

### 7.2 Support-Ticket erstellen

```json
{
  "intent_name": "ticket_create",
  "display_name": "Support-Ticket erstellen",
  "slots": [
    { "name": "category", "type": "enum",
      "values": ["Hardware", "Software", "Netzwerk", "Sonstiges"],
      "prompt": "Um welche Kategorie handelt es sich? Hardware, Software, Netzwerk oder Sonstiges?" },
    { "name": "priority", "type": "enum", "values": ["Hoch", "Mittel", "Niedrig"],
      "prompt": "Wie dringend ist das Problem? Hoch, Mittel oder Niedrig?" },
    { "name": "description", "type": "string", "required": true,
      "prompt": "Bitte beschreiben Sie Ihr Problem kurz." }
  ],
  "actions": [{ "type": "webhook", "webhook_ref": "jira_api" }]
}
```

### 7.3 Urlaubsantrag

```json
{
  "intent_name": "vacation_request",
  "display_name": "Urlaubsantrag stellen",
  "slots": [
    { "name": "start_date", "type": "date", "required": true,
      "prompt": "Ab wann möchten Sie Urlaub nehmen?", "normalize": "date_iso" },
    { "name": "end_date", "type": "date", "required": true,
      "prompt": "Bis wann möchten Sie Urlaub nehmen?", "normalize": "date_iso" },
    { "name": "confirmed", "type": "boolean", "required": true,
      "prompt": "Sie möchten Urlaub vom {{start_date}} bis {{end_date}} beantragen. Soll ich den Antrag absenden?" }
  ],
  "actions": [{ "type": "webhook", "webhook_ref": "hr_system" }]
}
```

### 7.4 Allgemeine Auskunft (Fallback)

```json
{
  "intent_name": "general_inquiry",
  "display_name": "Allgemeine Anfrage",
  "priority": -10,
  "slots": [
    { "name": "topic", "type": "string", "required": true,
      "prompt": "Womit kann ich Ihnen helfen?" }
  ],
  "actions": [
    { "type": "llm_response",
      "prompt": "Beantworte die folgende Anfrage höflich: {{topic}}",
      "on_success": { "session_status": "completed" }
    }
  ]
}
```

---

## 8. Webhook-Konfiguration

Webhooks werden einmalig im Admin-Panel konfiguriert und in Flows referenziert:

```json
{
  "id": "helpdesk_api",
  "name": "Helpdesk API",
  "url": "https://helpdesk.example.com/api/v2/bot",
  "method": "POST",
  "auth": {
    "type": "bearer",
    "token_encrypted": "<AES-256-verschlüsselt>"
  },
  "headers": {
    "Content-Type": "application/json",
    "X-Bot-Source": "sprachbot"
  },
  "timeout_seconds": 15,
  "retry": {
    "max_attempts": 3,
    "backoff_seconds": 2
  }
}
```

---

## 9. Fehlerbehandlung

| Situation | Verhalten |
|-----------|-----------|
| STT fehlgeschlagen | "Ich konnte Sie leider nicht verstehen. Bitte wiederholen Sie." |
| Kein passender Flow | "Ich bin mir nicht sicher, wie ich Ihnen dabei helfen kann. Können Sie es anders formulieren?" |
| Zu viele Rückfragen (>max_turns) | "Ich konnte Ihr Anliegen leider nicht vollständig verstehen. Bitte wenden Sie sich an einen Mitarbeiter." |
| Webhook-Fehler | Flow-spezifische Fehlermeldung (konfigurierbar) |
| LLM-Timeout | "Es gab eine technische Störung. Bitte versuchen Sie es in einem Moment erneut." |
| Validierungsfehler | Slot-spezifische Fehlermeldung, erneute Abfrage |

---

## 10. Erweiterbarkeit

Das Flow-Framework ist so designed, dass neue Funktionen ohne Breaking Changes ergänzt werden können:

- **Neue Slot-Typen**: via Plugin-System registrierbar
- **Neue Action-Typen**: `type: "custom"` mit Handler-Registrierung
- **Neue Validatoren**: externe Webhook-Validierung für komplexe Regeln
- **Multi-Turn Sub-Flows**: Flows können andere Flows referenzieren
- **Conditional Flows**: A/B-Testing, nutzergruppen-spezifische Flows
- **Externe Flow-Quellen**: Flows aus externen Systemen importieren (REST, Git)
- **Neue Kanäle**: Channel-Handler-Interface ermöglicht Telefonie ohne Flow-Änderungen (siehe Abschnitt 11)

---

## 11. Optionale Erweiterung: Telefonie-Kanal

> Nicht Teil des MVP. Das Flow-Framework ist so designed, dass Telefonie **ohne Änderungen an bestehenden Flows** nachrüstbar ist.

### Channel-spezifische Responses (optional)

Flows können optionale phone-optimierte Antworttexte definieren. Ist kein `phone`-Eintrag vorhanden, wird `default` für alle Kanäle verwendet:

```json
{
  "slots": [
    {
      "name": "confirmed",
      "type": "boolean",
      "required": true,
      "prompt": {
        "default": "Soll ich das Passwort für '{{username}}' wirklich zurücksetzen?",
        "phone": "Passwort für {{username}} zurücksetzen? Drücken Sie 1 für Ja oder 2 für Nein."
      }
    }
  ]
}
```

### DTMF-Mapping (optional)

Flows können für Telefon-Kanäle Tasteneingaben auf Slot-Werte abbilden:

```json
{
  "dtmf_mapping": {
    "confirmed": {
      "1": true,
      "2": false
    },
    "priority": {
      "1": "Hoch",
      "2": "Mittel",
      "3": "Niedrig"
    }
  }
}
```

### Was sich im Backend ändert

Einzige Erweiterung: ein `TelephoneChannelHandler` implementiert dasselbe `ChannelHandler`-Interface wie der `BrowserChannelHandler`. Die Flow-Engine selbst bleibt vollständig unverändert.

```python
# Interface (bereits im MVP vorhanden)
class ChannelHandler(ABC):
    async def receive_audio(self) -> bytes: ...
    async def send_audio(self, audio: bytes) -> None: ...
    async def get_session_context(self) -> dict: ...

# MVP: Browser
class BrowserChannelHandler(ChannelHandler): ...

# Optionale Erweiterung: Telefon
class TelephoneChannelHandler(ChannelHandler): ...
```
