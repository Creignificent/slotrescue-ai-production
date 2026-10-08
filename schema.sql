-- SlotRescue AI — Supabase Postgres shape
-- Every query must filter by business_id. Enable RLS before any real customer data.

create extension if not exists pgcrypto;

create table businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  automation_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('owner','staff')),
  unique (business_id, user_id)
);

create table services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  duration_min int not null,
  price_cents int not null
);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  service_id uuid not null references services(id),
  staff_name text not null,
  customer_name text,
  starts_at timestamptz not null,
  status text not null check (status in ('scheduled','canceled','open','recovered','completed')),
  price_cents int not null
);

create table waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  email text not null,
  service_interest text not null,
  time_window text not null,
  priority int not null default 0,
  active boolean not null default true
);

create table consent_records (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  waitlist_id uuid not null references waitlist_entries(id) on delete cascade,
  channel text not null default 'email',
  opted_in_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);

create table recovery_campaigns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  appointment_id uuid not null references appointments(id),
  status text not null check (status in ('draft','approved','sent','filled','closed')),
  offer_body text not null,
  approved_at timestamptz
);

create table booking_reservations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  campaign_id uuid not null references recovery_campaigns(id),
  waitlist_id uuid not null references waitlist_entries(id),
  status text not null check (status in ('confirmed','rejected')),
  created_at timestamptz not null default now()
);

create unique index one_confirmed_per_campaign
  on booking_reservations (campaign_id)
  where status = 'confirmed';

create table notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  campaign_id uuid not null references recovery_campaigns(id),
  waitlist_id uuid not null references waitlist_entries(id),
  channel text not null default 'email',
  status text not null,
  created_at timestamptz not null default now()
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  plan text not null check (plan in ('free','pro')),
  stripe_customer_id text,
  stripe_subscription_id text,
  status text
);

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  action text not null,
  detail text not null,
  created_at timestamptz not null default now()
);
