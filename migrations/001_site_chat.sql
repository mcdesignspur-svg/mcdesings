-- Site chatbot tables for mcdesignspr.com bubble chat
-- Run manually in Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists chat_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  visitor_fingerprint text,
  ip_country text,
  referrer text,
  utm_source text,
  utm_campaign text,
  page text,
  status text default 'active',
  qualified_at timestamptz,
  lead_id uuid,
  total_messages int default 0,
  total_input_tokens int default 0,
  total_output_tokens int default 0,
  total_cache_read_tokens int default 0
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references chat_sessions(id) on delete cascade,
  role text not null,
  content jsonb not null,
  tool_name text,
  tokens_input int,
  tokens_output int,
  cache_read_tokens int,
  cache_creation_tokens int,
  created_at timestamptz default now()
);

create index if not exists idx_chat_messages_session on chat_messages(session_id, created_at);
create index if not exists idx_chat_sessions_status on chat_sessions(status, created_at desc);

-- RLS disabled: writes happen from the serverless function with anon key.
alter table chat_sessions disable row level security;
alter table chat_messages disable row level security;

-- Extend ai_leads (skip silently if columns already exist).
alter table ai_leads add column if not exists chat_session_id uuid references chat_sessions(id);
alter table ai_leads add column if not exists qualification_score int;
alter table ai_leads add column if not exists recommended_tier text;
alter table ai_leads add column if not exists urgency text;
alter table ai_leads add column if not exists source text;
