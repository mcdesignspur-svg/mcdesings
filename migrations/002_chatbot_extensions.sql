-- Phase 2 extensions for the site chatbot.
-- Run after 001_site_chat.sql.

-- Rate limiting (per-IP sliding window).
create table if not exists chat_rate_limits (
  id bigserial primary key,
  ip_hash text not null,
  created_at timestamptz default now()
);
create index if not exists idx_chat_rate_limits_ip_time on chat_rate_limits(ip_hash, created_at desc);
alter table chat_rate_limits disable row level security;

-- Lead extensions.
alter table ai_leads add column if not exists discovery_call_requested boolean default false;
alter table ai_leads add column if not exists similar_cases_shown text[];

-- Cleanup helper (call manually or via cron — drops rate-limit rows older than 24h).
create or replace function chat_rate_limits_cleanup() returns void as $$
  delete from chat_rate_limits where created_at < now() - interval '24 hours';
$$ language sql;
