# 12-Monats-Roadmap — Sprachbot

> Provider-Stack: Mistral AI (STT, LLM, TTS)
> Deployment: Coolify + Docker Compose
> Zeitraum: April 2026 – März 2027

---

## Übersicht

```
Q2 2026 (Apr–Jun)   MVP — Kern-System
Q3 2026 (Jul–Sep)   Stabilität + Admin-Features
Q4 2026 (Okt–Dez)  Erweiterungen + Integrationen
Q1 2027 (Jan–Mrz)  Skalierung + Enterprise-Features
```

---

## Phase 1: MVP (Q2 2026 — April bis Juni)

**Ziel:** Funktionierender End-to-End Sprachbot mit grundlegenden Features

### April 2026 — Fundament

**Backend:**
- [x] Projektstruktur aufsetzen (FastAPI, Supabase, Docker)
- [x] Authentifizierung: JWT Login/Logout, RBAC (ADMIN, OPERATOR, USER, GUEST)
- [x] Datenbankschema (sb_sessions, sb_messages, sb_flows, sb_users, sb_audit_log)
- [x] Health-Check Endpoint
- [x] Coolify docker-compose.coolify.yml

**Frontend:**
- [x] React/Vite Projektstruktur
- [x] Login-Seite
- [x] Basis-Layout mit Navigation

### Mai 2026 — Kern-Funktionalität

**STT-Integration (Mistral):**
- Mistral Speech API anbinden (Transkription)
- Audio-Upload Endpoint (max. 10MB, WAV/WebM)
- Spracherkennung Deutsch und Englisch
- Fehlerbehandlung (Timeout, Formatfehler)

**LLM-Integration (Mistral):**
- Mistral API Client (mistral-large-latest oder mistral-small)
- Flow-Liste an LLM übergeben
- Strukturierte JSON-Antwort (Intent, Slots, Confidence)
- Gesprächskontext (letzte N Turns)
- Prompt-Injection-Schutz (Input-Sanitierung)

**TTS-Integration (Mistral):**
- Mistral TTS API anbinden
- Text → Audio (MP3/Opus)
- Caching via Content-Hash
- Stimm-Konfiguration

**Flow-Engine (Basis):**
- Flow-Definition (JSON-Schema)
- Intent-Matching
- Slot-Extraktion und Validierung
- Rückfrage-Generierung bei fehlenden Slots
- Webhook-Ausführung (HTTP POST)

### Juni 2026 — Admin-Panel + Launch

**Admin-Panel:**
- Flow-CRUD (erstellen, bearbeiten, löschen, aktivieren)
- Provider-Konfiguration (Mistral API-Keys, Modell-Auswahl)
- Webhook-Verwaltung (CRUD, Test)
- Session-Übersicht (Liste + Detail)
- Benutzerverwaltung (CRUD, Rollen)

**Frontend (Nutzer):**
- Mikrofon-Aufnahme (Push-to-Talk)
- Gesprächsverlauf (Text)
- TTS-Wiedergabe im Browser
- Session-Management

**Deployment:**
- Coolify-Setup dokumentiert
- Umgebungsvariablen dokumentiert
- Schema-Migration: supabase/schema.sql
- Beispiel-Flows: Passwort zurücksetzen, Ticket erstellen

**MVP-Deliverable:** System läuft produktiv auf Coolify, erste Flows funktionieren End-to-End

---

## Phase 2: Stabilität und Admin-Features (Q3 2026 — Juli bis September)

**Ziel:** Robustes System, vollständiges Admin-Panel, erste Nutzer-Produktivsetzung

### Juli 2026 — Robustheit

- Fehlerbehandlung (alle Edge-Cases)
- Rate-Limiting (per IP und per Nutzer)
- Structured Logging (JSON, Log-Level konfigurierbar)
- Health-Check mit Abhängigkeits-Status (Mistral API, Supabase)
- Retry-Logik für Webhook-Aufrufe
- Session-Timeout-Mechanismus
- Audit-Log (vollständig)

### August 2026 — Admin-Panel Ausbau

- Dashboard mit KPI-Kacheln
- Echtzeit-Statistiken (Sessions, Fehlerrate, Latenz)
- 14-Tage-Verlaufsgrafik (Sessions nach Status)
- Intent-Verteilung (Donut-Chart)
- Latenz-Trend pro Provider (STT, LLM, TTS)
- Session-Export als CSV
- Audit-Log-Export als CSV
- Flow-Versionierung (Versionshistorie, Rollback)
- Flow-Test-Modus (Dry-Run)

### September 2026 — Flow-Framework Erweiterungen

- Bedingte Verzweigungen in Flows (if/then/else)
- Sub-Flow-Referenzierung
- Flow-Import/Export (JSON)
- Slot-Abhängigkeiten (depends_on)
- Slot-Normalisierungen (Datum, Telefon, lowercase)
- Enum-Slot-Typ mit konfigurierbaren Werten
- Validierungs-Webhook (externe Slot-Validierung)
- Globaler Fallback-Flow

**Q3-Deliverable:** System stabil, vollständige Admin-Features, 5+ Produktiv-Flows

---

## Phase 3: Erweiterungen und Integrationen (Q4 2026 — Oktober bis Dezember)

**Ziel:** Erweiterte Features, Multi-Tenant, externe Integrationen

### Oktober 2026 — Multi-Tenant

- Tenant-Isolation (Supabase RLS)
- Tenant-Konfiguration im Admin
- Per-Tenant Provider-Konfiguration (eigene Mistral-Keys)
- Per-Tenant Branding (Logo, Farbe, Name)
- Super-Admin-Panel (Tenant-Verwaltung, Ressourcen-Limits)
- Subdomain-Routing (tenant.sprachbot.example.com)

### November 2026 — Voice-Qualität und UX

- Voice Activity Detection (VAD) — automatische Sprachende-Erkennung
- Streaming-STT (Echtzeit-Transkription während Sprechen)
- Streaming-TTS (Audio beginnt vor vollständiger Textgenerierung)
- Mehrere Mistral-TTS-Stimmen (konfigurierbar pro Tenant)
- Gesprächsunterbrechung möglich (Nutzer spricht während TTS)
- Hintergrundgeräusch-Filterung (soweit Mistral API unterstützt)
- Mobile-optimiertes Frontend (Tablet)

### Dezember 2026 — Integration und API

- Öffentliche REST-API für externe Trigger (Flow per API starten)
- API-Key-Authentifizierung
- Webhook-Antworten im Dialog verarbeiten (LLM-Interpretation)
- Callback-URLs für asynchrone Aktionen
- Integration: ITSM-Konnektoren (Jira, ServiceNow — via Webhooks)
- Integration: HR-Systeme (via Webhooks)
- Sprachbot-Widget (Embed-Code für externe Websites)
- OpenAPI 3.0 Spezifikation vollständig

**Q4-Deliverable:** Multi-Tenant produktiv, öffentliche API verfügbar, 3+ Integrations-Konnektoren

---

## Phase 4: Skalierung und Enterprise (Q1 2027 — Januar bis März)

**Ziel:** Enterprise-Readiness, erweiterte Sicherheit, Analytik

### Januar 2027 — Analytik und Monitoring

- Erweitertes Analytics-Dashboard
- Konversationsanalyse (häufige Missverständnisse, Abbruchpunkte)
- A/B-Testing für Flows (zwei Varianten gegeneinander testen)
- Anomalie-Erkennung (ungewöhnliche Fehlerrate, Latenz-Spike)
- Alert-System (E-Mail bei Schwellenwert-Überschreitung)
- Prometheus-Metriken für externe Monitoring-Tools
- Retention-Policies automatisch ausführen

### Februar 2027 — Erweiterte Sicherheit

- Zwei-Faktor-Authentifizierung (TOTP) für Admin
- Single Sign-On (SAML 2.0 / OIDC)
- IP-Whitelist für Admin-Zugang
- Verschlüsselung at-rest für Session-Logs
- DSGVO-Tool: Nutzer-Daten-Export und -Löschung (One-Click)
- Penetration-Test Vorbereitung + Remediation
- SOC2-Anforderungen dokumentieren

### März 2027 — Skalierung

- Horizontale Backend-Skalierung (stateless, Load-Balancer-fähig)
- Connection-Pooling für Supabase (PgBouncer)
- Redis-Cache für Sessions und TTS-Audio
- Background-Job-Queue für Webhooks (asynchron)
- Performance-Benchmark und Lasttest (100 parallele Sessions)
- CDN für Frontend-Assets (Coolify + Cloudflare)
- Disaster-Recovery-Dokumentation

**Q1 2027-Deliverable:** Enterprise-Readiness, 100+ parallele Sessions, SSO, SOC2-Vorbereitung

---

## Feature-Matrix nach Release

| Feature | MVP (Jun 26) | Q3 (Sep 26) | Q4 (Dez 26) | Q1 27 |
|---------|:-----------:|:-----------:|:-----------:|:-----:|
| STT (Mistral) | ✓ | ✓ | ✓ Streaming | ✓ |
| TTS (Mistral) | ✓ | ✓ | ✓ Streaming | ✓ |
| LLM (Mistral) | ✓ | ✓ | ✓ | ✓ |
| Flow-Engine (Basis) | ✓ | ✓ | ✓ | ✓ |
| Bedingte Flows | — | ✓ | ✓ | ✓ |
| Sub-Flows | — | ✓ | ✓ | ✓ |
| Admin-Dashboard | Basis | ✓ | ✓ | ✓ |
| Flow-Test-Modus | — | ✓ | ✓ | ✓ |
| Flow-Versionierung | — | ✓ | ✓ | ✓ |
| Webhook-Aktionen | ✓ | ✓ Retry | ✓ | ✓ |
| Multi-Tenant | — | — | ✓ | ✓ |
| VAD | — | — | ✓ | ✓ |
| Öffentliche API | — | — | ✓ | ✓ |
| SSO (SAML/OIDC) | — | — | — | ✓ |
| Redis-Cache | — | — | — | ✓ |
| A/B-Testing Flows | — | — | — | ✓ |
| 2FA Admin | — | — | — | ✓ |
| **Telefonie-Kanal** *(optional)* | — | — | — | Backlog |

---

## Optionaler Backlog: Telefonie-Kanal

> Nicht im regulären Roadmap-Horizont — bei Bedarf als separates Projekt planbar.
> **Vorbedingung ist bereits im MVP enthalten**: Channel-Abstraktion im Backend.

### Scope

- Audio-Transcoding-Layer (G.711 ↔ PCM 16kHz für Mistral STT/TTS)
- `TelephoneChannelHandler` als neue Channel-Implementierung
- DTMF-Fallback-Unterstützung in Flows
- Channel-spezifische Response-Texte in Flow-Definition (`responses.phone`)
- Admin: Telefonie-Konnektor konfigurieren (Twilio oder SIP)

### Implementierungsoptionen

| Option | Aufwand | Datenhoheit | Empfehlung |
|--------|---------|-------------|-----------|
| Twilio Programmable Voice | ~2–3 Wochen | Daten über Twilio | Schnellster Einstieg |
| Vonage Voice API | ~2–3 Wochen | Daten über Vonage | Alternative zu Twilio |
| Asterisk/FreeSWITCH (self-hosted) | ~4–6 Wochen | Vollständig intern | Bei Datenschutz-Anforderungen |

### Wichtige Unterschiede zum Browser-Kanal

| Aspekt | Browser | Telefon |
|--------|---------|---------|
| Audio-Format | WebM/OGG, 16–48 kHz | G.711, 8 kHz |
| Verbindungsaufbau | Nutzer öffnet URL | Anruf kommt rein |
| Authentifizierung | JWT | Telefonnummer / PIN |
| Latenz-Toleranz | ~3s | ~1–2s |
| Visuelle Rückmeldung | Chathistorie | Keine |
| Fallback-Eingabe | Nicht nötig | DTMF (Tasten) |

---

## Risiken und Abhängigkeiten

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|-----------|
| Mistral TTS/STT API nicht verfügbar / eingeschränkt | Mittel | Hoch | Adapter-Pattern: Provider austauschbar halten, Fallback auf OpenAI |
| Mistral API Latenz > Zielwert | Mittel | Mittel | Caching, Streaming-APIs nutzen, SLA prüfen |
| Supabase Ausfall | Niedrig | Hoch | Connection-Retry, Health-Monitoring, Backup-Strategie |
| Webhook-Endpunkte der Kunden instabil | Hoch | Mittel | Retry-Logik, async Queue, Fallback-Meldungen |
| Browser-Mikrofon-Berechtigungen | Mittel | Mittel | Klare Anleitung im UI, HTTPS enforced |
| Prompt-Injection in Spracheingaben | Mittel | Hoch | Input-Sanitierung, System-Prompt-Schutz, Monitoring |
