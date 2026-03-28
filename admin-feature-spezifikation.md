# Admin-Feature-Spezifikation — Sprachbot

## 1. Zugang und Authentifizierung

### Login
- Eigener Admin-Login unter `/admin/login`
- E-Mail + Passwort
- JWT mit 8h Laufzeit + Refresh Token (7 Tage)
- Brute-Force-Schutz: 5 Fehlversuche → 15 Minuten Sperre
- Alle Admin-Logins werden im Audit-Log protokolliert

### Erststart
- Beim ersten Start wird ein `admin`-Benutzer mit temporärem Passwort erstellt
- Passwortänderung beim ersten Login erzwungen
- Initiales Setup-Wizard: Provider konfigurieren, ersten Flow erstellen

---

## 2. Dashboard

### Übersichtskacheln (Echtzeit)

| Kachel | Wert | Zeitraum |
|--------|------|---------|
| Aktive Sessions | Anzahl | Jetzt |
| Sessions heute | Anzahl | Heute 00:00 - jetzt |
| Erfolgsrate | % | Letzte 7 Tage |
| Ø Gesprächsdauer | Sekunden | Letzte 7 Tage |
| Top Intent | Name + Anzahl | Letzte 24h |
| Fehlerrate | % | Letzte 24h |
| Ø Latenz (E2E) | ms | Letzte Stunde |
| Provider Status | Alle OK / Warnung | Jetzt |

### Grafiken

**Sessions-Verlauf (Balken):**
- X-Achse: letzte 14 Tage
- Y-Achse: Anzahl Sessions
- Aufgeteilt nach Status: completed (grün), abandoned (gelb), error (rot)

**Intent-Verteilung (Donut):**
- Top 5 Intents + "Sonstige"
- Zeitraum: wählbar (heute / 7 Tage / 30 Tage)

**Latenz-Trend (Linie):**
- STT, LLM, TTS jeweils als eigene Linie
- Zeitraum: letzte 24h in Stunden-Schritten

---

## 3. Flow-Verwaltung (Detail)

### Flows-Liste

| Spalte | Sortierbar | Filterbar |
|--------|-----------|----------|
| Name | Ja | Textsuche |
| Intent | Ja | Textsuche |
| Status | Ja | Aktiv/Inaktiv |
| Priorität | Ja | - |
| Slots (Anzahl) | Nein | - |
| Aktion-Typ | Nein | Webhook/Internal |
| Erstellt | Ja | Datumsbereich |
| Zuletzt geändert | Ja | Datumsbereich |

**Bulk-Aktionen:**
- Mehrere Flows aktivieren/deaktivieren
- Mehrere Flows exportieren
- Mehrere Flows löschen (mit Bestätigung)

### Flow-Editor

**Tab 1: Grunddaten**
- Name (Pflichtfeld)
- Intent-Name (eindeutig, `snake_case`, auto-generiert aus Name)
- Beschreibung
- Priorität (Schieberegler -10 bis 10)
- Status: Aktiv / Inaktiv / Entwurf
- LLM System-Prompt (optional, Textarea)
- Beispiel-Äußerungen (für LLM-Training, min 3 empfohlen)

**Tab 2: Slots**
- Liste aller Slots (Drag & Drop für Reihenfolge)
- "Slot hinzufügen" Button
- Pro Slot:
  - Name (`snake_case`)
  - Anzeigename
  - Typ (Dropdown: string, email, number, boolean, date, enum, phone)
  - Pflichtfeld (Toggle)
  - Rückfrage-Text (mit Template-Variablen: `{{slot_name}}`)
  - Abhängig von (Dropdown: keiner der anderen Slots)
  - Validierung (je nach Typ):
    - string: Min/Max Länge, Regex-Pattern
    - number: Min/Max Wert
    - enum: Werte-Liste (Freitextfelder)
    - date: Min/Max Datum
  - Normalisierung (Dropdown)
  - Fehlermeldung bei ungültigem Wert

**Tab 3: Bedingungen**
- Liste von if/then Regeln
- "Bedingung hinzufügen" Button
- Pro Bedingung:
  - Wenn: Slot auswählen, Operator (==, !=, <, >), Wert
  - Dann: Aktion (abort, skip_to_slot, set_slot)
  - Antwort-Text bei Abort

**Tab 4: Aktionen**
- Liste ausführbarer Aktionen nach Slot-Vollständigkeit
- "Aktion hinzufügen" Button
- Aktionstypen:
  - **Webhook**: Webhook-Referenz auswählen, Payload-Template (JSON-Editor), on_success/on_error Texte
  - **LLM-Antwort**: Freitext-Antwort, LLM-generiert (optionaler Prompt)
  - **Intern**: Datenbankoperation (für zukünftige Erweiterungen)
- Sequenziell / Parallel Toggle (bei mehreren Aktionen)

**Tab 5: Erweitert**
- Max. Turns (Standardwert: 6)
- Session-Timeout in Sekunden
- Abbruch-Antwort (bei Timeout oder zu vielen Turns)
- JSON-Roheditor (vollständige Flow-Definition)

### Flow-Versionierung

- Jede Speicherung erzeugt eine neue Version
- Versionshistorie: Timestamp, Benutzer, Änderungszusammenfassung
- Diff-Ansicht: Vorherige vs. aktuelle Version (JSON-Diff)
- Rollback auf frühere Version möglich

### Flow-Test-Modus

- Seitenpanel im Flow-Editor (rechte Seite)
- Eingabefeld für Nutzer-Text
- "Testen" Button
- Anzeige:
  - Erkannter Intent (Name + Confidence)
  - Extrahierte Slots
  - Fehlende Slots
  - Generierte Rückfrage oder Bestätigung
  - Ausgeführte Aktion (dry-run, kein echter Webhook)
- Chat-Verlauf im Test-Modus (mehrere Turns testen)

---

## 4. Sessions-Verwaltung (Detail)

### Sessions-Liste

**Filter:**
- Zeitraum (Von / Bis, Datumsauswahl)
- Status: Alle / Aktiv / Abgeschlossen / Abgebrochen / Fehler
- Flow (Dropdown)
- Nutzer (Textsuche)
- Min. Turns / Max. Turns

**Spalten:**
- Session-ID (kurz, klickbar)
- Gestartet
- Dauer
- Verwendeter Flow
- Status (farbige Badge)
- Anzahl Turns
- Nutzer (oder "Anonym")
- Aktionen ausgeführt (Ja/Nein)

**Export:** Gefilterte Liste als CSV

### Session-Detailansicht

**Kopfbereich:**
- Session-ID, Status, Zeitraum, Dauer
- Verwendeter Flow (klickbar → Flow-Editor)
- Nutzer
- IP-Adresse (anonymisiert oder vollständig, je nach Konfiguration)

**Gesprächsverlauf:**
```
[14:32:01] 👤 USER:    "Ich möchte mein Passwort zurücksetzen"
           🎯 Intent:  password_reset (Confidence: 94%)
           📦 Slots:   {} (leer)

[14:32:03] 🤖 BOT:     "Für welchen Benutzernamen soll das Passwort zurückgesetzt werden?"

[14:32:08] 👤 USER:    "max.mustermann"
           🎯 Intent:  password_reset (fortgesetzt)
           📦 Slots:   { username: "max.mustermann" }

[14:32:10] 🤖 BOT:     "Soll ich das Passwort für max.mustermann wirklich zurücksetzen?"

[14:32:14] 👤 USER:    "Ja"
           📦 Slots:   { username: "max.mustermann", confirmed: true }

[14:32:14] ⚡ AKTION:  Webhook → helpdesk_api
           📤 Payload: { action: "reset_password", username: "max.mustermann" }
           📥 Response: 200 OK { success: true } (312ms)

[14:32:15] 🤖 BOT:     "Das Passwort wurde erfolgreich zurückgesetzt..."

[14:32:15] ✅ SESSION: Abgeschlossen (Dauer: 14s, 3 Turns)
```

**Latenz-Details:**
- Pro Turn: STT-Zeit, LLM-Zeit, TTS-Zeit
- Gesamt-Latenz

---

## 5. Benutzerverwaltung (Detail)

### Benutzer-Liste

| Spalte | Inhalt |
|--------|--------|
| Name | Vorname + Nachname |
| Benutzername | Login-Name |
| E-Mail | E-Mail-Adresse |
| Rolle | Badge (ADMIN/OPERATOR/USER) |
| Status | Aktiv / Inaktiv |
| Sessions | Anzahl gesamt |
| Letzte Aktivität | Datum/Uhrzeit |
| Erstellt | Datum |

### Benutzer erstellen

Pflichtfelder:
- Benutzername (eindeutig, 3-50 Zeichen, keine Sonderzeichen)
- E-Mail (eindeutig, valide Adresse)
- Vorname, Nachname
- Rolle (Dropdown)

Optionale Felder:
- Temporäres Passwort (oder: auto-generiert, per E-Mail senden)
- Passwortänderung beim ersten Login erzwingen (Toggle)
- Notizen (intern, sieht nur Admin)

### Passwort-Richtlinien (konfigurierbar)

- Mindestlänge (Standard: 12)
- Großbuchstaben erforderlich
- Zahlen erforderlich
- Sonderzeichen erforderlich
- Passwort-History (letzte N Passwörter nicht wiederverwenden)
- Maximales Passwortalter (in Tagen)

---

## 6. Konfiguration — Provider

### STT-Provider-Konfiguration

```
Provider:    Mistral Speech API
API-Key:     [●●●●●●●●●●●●] [anzeigen] [ändern]
Modell:      <Mistral STT Modell>
Sprache:     Automatisch / Deutsch / Englisch
Timeout:     30s
Max. Größe:  10 MB

[Provider testen]
→ Audio hochladen → Transkription anzeigen
→ Latenz: 342ms   ✓ Erfolgreich
```

### TTS-Provider-Konfiguration

```
Provider:    Mistral TTS API
API-Key:     [●●●●●●●●●●●●] [anzeigen] [ändern]
Modell:      <Mistral TTS Modell>
Stimme:      <verfügbare Mistral-Stimme> [Vorschau ▶]
Geschw.:     1.0x [Schieber]
Format:      MP3

[Provider testen]
→ "Hallo, ich bin Ihr Sprachassistent." ▶ [abspielen]
→ Latenz: 521ms   ✓ Erfolgreich
```

### LLM-Provider-Konfiguration

```
Provider:    Mistral AI
API-Key:     [●●●●●●●●●●●●] [anzeigen] [ändern]
Modell:      mistral-large-latest
Temperature: 0.3 [Schieber]
Max Tokens:  1024
Timeout:     30s

Globaler System-Prompt:
[Textarea: Du bist ein freundlicher Sprachassistent...]

[Provider testen]
→ Promptfeld: "Wie lautet mein Intent wenn ich sage: Passwort vergessen?"
→ [Absenden]
→ Antwort: { intent: "password_reset", confidence: 0.95 }
→ Latenz: 876ms   ✓ Erfolgreich
```

---

## 7. Webhook-Verwaltung (Detail)

### Webhook-Liste

| Spalte | Inhalt |
|--------|--------|
| Name | Anzeigename |
| URL | (teilweise maskiert) |
| Auth-Typ | Badge: Bearer/Basic/API-Key/None |
| Status | Erreichbar / Nicht erreichbar / Unbekannt |
| Letzte Prüfung | Zeitstempel |
| Timeout | Sekunden |
| Verwendet von | Anzahl Flows |

### Webhook-Editor

**Grunddaten:**
- Name (intern, für Flow-Auswahl)
- URL (Pflichtfeld, https:// empfohlen)
- Methode: GET / POST / PUT / PATCH

**Authentifizierung:**
```
Typ: Bearer Token
Token: [●●●●●●●●●●●●] [anzeigen] [ändern]
Header-Name: Authorization
Header-Wert: Bearer <token>
```

**Custom Headers:**
```
[+] Header hinzufügen
Content-Type:     application/json
X-Bot-Source:     sprachbot
X-Tenant-ID:      {{tenant_id}}
```

**Retry-Konfiguration:**
- Max. Versuche: 1 / 2 / 3 / 5
- Wartezeit zwischen Versuchen: 1s / 2s / 5s / 10s
- Retry bei: Netzwerkfehler / HTTP 5xx / Alle Fehler

**Test:**
```
Test-Payload (JSON-Editor):
{
  "action": "reset_password",
  "username": "test.user"
}

[Webhook testen]
→ HTTP 200 OK
→ Response: { "success": true, "ticket_id": "HD-1234" }
→ Latenz: 234ms
```

---

## 8. Audit-Log (Detail)

### Ansicht

Tabelle, neueste Ereignisse zuerst, 100 pro Seite.

| Spalte | Inhalt |
|--------|--------|
| Zeitstempel | Datum + Uhrzeit (ms) |
| Ereignis | Event-Typ (farbig) |
| Benutzer | Name (oder "System") |
| Entity | Typ + Name/ID |
| Details | Kurzfassung |
| IP | Adresse |

**Ereignis-Farben:**
- Grün: Erfolgreiche Aktionen (completed, created)
- Blau: Konfigurationsänderungen (updated, configured)
- Orange: Warnungen (failed, retry)
- Rot: Fehler, Sicherheitsereignisse (error, login_failed, deleted)

### Filter

- Zeitraum: Von / Bis
- Ereignis-Typ (Multiselect)
- Benutzer (Dropdown)
- Entity-Typ (flow / session / user / config / webhook)

### Export

- CSV-Export mit aktivem Filter
- JSON-Export für forensische Auswertung
- Maximale Export-Größe: 10.000 Einträge

---

## 9. System-Einstellungen

### Allgemein

- System-Name (erscheint im Frontend)
- Standard-Sprache (DE / EN)
- Session-Timeout (Minuten, Standard: 10)
- Max. Turns pro Session (Standard: 6)
- Rate-Limit: Anonym / Authentifiziert (Requests/Minute)

### Datenschutz

- Session-Daten-Retention (Tage, 0 = kein Auto-Delete)
- Audiodaten: Immer löschen / N Stunden aufbewahren
- IP-Adressen: Vollständig / Anonymisiert (letztes Oktett 0) / Nicht speichern
- DSGVO-Löschanfragen: Benutzer-Daten vollständig löschen

### Notifications (E-Mail)

- SMTP-Konfiguration (Host, Port, User, Passwort, TLS)
- Absender-Adresse
- Benachrichtigungen bei:
  - Provider-Fehler (>5 Fehler/Minute)
  - Hohe Fehlerrate (>20% in letzter Stunde)
  - Neuer Admin-Login von unbekannter IP
  - Session-Fehler (Webhook-Ausfall)

### Sicherheit

- Passwort-Richtlinien (Mindestlänge, Komplexität, History, Ablauf)
- Zwei-Faktor-Authentifizierung für Admin: Aktivieren/Deaktivieren
- Erlaubte IP-Ranges für Admin-Zugang (Whitelist, leer = alle)
- API-Key für Maschinen-Authentifizierung verwalten

---

## 10. Multi-Tenant-Konfiguration

### Mandanten-Verwaltung (Super-Admin)

- Mandanten erstellen / deaktivieren
- Pro Mandant: Name, Domain, Logo, Farbschema
- Ressourcen-Limits: Max. Sessions/Tag, Max. Flows, Storage
- Eigene Provider-Konfiguration pro Mandant
- Datenisolation: Supabase Row-Level-Security

### Branding pro Mandant

- Logo hochladen
- Primärfarbe für UI
- Willkommens-Text / -Stimme konfigurieren
- Eigene Domain (Subdomain routing)
