-- ============================================================
-- mapollo — Supabase schema
-- Run this ONCE in Supabase Dashboard -> SQL Editor -> New query -> Run
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,

  first_name           text,
  last_name            text,
  title                text,
  email                text,
  person_linkedin_url  text,
  contact_location     text,
  company              text,
  company_linkedin_url text,
  employees            text,
  industry             text,
  company_address      text,
  company_street       text,
  company_city         text,
  company_state        text,
  company_country      text,
  company_phone        text,
  website              text,
  open_jobs            text,
  contact_date         date,
  date_raw             text,
  list_name            text,

  custom_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists contacts_owner_created_idx on public.contacts(owner_id, created_at desc, id desc);
create index if not exists contacts_title_idx     on public.contacts(owner_id, title);
create index if not exists contacts_location_idx  on public.contacts(owner_id, contact_location);
create index if not exists contacts_country_idx   on public.contacts(owner_id, company_country);
create index if not exists contacts_industry_idx  on public.contacts(owner_id, industry);
create index if not exists contacts_list_idx      on public.contacts(owner_id, list_name);
create index if not exists contacts_date_idx      on public.contacts(owner_id, contact_date);

alter table public.contacts enable row level security;

grant select, insert, update, delete on public.contacts to authenticated;

drop policy if exists "owner read"   on public.contacts;
drop policy if exists "owner insert" on public.contacts;
drop policy if exists "owner update" on public.contacts;
drop policy if exists "owner delete" on public.contacts;

create policy "owner read"   on public.contacts for select to authenticated using (owner_id = (select auth.uid()));
create policy "owner insert" on public.contacts for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "owner update" on public.contacts for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "owner delete" on public.contacts for delete to authenticated using (owner_id = (select auth.uid()));
