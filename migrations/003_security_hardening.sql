-- Migration 003: Security hardening
--
-- IMPORTANT: Before running this migration, set SUPABASE_SERVICE_ROLE_KEY in
-- Vercel project env vars. Once RLS is enabled, the anon key cannot
-- read/write these tables, so the serverless functions need the service role
-- key to operate. The application code already prefers SERVICE_ROLE over ANON
-- when both are set.
--
-- Run in Supabase SQL editor.

-- 1) Shared rate-limit table for non-chat endpoints (intake, ai-lead-save,
--    roaster, future demos). One row per request, GC'd after 24h.
create table if not exists api_rate_limits (
  id bigserial primary key,
  bucket text not null,
  ip_hash text not null,
  created_at timestamptz default now()
);
create index if not exists idx_api_rate_limits_bucket_ip_time
  on api_rate_limits(bucket, ip_hash, created_at desc);

create or replace function api_rate_limits_cleanup() returns void as $$
  delete from api_rate_limits where created_at < now() - interval '24 hours';
$$ language sql;

-- 2) Enable RLS on every PII-bearing or abuse-prone table.
--    With no policies declared, anon role gets zero access. Service role
--    bypasses RLS by design, so the serverless functions keep working.
alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;
alter table chat_rate_limits enable row level security;
alter table ai_leads enable row level security;
alter table api_rate_limits enable row level security;

-- demo_logs may not exist on every environment yet — guard the alter.
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'demo_logs') then
    execute 'alter table demo_logs enable row level security';
  end if;
end $$;

-- 3) Explicitly revoke anon access. RLS without policies already denies, but
--    revoking grants is belt-and-suspenders and surfaces intent.
revoke all on chat_sessions from anon;
revoke all on chat_messages from anon;
revoke all on chat_rate_limits from anon;
revoke all on ai_leads from anon;
revoke all on api_rate_limits from anon;
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'demo_logs') then
    execute 'revoke all on demo_logs from anon';
  end if;
end $$;
