-- Sprachbot — Datenbankschema
-- Ausführen im Supabase SQL Editor (einmalig)
-- Prefix: sb_ (Sprachbot namespace)

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- Sprint 1: Benutzer & Audit
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists sb_users (
  id           uuid primary key default gen_random_uuid(),
  username     text not null unique,
  email        text not null unique,
  password_hash text not null,
  roles        text[] not null default array['USER']::text[],
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_sb_users_username on sb_users(username);

create table if not exists sb_audit_log (
  id             uuid primary key default gen_random_uuid(),
  event_type     text not null,
  actor_user_id  uuid references sb_users(id),
  entity_type    text,
  entity_id      uuid,
  details        jsonb not null default '{}'::jsonb,
  ip_address     text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_sb_audit_log_created on sb_audit_log(created_at desc);
create index if not exists idx_sb_audit_log_actor on sb_audit_log(actor_user_id);
create index if not exists idx_sb_audit_log_event_type on sb_audit_log(event_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- Sprint 2+: Sessions & Nachrichten
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists sb_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references sb_users(id),  -- NULL = anonym
  flow_id       uuid,                           -- FK hinzugefügt in Sprint 3
  status        text not null default 'active', -- active, completed, abandoned, error
  current_slots jsonb not null default '{}'::jsonb,
  context       jsonb not null default '{}'::jsonb,
  channel       text not null default 'browser', -- browser, telephone (Sprint 4+)
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  timeout_at    timestamptz
);

create index if not exists idx_sb_sessions_status on sb_sessions(status);
create index if not exists idx_sb_sessions_started on sb_sessions(started_at desc);

create table if not exists sb_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sb_sessions(id) on delete cascade,
  role        text not null,  -- user, assistant, system
  content     text not null,
  intent      text,
  slots       jsonb,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_sb_messages_session on sb_messages(session_id, created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- Sprint 3+: Flows
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists sb_flows (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  intent_name  text not null unique,
  definition   jsonb not null,
  system_prompt text,
  is_active    boolean not null default true,
  priority     integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references sb_users(id)
);

create index if not exists idx_sb_flows_intent on sb_flows(intent_name);
create index if not exists idx_sb_flows_active on sb_flows(is_active, priority desc);

create table if not exists sb_flow_versions (
  id          uuid primary key default gen_random_uuid(),
  flow_id     uuid not null references sb_flows(id) on delete cascade,
  version     integer not null,
  definition  jsonb not null,
  changed_by  uuid references sb_users(id),
  created_at  timestamptz not null default now()
);

-- FK für sb_sessions.flow_id (nachträgliche Ergänzung)
-- alter table sb_sessions add constraint fk_sessions_flow
--   foreign key (flow_id) references sb_flows(id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Sprint 4+: Provider-Konfiguration & Webhooks
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists sb_config_providers (
  id          uuid primary key default gen_random_uuid(),
  type        text not null,    -- stt, tts, llm
  provider    text not null,    -- mistral, openai, ...
  config      jsonb not null default '{}'::jsonb,
  api_key_enc text,             -- AES-256 verschlüsselter API-Key
  is_active   boolean not null default true,
  updated_at  timestamptz not null default now(),
  unique(type, provider)
);

create table if not exists sb_config_webhooks (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  url             text not null,
  method          text not null default 'POST',
  auth_type       text not null default 'none',  -- none, bearer, basic, api_key
  auth_enc        text,                           -- verschlüsselte Auth-Daten
  headers         jsonb not null default '{}'::jsonb,
  timeout_seconds integer not null default 15,
  retry_max       integer not null default 3,
  retry_backoff   integer not null default 2,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
