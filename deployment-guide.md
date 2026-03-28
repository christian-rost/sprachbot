# Deployment-Guide — Sprachbot auf Coolify

## Voraussetzungen

- Coolify installiert und erreichbar (xqtfive)
- Supabase self-hosted: `https://supabase.xqtfive.de`
- Mistral AI API-Key (platform.mistral.ai)
- Git-Repository: `https://github.com/christian-rost/sprachbot`
- Domain mit DNS-Zugang

---

## 1. Supabase-Datenbank einrichten

### 1.1 Schema anlegen

→ `https://supabase.xqtfive.de` → **SQL Editor → New Query**

Inhalt von `supabase/schema.sql` einfügen und **Run** klicken.

Erstellt folgende Tabellen (Prefix `sb_`):
- `sb_users`, `sb_audit_log` — Sprint 1
- `sb_sessions`, `sb_messages` — Sprint 2+
- `sb_flows`, `sb_flow_versions` — Sprint 3+
- `sb_config_providers`, `sb_config_webhooks` — Sprint 4+

### 1.2 Verbindungsdaten notieren

→ `https://supabase.xqtfive.de` → **Project Settings → API**

- **Supabase URL**: `https://supabase.xqtfive.de`
- **service_role key**: langer JWT unter „service_role" (nur Backend — geheim halten!)

---

## 2. Coolify-Konfiguration

### 2.1 Neues Projekt in Coolify

1. Coolify Dashboard → **Projects → New Project** → Name: `sprachbot`
2. **New Resource → Docker Compose**
3. Repository: `https://github.com/christian-rost/sprachbot`
4. Branch: `main`
5. Docker Compose File: `docker-compose.coolify.yml`

### 2.2 Umgebungsvariablen

Im Coolify-Dashboard → **Environment Variables**:

```bash
ENVIRONMENT=production
PORT=8000

# Supabase (self-hosted)
SUPABASE_URL=https://supabase.xqtfive.de
SUPABASE_KEY=<service_role key aus Supabase Settings → API>

# JWT — generieren: openssl rand -base64 32
JWT_SECRET=<min. 32 zufällige Zeichen>

# Admin-Erstbenutzer (nur beim ersten Start ausgewertet)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<sicheres startpasswort>

# CORS + Frontend-URL
CORS_ORIGINS=https://sprachbot.xqtfive.de
VITE_API_BASE=https://api.sprachbot.xqtfive.de

# Mistral AI (Sprint 2 — jetzt leer lassen)
MISTRAL_API_KEY=
MISTRAL_LLM_MODEL=mistral-large-latest
MISTRAL_STT_MODEL=
MISTRAL_TTS_MODEL=

# Verschlüsselung Provider-Keys — generieren: openssl rand -base64 32
PROVIDER_KEY_ENCRYPTION_KEY=
```

### 2.3 Domains konfigurieren

Im Coolify Dashboard → Service → **Domains**:

| Service | Domain | Port |
|---------|--------|------|
| backend | `api.sprachbot.xqtfive.de` | 8000 |
| frontend | `sprachbot.xqtfive.de` | 80 |

SSL-Zertifikate werden automatisch via Let's Encrypt ausgestellt.

### 2.4 DNS-Einträge

```
A  sprachbot.xqtfive.de      → <Coolify-Server-IP>
A  api.sprachbot.xqtfive.de  → <Coolify-Server-IP>
```

---

## 3. docker-compose.coolify.yml

```yaml
services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      - ENVIRONMENT=${ENVIRONMENT}
      - PORT=${PORT}
      - JWT_SECRET=${JWT_SECRET}
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_KEY=${SUPABASE_KEY}
      - MISTRAL_API_KEY=${MISTRAL_API_KEY}
      - MISTRAL_LLM_MODEL=${MISTRAL_LLM_MODEL}
      - MISTRAL_STT_MODEL=${MISTRAL_STT_MODEL}
      - MISTRAL_TTS_MODEL=${MISTRAL_TTS_MODEL}
      - CORS_ORIGINS=${CORS_ORIGINS}
      - PROVIDER_KEY_ENCRYPTION_KEY=${PROVIDER_KEY_ENCRYPTION_KEY}
      - ADMIN_USERNAME=${ADMIN_USERNAME}
      - ADMIN_EMAIL=${ADMIN_EMAIL}
      - ADMIN_PASSWORD=${ADMIN_PASSWORD}
    expose:
      - "${PORT}"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:${PORT}/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        - VITE_API_BASE=${VITE_API_BASE}
    expose:
      - "80"
    depends_on:
      backend:
        condition: service_healthy
    restart: unless-stopped
```

---

## 4. Dockerfiles

### backend/Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### frontend/Dockerfile

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_API_BASE
ENV VITE_API_BASE=${VITE_API_BASE}

COPY package*.json .
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Serve
FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### frontend/nginx.conf

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # React Router: alle Pfade auf index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Kein Caching für index.html
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # Statische Assets lange cachen
    location ~* \.(js|css|png|jpg|svg|ico|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## 5. Erster Start

### 5.1 Deployment in Coolify starten

1. Coolify → sprachbot → Deploy
2. Build-Logs beobachten (ca. 3-5 Minuten)
3. Status: ✓ Running

### 5.2 Gesundheitscheck

```bash
curl https://api.sprachbot.xqtfive.de/health
# → { "status": "ok", "database": "connected", "version": "0.1.0" }
```

### 5.3 Admin-Erstlogin

1. `https://sprachbot.xqtfive.de` aufrufen
2. Login mit `ADMIN_USERNAME` und `ADMIN_PASSWORD`
3. Im Admin-Panel: Benutzer verwalten, Audit-Log prüfen

### 5.4 Mistral Provider konfigurieren (Sprint 2+)

Mistral-API-Key wird erst in Sprint 2 benötigt. Nach dem Update:

Admin-Panel → Konfiguration → Provider:

1. **LLM**: Mistral API-Key + Modell auswählen → Testen
2. **STT**: Mistral Speech API-Key + Modell → Testen
3. **TTS**: Mistral TTS API-Key + Stimme → Testen

### 5.5 Ersten Flow erstellen

Admin-Panel → Flow-Verwaltung → Neuer Flow:

```json
{
  "display_name": "Test-Flow",
  "intent_name": "test",
  "slots": [
    {
      "name": "topic",
      "type": "string",
      "required": true,
      "prompt": "Womit kann ich Ihnen helfen?"
    }
  ],
  "actions": [
    {
      "type": "llm_response",
      "on_success": { "response": "Ich habe Ihre Anfrage zu '{{topic}}' notiert." }
    }
  ]
}
```

---

## 6. Updates einspielen

### Via Coolify (empfohlen)

1. Code in Git pushen
2. Coolify → sprachbot → Redeploy
3. Zero-Downtime durch `restart: unless-stopped`

### Datenbankmigrationen

Bei Schema-Änderungen:
1. Migration-SQL in `supabase/migrations/` ablegen
2. Vor Deployment manuell in Supabase SQL Editor ausführen
3. Dann Coolify-Deployment starten

---

## 7. Umgebungsvariablen-Referenz

| Variable | Pflicht | Beschreibung |
|----------|---------|-------------|
| `ENVIRONMENT` | Ja | `development` oder `production` |
| `PORT` | Ja | Backend-Port (Standard: 8000) |
| `JWT_SECRET` | Ja | Zufälliger String für JWT-Signierung (min. 32 Zeichen) |
| `SUPABASE_URL` | Ja | Supabase-Projekt-URL |
| `SUPABASE_KEY` | Ja | Supabase service_role Key |
| `MISTRAL_API_KEY` | Ja | Mistral AI API-Key |
| `MISTRAL_LLM_MODEL` | Ja | Mistral LLM-Modell (z.B. mistral-large-latest) |
| `MISTRAL_STT_MODEL` | Ja | Mistral STT-Modell |
| `MISTRAL_TTS_MODEL` | Ja | Mistral TTS-Modell |
| `CORS_ORIGINS` | Ja | Frontend-URL (kommagetrennt) |
| `PROVIDER_KEY_ENCRYPTION_KEY` | Ja | AES-256-Key für Provider-Key-Verschlüsselung |
| `ADMIN_USERNAME` | Nur Erststart | Initialer Admin-Benutzername |
| `ADMIN_EMAIL` | Nur Erststart | Initialer Admin-E-Mail |
| `ADMIN_PASSWORD` | Nur Erststart | Initiales Admin-Passwort |
| `VITE_API_BASE` | Ja (Build) | Backend-URL für Frontend-Build |

---

## 8. Troubleshooting

### Backend startet nicht

```bash
# Logs in Coolify anzeigen
# Häufige Ursachen:
# - Supabase-Verbindung fehlerhaft → SUPABASE_URL / SUPABASE_KEY prüfen
# - JWT_SECRET fehlt → Umgebungsvariable setzen
# - Port bereits belegt → PORT-Variable ändern
```

### CORS-Fehler im Browser

```
→ CORS_ORIGINS muss exakte Frontend-URL enthalten
→ https:// vs http:// beachten
→ Trailing Slash vermeiden
```

### Mistral API-Fehler

```
→ API-Key im Admin-Panel prüfen (Provider-Konfig → Test)
→ Modell-Bezeichnung prüfen (aktuelle Modell-IDs auf platform.mistral.ai)
→ Rate-Limits Mistral-Account prüfen
```

### Audio-Upload schlägt fehl

```
→ Browser-Mikrofon-Berechtigung prüfen
→ HTTPS erforderlich (Browser blockt Mikrofon bei HTTP)
→ Dateigröße-Limit (Standard: 10MB)
→ Format: WAV, WebM, OGG unterstützt
```

### WebSocket trennt sich

```
→ Coolify-Proxy: WebSocket-Unterstützung aktivieren
→ Nginx: proxy_read_timeout erhöhen
→ Timeout-Konfiguration im Backend prüfen
```
