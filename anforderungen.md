# Anforderungen — Sprachbot

## 1. Projektziel

Ein flexibles, KI-gestütztes Sprachsteuerungssystem, das natürliche Sprache in strukturierte Aktionen überführt. Nutzer formulieren ihr Anliegen mündlich, das System interpretiert es, führt den passenden Flow aus und gibt die Antwort per Sprache zurück. Kernprinzip: **das System fragt nach, bis die Aktion eindeutig ist**.

---

## 2. Stakeholder

| Stakeholder | Rolle | Interessen |
|-------------|-------|------------|
| Endnutzer | Spricht mit dem System | Schnelle, intuitive Bedienung ohne Tastatur |
| Flow-Designer (Fachbereich) | Definiert Flows und Aktionen | Einfache, codefreie Flow-Definition |
| Administrator | Betreibt das System | Monitoring, Nutzerverwaltung, Konfiguration |
| Entwickler | Implementiert Integrationen | Klare APIs, Webhook-Schnittstellen |
| IT-Betrieb | Deployt und wartet | Einfaches Deployment, Observability |

---

## 3. Funktionale Anforderungen

### 3.1 Spracheingabe (Speech-to-Text)

| ID | Anforderung | Priorität |
|----|-------------|-----------|
| F-STT-01 | Das System nimmt Spracheingaben über Mikrofon im Browser entgegen | Must |
| F-STT-02 | Sprache wird in Echtzeit oder nach Ende der Aufnahme transkribiert | Must |
| F-STT-03 | Unterstützung für Deutsch und Englisch (erweiterbar) | Must |
| F-STT-04 | Anzeige der Transkription im UI vor Verarbeitung | Should |
| F-STT-05 | Automatische Erkennung des Sprachendes (VAD — Voice Activity Detection) | Should |
| F-STT-06 | Manuelle Korrektur der Transkription durch Nutzer möglich | Could |
| F-STT-07 | Adapter-Pattern: STT-Provider in Konfiguration austauschbar (Fallback) | Should |

### 3.2 Intent-Erkennung und Dialogmanagement (LLM)

| ID | Anforderung | Priorität |
|----|-------------|-----------|
| F-LLM-01 | LLM erkennt den Intent des Nutzers aus dem transkribierten Text | Must |
| F-LLM-02 | LLM extrahiert relevante Slot-Werte (Parameter) aus der Äußerung | Must |
| F-LLM-03 | Bei unvollständigen Informationen generiert das LLM eine präzise Rückfrage | Must |
| F-LLM-04 | Das LLM erhält den Gesprächskontext (bisherige Nachrichten, aktiver Flow) | Must |
| F-LLM-05 | Das LLM wählt den passenden Flow aus einer definierten Liste | Must |
| F-LLM-06 | Confidence-Score für Intent-Erkennung wird intern geloggt | Should |
| F-LLM-07 | Fallback-Mechanismus bei unbekanntem Intent (freundliche Ablehnung) | Must |
| F-LLM-08 | Mehrstufige Dialoge werden über mehrere Turns hinweg korrekt verfolgt | Must |
| F-LLM-09 | System-Prompt pro Flow konfigurierbar | Should |
| F-LLM-10 | LLM-Provider über Konfiguration austauschbar (Adapter-Pattern) | Could |

### 3.3 Flow-Framework

| ID | Anforderung | Priorität |
|----|-------------|-----------|
| F-FLOW-01 | Flows werden in strukturiertem Format (JSON/YAML) definiert | Must |
| F-FLOW-02 | Ein Flow besteht aus: Intent, benötigten Slots, Validierungsregeln, Aktionen | Must |
| F-FLOW-03 | Flows können über eine Admin-UI erstellt und bearbeitet werden | Must |
| F-FLOW-04 | Flows können verschachtelt sein (Sub-Flows) | Should |
| F-FLOW-05 | Bedingte Verzweigungen in Flows (if/else basierend auf Slot-Werten) | Should |
| F-FLOW-06 | Flows können externe Aktionen per Webhook auslösen | Must |
| F-FLOW-07 | Flows können interne Aktionen ausführen (DB-Operationen) | Must |
| F-FLOW-08 | Flow-Versionierung (Änderungshistorie) | Could |
| F-FLOW-09 | Flows können aktiviert/deaktiviert werden | Must |
| F-FLOW-10 | Import/Export von Flows als JSON | Should |

### 3.4 Aktionsausführung

| ID | Anforderung | Priorität |
|----|-------------|-----------|
| F-ACT-01 | Webhooks: HTTP POST an konfigurierten Endpunkt mit Slot-Daten | Must |
| F-ACT-02 | Antworten von Webhooks werden ins LLM zurückgespielt | Should |
| F-ACT-03 | Retry-Logik bei fehlgeschlagenen Webhook-Aufrufen | Should |
| F-ACT-04 | Interne Aktionen: Datenbankoperationen, Status-Updates | Should |
| F-ACT-05 | Aktionen können sequenziell oder parallel ausgeführt werden | Could |
| F-ACT-06 | Bestätigungsschritt vor kritischen Aktionen | Should |

### 3.5 Sprachausgabe (Text-to-Speech)

| ID | Anforderung | Priorität |
|----|-------------|-----------|
| F-TTS-01 | LLM-Antworten und Rückfragen werden per TTS vorgelesen | Must |
| F-TTS-02 | TTS-Stimme und Geschwindigkeit konfigurierbar | Should |
| F-TTS-03 | Unterstützung für Deutsch und Englisch | Must |
| F-TTS-04 | Sprache wird direkt im Browser abgespielt | Must |
| F-TTS-05 | TTS-Provider über Konfiguration austauschbar (Adapter-Pattern) | Should |
| F-TTS-06 | Nutzer kann TTS deaktivieren (nur Text-Anzeige) | Should |

### 3.6 Session-Management

| ID | Anforderung | Priorität |
|----|-------------|-----------|
| F-SES-01 | Jede Interaktion wird als Session mit eindeutiger ID verwaltet | Must |
| F-SES-02 | Sessions haben einen Zustand: aktiv, abgeschlossen, abgebrochen | Must |
| F-SES-03 | Gesprächsverlauf wird pro Session gespeichert | Must |
| F-SES-04 | Sessions haben ein konfigurierbares Timeout (Inaktivität) | Should |
| F-SES-05 | Sessions können anonym oder authentifiziert sein | Should |
| F-SES-06 | Admin kann vergangene Sessions einsehen | Must |

### 3.7 Authentifizierung und Autorisierung

| ID | Anforderung | Priorität |
|----|-------------|-----------|
| F-AUTH-01 | JWT-basierte Authentifizierung | Must |
| F-AUTH-02 | Rollen: ADMIN, OPERATOR, USER, GUEST (anonym) | Must |
| F-AUTH-03 | Passwortgeschützter Admin-Bereich | Must |
| F-AUTH-04 | API-Key-Authentifizierung für externe Integrationen | Should |
| F-AUTH-05 | Single Sign-On (SAML/OAuth) | Could |

### 3.8 Admin-Features

| ID | Anforderung | Priorität |
|----|-------------|-----------|
| F-ADM-01 | Flow-Verwaltung (CRUD) über Admin-UI | Must |
| F-ADM-02 | Benutzerverwaltung (CRUD, Rollen) | Must |
| F-ADM-03 | Provider-Konfiguration (STT, TTS, LLM API-Keys) | Must |
| F-ADM-04 | Audit-Log aller Aktionen und Admin-Operationen | Must |
| F-ADM-05 | Session-Übersicht und Gesprächsverlauf einsehen | Must |
| F-ADM-06 | System-Monitoring (aktive Sessions, Fehlerrate, Latenz) | Should |
| F-ADM-07 | Webhook-Konfiguration und Test | Must |
| F-ADM-08 | Prompt-Templates verwalten | Should |
| F-ADM-09 | Blacklist-Wörter/Phrasen konfigurieren | Could |

---

## 4. Nicht-funktionale Anforderungen

### 4.1 Performance

| ID | Anforderung | Zielwert |
|----|-------------|----------|
| NF-PERF-01 | End-to-End-Latenz (Sprache → Antwort) | < 3 Sekunden |
| NF-PERF-02 | STT-Transkription | < 1 Sekunde (kurze Äußerungen) |
| NF-PERF-03 | LLM Intent-Erkennung | < 2 Sekunden |
| NF-PERF-04 | TTS-Generierung | < 1 Sekunde |
| NF-PERF-05 | Gleichzeitige Sessions | mind. 50 parallel |

### 4.2 Verfügbarkeit

| ID | Anforderung | Zielwert |
|----|-------------|----------|
| NF-AVAIL-01 | Systemverfügbarkeit | 99,5% (Produktionsumgebung) |
| NF-AVAIL-02 | Geplante Wartungsfenster | < 1h/Monat |
| NF-AVAIL-03 | Graceful Degradation bei LLM-Ausfall | Fallback-Meldung |

### 4.3 Sicherheit

| ID | Anforderung |
|----|-------------|
| NF-SEC-01 | Alle API-Keys werden verschlüsselt gespeichert |
| NF-SEC-02 | TLS/HTTPS für alle Kommunikationswege |
| NF-SEC-03 | Audiodaten werden nicht dauerhaft gespeichert (nur Transkription) |
| NF-SEC-04 | DSGVO-konformes Session-Logging (konfigurierbare Retention) |
| NF-SEC-05 | Rate-Limiting pro Nutzer/IP |
| NF-SEC-06 | Input-Validierung gegen Prompt-Injection |

### 4.4 Wartbarkeit

| ID | Anforderung |
|----|-------------|
| NF-MAINT-01 | Alle Provider (STT, TTS, LLM) über Konfiguration austauschbar |
| NF-MAINT-02 | Flows ohne Code-Änderung definierbar |
| NF-MAINT-03 | Strukturiertes Logging (JSON) |
| NF-MAINT-04 | Health-Check Endpoints |
| NF-MAINT-05 | Datenbankmigrationen versioniert |

### 4.5 Skalierbarkeit

| ID | Anforderung |
|----|-------------|
| NF-SCAL-01 | Multi-Tenant-fähig (mehrere Kunden/Projekte isoliert) |
| NF-SCAL-02 | Horizontale Skalierung des Backends möglich |
| NF-SCAL-03 | Stateless Backend (kein In-Memory-State) |

### 4.6 Usability

| ID | Anforderung |
|----|-------------|
| NF-USE-01 | Bedienbar ohne Tastatur (vollständig per Sprache) |
| NF-USE-02 | Responsives Frontend (Desktop und Tablet) |
| NF-USE-03 | Maximale Gesprächsrunden bis zur Aktionsausführung: 5 |
| NF-USE-04 | Klare Fehlermeldungen bei technischen Problemen |

---

## 5. Systemgrenzen und Abgrenzungen

**Im Scope:**
- Web-basierter Sprachkanal (Browser + Mikrofon)
- Flow-basierte Aktionsausführung
- Webhook-Integration zu externen Systemen
- Admin-Panel für Konfiguration und Monitoring

**Nicht im Scope (MVP):**
- Telefonie-Integration (optionale Erweiterung, siehe Abschnitt 7)
- Native Mobile Apps
- Offline-Betrieb ohne Internetverbindung
- Eigenes LLM-Hosting (Nutzung externer APIs)
- Echtzeit-Transkription während des Sprechens (streaming STT)

---

## 6. Abhängigkeiten

| Abhängigkeit | Typ | Kritikalität |
|--------------|-----|--------------|
| Mistral AI API (LLM) | Extern | Hoch — Kernfunktion |
| Mistral AI API (STT) | Extern | Hoch — Spracheingabe |
| Mistral AI API (TTS) | Extern | Hoch — Sprachausgabe |
| Supabase | Extern/Self-hosted | Hoch — Datenhaltung |
| Coolify | Self-hosted | Mittel — Deployment |
| Browser-Mikrofon-API (WebRTC) | Browser | Hoch — Eingabe |

---

## 7. Optionale Erweiterung: Telefonie-Kanal

Die Kern-Architektur ist von Beginn an **channel-agnostisch** ausgelegt (Channel-Abstraktions-Layer). Telefonie ist damit nachrüstbar, ohne Flow-Engine, LLM oder TTS zu verändern.

### 7.1 Anforderungen Telefonie-Kanal (optional)

| ID | Anforderung | Priorität |
|----|-------------|-----------|
| F-PHONE-01 | Eingehende Telefonanrufe werden an den Sprachbot weitergeleitet | Optional |
| F-PHONE-02 | Audio-Transcoding: G.711 (Telefon) ↔ PCM 16kHz (Mistral STT/TTS) | Optional |
| F-PHONE-03 | DTMF-Eingabe als Fallback (z.B. "Drücken Sie 1 für Ja") | Optional |
| F-PHONE-04 | Flows können channel-spezifische Antwort-Texte definieren (kürzer für Telefon) | Optional |
| F-PHONE-05 | Telefon-Session mit Anruf-ID verknüpft (kein JWT erforderlich) | Optional |
| F-PHONE-06 | Admin: Telefonie-Konnektoren konfigurieren (Twilio oder SIP-Server) | Optional |

### 7.2 Technische Vorbedingungen

Damit Telefonie nachrüstbar bleibt, müssen folgende Entscheidungen **bereits im MVP** getroffen werden:

- **Channel-Abstraktion im Backend**: `ChannelHandler`-Interface mit Implementierungen für `BrowserChannel` und später `TelephoneChannel`
- **Sessions ohne User-Kontext möglich**: `user_id` in `sb_sessions` ist nullable (bereits so geplant)
- **Kurze Flow-Responses**: Flows sollten von Beginn an prägnante Antworten haben — gut für Telefon, schadet Browser nicht

### 7.3 Implementierungsoptionen (bei Bedarf)

| Option | Aufwand | Datenhoheit | Empfehlung |
|--------|---------|-------------|-----------|
| **Twilio Programmable Voice** | ~2–3 Wochen | Daten über Twilio | Schnellster Einstieg |
| **Vonage Voice API** | ~2–3 Wochen | Daten über Vonage | Alternative zu Twilio |
| **Asterisk/FreeSWITCH (self-hosted)** | ~4–6 Wochen | Vollständig intern | Bei Datenschutz-Anforderungen |

---

## 8. Akzeptanzkriterien (MVP)

1. Nutzer kann "Passwort zurücksetzen" sagen → System fragt nach Username → Sendet Webhook → Bestätigt per Sprache
2. Bei unklarem Intent fragt System nach (maximal 3 Rückfragen)
3. Alle Flows sind über Admin-UI ohne Code-Änderung konfigurierbar
4. Admin sieht alle Sessions und deren Gesprächsverlauf
5. API-Keys sind verschlüsselt und nur im Admin-Bereich editierbar
6. System läuft stabil auf Coolify mit Docker Compose
7. Channel-Handler-Interface ist im Backend vorhanden (Vorbedingung für Telefonie-Erweiterung)
