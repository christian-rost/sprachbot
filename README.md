# Sprachbot — Intelligentes Sprachsteuerungs-Framework

Ein flexibles, KI-gestütztes Sprachbot-System, das natürliche Sprache in definierte Aktionen umwandelt. Nutzer sprechen ihr Anliegen aus, das System versteht es, führt den passenden Flow aus — und fragt bei Bedarf nach.

---

## Überblick

```
Nutzer spricht
      ↓
Speech-to-Text (STT)
      ↓
LLM-Interpretation & Intent-Erkennung
      ↓
Flow-Framework (definierte Aktionen)
      ↓
Ausführung oder Rückfrage
      ↓
Text-to-Speech (TTS)
      ↓
Antwort an Nutzer
```

Der Zyklus wiederholt sich, bis die Aktion eindeutig ist und ausgeführt wurde.

---

## Features (MVP)

- Spracheingabe mit Speech-to-Text (Mistral STT)
- Intent-Erkennung und Slot-Filling via LLM (Mistral)
- Definierbare Flows mit Bedingungen und Aktionen
- Automatische Rückfragen bei unklarem Intent
- Text-to-Speech-Ausgabe (Mistral TTS)
- Web-basiertes Frontend mit Echtzeit-Sprachkanal
- Admin-Panel: Flows verwalten, Logs einsehen, System konfigurieren
- Webhook-basierte Aktions-Ausführung (externe Systeme anbinden)
- Multi-Tenant-fähige Architektur
- JWT-basierte Authentifizierung und RBAC

---

## Tech Stack

| Komponente       | Technologie                              |
|------------------|------------------------------------------|
| Frontend         | React 19 + Vite, WebRTC/WebSocket        |
| Backend          | FastAPI (Python 3.11)                    |
| Datenbank        | Supabase (PostgreSQL)                    |
| STT              | Mistral AI Speech API                    |
| TTS              | Mistral AI TTS API                       |
| LLM              | Mistral AI (mistral-large-latest etc.)   |
| Echtzeit         | WebSocket (FastAPI)                      |
| Deployment       | Coolify + Docker Compose                 |

---

## Projektstruktur

```
sprachbot/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI Entry Point
│   │   ├── auth.py                 # JWT Authentifizierung
│   │   ├── config.py               # Konfigurationsmanagement
│   │   ├── database.py             # Supabase-Verbindung
│   │   ├── stt_service.py          # Speech-to-Text Service
│   │   ├── tts_service.py          # Text-to-Speech Service
│   │   ├── llm_service.py          # LLM Integration (Claude)
│   │   ├── flow_engine.py          # Flow-Framework Engine
│   │   ├── flow_storage.py         # Flow CRUD
│   │   ├── session_storage.py      # Gesprächs-Sessions
│   │   ├── action_storage.py       # Aktionsdefinitionen
│   │   ├── user_storage.py         # Benutzerverwaltung
│   │   ├── audit_storage.py        # Audit-Log
│   │   └── webhook_service.py      # Webhook-Ausführung
│   ├── Dockerfile
│   ├── requirements.txt
│   └── pyproject.toml
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 # Haupt-App
│   │   ├── api.js                  # API Client
│   │   ├── components/
│   │   │   ├── VoiceRecorder.jsx   # Mikrofon-Aufnahme
│   │   │   ├── ChatHistory.jsx     # Gesprächsverlauf
│   │   │   ├── FlowEditor.jsx      # Admin: Flow-Editor
│   │   │   ├── SessionList.jsx     # Admin: Sessions
│   │   │   └── AuditLog.jsx        # Admin: Audit-Log
│   │   └── styles.css
│   ├── Dockerfile
│   ├── package.json
│   └── vite.config.js
│
├── supabase/
│   └── schema.sql                  # Datenbankschema
│
├── docker-compose.coolify.yml      # Coolify Deployment
├── .env.example                    # Umgebungsvariablen-Template
├── README.md
├── anforderungen.md
├── architektur.md
├── feature-spezifikation.md
├── admin-feature-spezifikation.md
├── flow-framework-konzept.md
├── roadmap-12-monate.md
├── sprintplan-q1.md
└── deployment-guide.md
```

---

## Schnellstart (Lokal)

```bash
# 1. Repository klonen
git clone <repo-url> sprachbot
cd sprachbot

# 2. Umgebungsvariablen setzen
cp .env.example .env
# → .env bearbeiten: API-Keys, Supabase-URL, JWT-Secret

# 3. Datenbankschema anlegen
# → supabase/schema.sql in Supabase-Dashboard ausführen

# 4. Backend starten
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 5. Frontend starten
cd frontend
npm install
npm run dev
```

→ Frontend: http://localhost:5173
→ Backend API: http://localhost:8000
→ API Docs: http://localhost:8000/docs

---

## Deployment (Coolify)

Siehe [deployment-guide.md](./deployment-guide.md) für vollständige Anleitung.

```bash
# Coolify: docker-compose.coolify.yml als Deployment-Quelle
# Umgebungsvariablen im Coolify-Dashboard eintragen
# Schema in Supabase ausführen
# Deploy starten
```

---

## Dokumentation

| Dokument | Inhalt |
|----------|--------|
| [anforderungen.md](./anforderungen.md) | Funktionale & nicht-funktionale Anforderungen |
| [architektur.md](./architektur.md) | Systemarchitektur, Datenmodell, API-Übersicht |
| [feature-spezifikation.md](./feature-spezifikation.md) | Detaillierte Feature-Beschreibungen |
| [admin-feature-spezifikation.md](./admin-feature-spezifikation.md) | Admin-Panel Funktionen |
| [flow-framework-konzept.md](./flow-framework-konzept.md) | Flow-Engine Konzept & Flow-Definition |
| [roadmap-12-monate.md](./roadmap-12-monate.md) | 12-Monats-Roadmap |
| [sprintplan-q1.md](./sprintplan-q1.md) | Q1 Sprint-Plan (detailliert) |
| [deployment-guide.md](./deployment-guide.md) | Coolify Deployment-Anleitung |
