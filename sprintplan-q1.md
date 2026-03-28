# Sprint-Plan Q2 2026 — Sprachbot MVP

> Q2 2026: April – Juni 2026 (MVP-Phase)
> Sprint-Dauer: 2 Wochen
> Provider: Mistral AI (STT, LLM, TTS)

---

## Sprint-Übersicht

| Sprint | Zeitraum | Fokus | Deliverable |
|--------|----------|-------|------------|
| Sprint 1 | 01.04. – 14.04. | Fundament + Infrastruktur | Deploybare Basis |
| Sprint 2 | 15.04. – 28.04. | Mistral STT + LLM | Sprache → Intent |
| Sprint 3 | 29.04. – 12.05. | Flow-Engine + TTS | Vollständiger Turn |
| Sprint 4 | 13.05. – 26.05. | Webhook-Aktionen + Sessions | Aktionen ausführbar |
| Sprint 5 | 27.05. – 09.06. | Admin-Panel Core | Admin funktionsfähig |
| Sprint 6 | 10.06. – 30.06. | Stabilisierung + Launch | Produktiv-Launch |

---

## Sprint 1 — Fundament + Infrastruktur (01.04. – 14.04.)

**Ziel:** Lauffähige Basis-Infrastruktur auf Coolify. Kein Feature, aber alles steht.

### Backend-Tasks

| # | Task | Beschreibung | Aufwand |
|---|------|-------------|---------|
| 1.1 | Projektstruktur | FastAPI-Projekt anlegen, Ordnerstruktur, pyproject.toml, requirements.txt | 2h |
| 1.2 | Konfiguration | config.py mit pydantic Settings, .env.example, alle Umgebungsvariablen | 1h |
| 1.3 | Datenbankverbindung | database.py: Supabase-Client, Verbindungstest | 2h |
| 1.4 | Datenbankschema | supabase/schema.sql: alle Tabellen (sb_users, sb_sessions, sb_messages, sb_flows, sb_config_providers, sb_config_webhooks, sb_audit_log) | 3h |
| 1.5 | Authentifizierung | auth.py: JWT-Login, Logout, /api/auth/me, Passwort-Hashing | 3h |
| 1.6 | RBAC-Middleware | Decorator-basierte Role-Guards für Endpoints | 2h |
| 1.7 | Health-Check | GET /health mit DB-Verbindungstest | 1h |
| 1.8 | Docker | backend/Dockerfile, .dockerignore | 1h |

### Frontend-Tasks

| # | Task | Beschreibung | Aufwand |
|---|------|-------------|---------|
| 1.9 | Vite/React Setup | npm init, Abhängigkeiten, vite.config.js | 1h |
| 1.10 | Login-Seite | E-Mail/Passwort-Formular, JWT speichern (localStorage) | 2h |
| 1.11 | API-Client | api.js: fetch-Wrapper mit JWT-Header, Error-Handling | 2h |
| 1.12 | Basis-Layout | Navigation, Routing (Admin vs. Nutzer), Responsive | 2h |
| 1.13 | Docker | frontend/Dockerfile (Node build → nginx) | 1h |

### DevOps-Tasks

| # | Task | Beschreibung | Aufwand |
|---|------|-------------|---------|
| 1.14 | Coolify Config | docker-compose.coolify.yml (backend + frontend Services) | 2h |
| 1.15 | Env-Dokumentation | .env.example vollständig + kommentiert | 1h |
| 1.16 | Coolify Deploy | Erstes Deployment auf Coolify, Smoke-Test | 2h |

**Sprint 1 Akzeptanzkriterium:** `GET /health` antwortet 200, Login funktioniert, System läuft auf Coolify.

---

## Sprint 2 — Mistral STT + LLM (15.04. – 28.04.)

**Ziel:** Sprache wird transkribiert und ein Intent erkannt.

### Backend-Tasks

| # | Task | Beschreibung | Aufwand |
|---|------|-------------|---------|
| 2.1 | Mistral API Client | mistral_client.py: Basis-Client, API-Key aus Config, Error-Handling | 3h |
| 2.2 | STT Service | stt_service.py: Audio → Text via Mistral Speech API | 3h |
| 2.3 | STT Endpoint | POST /api/sessions/{id}/transcribe: Audio-Upload, Validierung, Rückgabe | 2h |
| 2.4 | Audio-Validierung | Format-Check (WAV/WebM/OGG), Größen-Limit (10MB), Sanitierung | 2h |
| 2.5 | LLM Service | llm_service.py: Mistral Chat API, JSON-Response-Format erzwingen | 4h |
| 2.6 | Intent-Erkennung | Prompt-Design: Flow-Liste + Kontext → Intent + Slots | 3h |
| 2.7 | LLM-Prompt Builder | Konversationshistorie aufbereiten, System-Prompt zusammenstellen | 2h |
| 2.8 | Session-Storage | session_storage.py: CRUD, Status-Management | 3h |
| 2.9 | Session-Endpoints | POST /api/sessions, GET /api/sessions/{id}/messages | 2h |

### Frontend-Tasks

| # | Task | Beschreibung | Aufwand |
|---|------|-------------|---------|
| 2.10 | VoiceRecorder | VoiceRecorder.jsx: MediaRecorder API, Push-to-Talk, Audio-Blob | 4h |
| 2.11 | Transkriptions-Anzeige | Live-Anzeige des transkribierten Texts im UI | 1h |
| 2.12 | Intent-Anzeige (Debug) | Temporäre Anzeige erkannter Intent + Confidence | 1h |

### Config-Tasks

| # | Task | Beschreibung | Aufwand |
|---|------|-------------|---------|
| 2.13 | Provider-Config DB | sb_config_providers Tabelle, config_storage.py | 2h |
| 2.14 | Admin: Provider-Config | Einfaches Formular: Mistral API-Key eingeben und speichern | 3h |

**Sprint 2 Akzeptanzkriterium:** Audio-Upload → Transkription sichtbar → Intent im Debug-Panel.

---

## Sprint 3 — Flow-Engine + TTS (29.04. – 12.05.)

**Ziel:** Vollständiger Konversations-Turn: Sprache rein → Sprache raus.

### Backend-Tasks

| # | Task | Beschreibung | Aufwand |
|---|------|-------------|---------|
| 3.1 | Flow-Storage | flow_storage.py: CRUD, Aktivierungs-Toggle, Prioritäts-Sortierung | 3h |
| 3.2 | Flow-Schema | JSON-Schema validieren, Defaults setzen | 2h |
| 3.3 | Flow-Engine Kern | flow_engine.py: Intent-Match → Slot-Check → Rückfrage / Aktion | 5h |
| 3.4 | Slot-Validierung | Typen (string, boolean, email, enum, date), Regex, Normalisierung | 3h |
| 3.5 | Slot-Extraktion | LLM-Antwort parsen, Slots in Session speichern, Merge mit bestehenden | 2h |
| 3.6 | Rückfragen-Generierung | Nächsten fehlenden Slot bestimmen, Rückfrage-Text aus Template | 2h |
| 3.7 | TTS Service | tts_service.py: Text → Audio via Mistral TTS API | 3h |
| 3.8 | TTS Endpoint | POST /api/tts: Text → Audio-Stream, Content-Hash-Caching | 2h |
| 3.9 | Process-Endpoint | POST /api/sessions/{id}/process: Kompletter Turn-Handler | 3h |
| 3.10 | Beispiel-Flows | JSON-Definitionen für: Passwort-Reset, Ticket erstellen, Allg. Auskunft | 2h |

### Frontend-Tasks

| # | Task | Beschreibung | Aufwand |
|---|------|-------------|---------|
| 3.11 | ChatHistory | ChatHistory.jsx: Nachrichten anzeigen, Nutzer/Bot unterscheiden | 3h |
| 3.12 | TTS-Player | Audio abspielen nach Bot-Antwort, TTS-Toggle | 2h |
| 3.13 | Verarbeitungs-Indikator | Ladeanimation während STT/LLM/TTS läuft | 1h |
| 3.14 | Session-Start | Neue Session beim Öffnen starten, Session-ID halten | 1h |

**Sprint 3 Akzeptanzkriterium:** "Passwort zurücksetzen" sprechen → Bot fragt nach Benutzernamen → vollständiger Dialog (Text + Audio).

---

## Sprint 4 — Webhook-Aktionen + Sessions (13.05. – 26.05.)

**Ziel:** Flows werden vollständig ausgeführt, Sessions werden korrekt verwaltet.

### Backend-Tasks

| # | Task | Beschreibung | Aufwand |
|---|------|-------------|---------|
| 4.1 | Webhook-Storage | webhook_storage.py: CRUD, API-Key-Verschlüsselung | 3h |
| 4.2 | Webhook-Service | webhook_service.py: HTTP-Aufruf, Retry-Logik, Payload-Template | 4h |
| 4.3 | Template-Engine | Slot-Werte in Payload-Templates einsetzen ({{username}}) | 2h |
| 4.4 | Bestätigungsschritt | Confirmation-Slots vor Aktionsausführung erzwingen | 2h |
| 4.5 | Bedingte Flows | conditions aus Flow-Definition auswerten (abort, skip) | 2h |
| 4.6 | Session-Timeout | Inaktive Sessions nach N Minuten automatisch schließen | 2h |
| 4.7 | Max-Turns-Schutz | Nach max_turns Session mit Fallback-Nachricht beenden | 1h |
| 4.8 | Audit-Log | audit_storage.py: Alle relevanten Ereignisse protokollieren | 3h |
| 4.9 | Fallback-Flow | Unbekannter Intent → freundliche Ablehnung | 1h |
| 4.10 | WebSocket (Basis) | WS /ws/sessions/{id}: Echtzeit-Updates für Frontend | 4h |

### Frontend-Tasks

| # | Task | Beschreibung | Aufwand |
|---|------|-------------|---------|
| 4.11 | WebSocket-Client | WebSocket statt Polling für Echtzeit-Updates | 3h |
| 4.12 | Session-Status | UI-Feedback: Session abgeschlossen / Fehler / Abbruch | 2h |
| 4.13 | Neu starten | Session-Reset-Button, neue Session starten | 1h |
| 4.14 | Fehler-Handling | Fehlermeldungen verständlich anzeigen (STT-Fehler, Webhook-Fehler) | 2h |

**Sprint 4 Akzeptanzkriterium:** Vollständiger Flow von Sprache bis Webhook-Ausführung und Bestätigung.

---

## Sprint 5 — Admin-Panel Core (27.05. – 09.06.)

**Ziel:** Funktionsfähiges Admin-Panel für Flows, Sessions und Konfiguration.

### Frontend-Tasks (Admin)

| # | Task | Beschreibung | Aufwand |
|---|------|-------------|---------|
| 5.1 | Admin-Navigation | Sidebar mit Flow-Verwaltung, Sessions, Benutzer, Konfig | 2h |
| 5.2 | Flow-Liste | Tabellarische Übersicht, Filter, Aktiv/Inaktiv-Toggle | 3h |
| 5.3 | Flow-Editor | Formular (Grunddaten, Slots, Aktionen), Speichern/Abbrechen | 6h |
| 5.4 | Flow-Test-Modus | Seitenpanel: Text eingeben → Intent + Slots sehen (Dry-Run) | 4h |
| 5.5 | Provider-Konfig | Mistral API-Key, Modell-Auswahl, Test-Button pro Dienst | 4h |
| 5.6 | Webhook-Verwaltung | CRUD, URL/Auth/Header, Test-Button | 4h |
| 5.7 | Session-Übersicht | Filterliste, Session-Detail mit Gesprächsverlauf | 4h |
| 5.8 | Benutzerverwaltung | CRUD, Rollen, Aktivierungs-Toggle | 3h |
| 5.9 | Audit-Log | Tabelle, Filter nach Typ/Zeitraum | 2h |

### Backend-Tasks (Admin)

| # | Task | Beschreibung | Aufwand |
|---|------|-------------|---------|
| 5.10 | Flow-Endpoints | CRUD + Toggle + Export/Import | 3h |
| 5.11 | Admin-Session-Endpoints | Alle Sessions abrufbar, gefiltert, paginiert | 2h |
| 5.12 | Benutzer-Endpoints | CRUD + Rollen-Änderung + Passwort-Reset | 3h |
| 5.13 | Audit-Log-Endpoint | GET /api/admin/audit-log, Filter, Paginierung | 2h |
| 5.14 | Stats-Endpoint | GET /api/admin/stats (Session-Count, Fehlerrate, Top-Intents) | 3h |
| 5.15 | Flow-Dry-Run | POST /api/flows/{id}/test: Text → Intent/Slots ohne Aktion | 2h |

**Sprint 5 Akzeptanzkriterium:** Admin kann Flows erstellen/testen, Sessions einsehen, Provider konfigurieren.

---

## Sprint 6 — Stabilisierung + Launch (10.06. – 30.06.)

**Ziel:** System produktiv, stabil, dokumentiert.

### Stabilisierungs-Tasks

| # | Task | Beschreibung | Aufwand |
|---|------|-------------|---------|
| 6.1 | Rate-Limiting | fastapi-limiter: per IP und per Nutzer | 2h |
| 6.2 | Input-Sanitierung | Audio-Größe, Text-Länge, Prompt-Injection-Schutz | 2h |
| 6.3 | Error-Logging | Strukturiertes JSON-Logging, Log-Level | 2h |
| 6.4 | CORS | Korrekte CORS-Konfiguration für Produktionsdomäne | 1h |
| 6.5 | HTTPS erzwingen | Redirect HTTP → HTTPS (Coolify-Proxy) | 1h |
| 6.6 | Passwort-Policy | Mindestlänge, Komplexität, Erständerung erzwingen | 2h |

### Testing-Tasks

| # | Task | Beschreibung | Aufwand |
|---|------|-------------|---------|
| 6.7 | API-Tests | pytest: Auth, Flow-Engine, Webhook-Service | 4h |
| 6.8 | E2E-Test | Kompletter Flow: Audio → Transkription → Intent → Webhook | 3h |
| 6.9 | Load-Test | 10 parallele Sessions, Latenz messen | 2h |
| 6.10 | Security-Check | OWASP Top 10 Checkliste, Input-Validierung verifizieren | 3h |

### Dokumentation + Deployment

| # | Task | Beschreibung | Aufwand |
|---|------|-------------|---------|
| 6.11 | Deployment-Guide | Schritt-für-Schritt Coolify-Anleitung | 2h |
| 6.12 | API-Docs | OpenAPI-Spec prüfen, Beschreibungen ergänzen | 2h |
| 6.13 | Admin-Guide | Kurzanleitung: Flows erstellen, Provider konfigurieren | 2h |
| 6.14 | Beispiel-Flows | 3 fertige Flows in repo: Passwort, Ticket, Termin | 2h |
| 6.15 | Produktiv-Deployment | Finales Coolify-Deployment, DNS, SSL-Zertifikat | 2h |
| 6.16 | Abnahme | End-to-End Demo aller MVP-Features | 1h |

**Sprint 6 Akzeptanzkriterium:** Alle MVP-Akzeptanzkriterien aus anforderungen.md erfüllt. System läuft stabil auf Coolify.

---

## MVP Akzeptanzkriterien (Zusammenfassung)

- [ ] Nutzer kann "Passwort zurücksetzen" sprechen → System fragt nach Benutzernamen → Webhook ausgeführt → Bestätigung per Sprache
- [ ] Bei unklarem Intent fragt System nach (maximal max_turns)
- [ ] Alle Flows über Admin-UI ohne Code konfigurierbar
- [ ] Admin sieht alle Sessions und Gesprächsverläufe
- [ ] Mistral API-Keys verschlüsselt gespeichert, nur im Admin editierbar
- [ ] System läuft stabil auf Coolify mit Docker Compose
- [ ] Deployment in unter 15 Minuten über Coolify-Dokumentation reproduzierbar

---

## Aufwandsschätzung (grob)

| Sprint | Backend | Frontend | DevOps/Docs | Gesamt |
|--------|---------|----------|-------------|--------|
| Sprint 1 | 15h | 8h | 5h | 28h |
| Sprint 2 | 26h | 6h | 5h | 37h |
| Sprint 3 | 22h | 7h | — | 29h |
| Sprint 4 | 24h | 8h | — | 32h |
| Sprint 5 | 15h | 28h | — | 43h |
| Sprint 6 | 9h | — | 11h + 9h Tests | 29h |
| **Gesamt** | **111h** | **57h** | **30h** | **198h** |
