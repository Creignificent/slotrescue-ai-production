-- SlotRescue AI foundation. Reviewed migration only. Not production-ready.
-- Apply in a Supabase project you control. Enable Auth email verification separately.
-- Do not load real customer data until the README blockers are closed.

create extension if not exists pgcrypto;

create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  automation_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'staff')),
  unique (business_id, user_id)
);

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  duration_min int not null check (duration_min > 0),
  price_cents int not null check (price_cents >= 0)
);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  service_id uuid not null references services(id),
  staff_name text not null,
  customer_name text,
  starts_at timestamptz not null,
  status text not null check (status in ('scheduled', 'canceled', 'open', 'recovered', 'completed')),
  price_cents int not null check (price_cents >= 0)
);

create table if not exists waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  email text not null,
  service_interest text not null,
  time_window text not null,
  priority int not null default 0,
  active boolean not null default true
);

create table if not exists consent_records (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  waitlist_id uuid not null references waitlist_entries(id) on delete cascade,
  channel text not null default 'email',
  opted_in_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);

create table if not exists recovery_campaigns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  appointment_id uuid not null references appointments(id),
  status text not null check (status in ('draft', 'approved', 'sent', 'filled', 'closed')),
  offer_body text not null,
  claim_token text not null unique default encode(gen_random_bytes(18), 'hex'),
  approved_at timestamptz
);

create table if not exists booking_reservations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  campaign_id uuid not null references recovery_campaigns(id),
  waitlist_id uuid not null references waitlist_entries(id),
  status text not null check (status in ('confirmed', 'rejected')),
  created_at timestamptz not null default now()
);

create unique index if not exists one_confirmed_per_campaign
  on booking_reservations (campaign_id)
  where status = 'confirmed';

create table if not exists notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  campaign_id uuid not null references recovery_campaigns(id),
  waitlist_id uuid not null references waitlist_entries(id),
  channel text not null default 'email',
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  plan text not null check (plan in ('free', 'pro')),
  stripe_customer_id text,
  stripe_subscription_id text,
  status text,
  unique (business_id)
);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  action text not null,
  detail text not null,
  created_at timestamptz not null default now()
);

alter table businesses enable row level security;
alter table memberships enable row level security;
alter table services enable row level security;
alter table appointments enable row level security;
alter table waitlist_entries enable row level security;
alter table consent_records enable row level security;
alter table recovery_campaigns enable row level security;
alter table booking_reservations enable row level security;
alter table notification_deliveries enable row level security;
alter table subscriptions enable row level security;
alter table audit_events enable row level security;

create or replace function is_member(bid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.business_id = bid and m.user_id = auth.uid()
  );
$$;

create or replace function is_owner(bid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.business_id = bid and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

-- Membership-scoped read. Writes are owner-or-staff except campaigns approve path, which the API also checks.
create policy member_read_businesses on businesses for select using (is_member(id));
create policy member_read_memberships on memberships for select using (is_member(business_id));
create policy member_read_services on services for select using (is_member(business_id));
create policy member_write_services on services for insert with check (is_member(business_id));
create policy member_read_appointments on appointments for select using (is_member(business_id));
create policy member_write_appointments on appointments for insert with check (is_member(business_id));
create policy member_update_appointments on appointments for update using (is_member(business_id));
create policy member_read_waitlist on waitlist_entries for select using (is_member(business_id));
create policy member_write_waitlist on waitlist_entries for insert with check (is_member(business_id));
create policy member_read_consent on consent_records for select using (is_member(business_id));
create policy member_write_consent on consent_records for insert with check (is_member(business_id));
create policy member_read_campaigns on recovery_campaigns for select using (is_member(business_id));
create policy member_write_campaigns on recovery_campaigns for insert with check (is_member(business_id));
create policy owner_update_campaigns on recovery_campaigns for update using (is_owner(business_id));
create policy member_read_reservations on booking_reservations for select using (is_member(business_id));
create policy member_read_deliveries on notification_deliveries for select using (is_member(business_id));
create policy member_write_deliveries on notification_deliveries for insert with check (is_member(business_id));
create policy member_read_subs on subscriptions for select using (is_member(business_id));
create policy member_read_audit on audit_events for select using (is_member(business_id));
create policy member_write_audit on audit_events for insert with check (is_member(business_id));

-- First valid claim wins. Caller must already be authorized by the API.
-- Blocker: the public route uses the service role. Add rate limits before exposing this.
create or replace function claim_booking(p_token text, p_waitlist_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  camp recovery_campaigns%rowtype;
  appt appointments%rowtype;
  person waitlist_entries%rowtype;
begin
  select * into camp from recovery_campaigns where claim_token = p_token for update;
  if not found or camp.status not in ('sent', 'approved') then
    return jsonb_build_object('ok', false, 'reason', 'Offer is not open.');
  end if;

  select * into appt from appointments where id = camp.appointment_id for update;
  if appt.status <> 'open' or exists (
    select 1 from booking_reservations
    where campaign_id = camp.id and status = 'confirmed'
  ) then
    insert into booking_reservations (business_id, campaign_id, waitlist_id, status)
    values (camp.business_id, camp.id, p_waitlist_id, 'rejected');
    return jsonb_build_object('ok', false, 'reason', 'This opening was just taken.');
  end if;

  select * into person from waitlist_entries where id = p_waitlist_id and business_id = camp.business_id;
  if not found or person.active is not true then
    return jsonb_build_object('ok', false, 'reason', 'Customer is not on this waitlist.');
  end if;
  if not exists (
    select 1 from consent_records
    where waitlist_id = person.id and unsubscribed_at is null
  ) then
    return jsonb_build_object('ok', false, 'reason', 'No active email consent.');
  end if;

  insert into booking_reservations (business_id, campaign_id, waitlist_id, status)
  values (camp.business_id, camp.id, person.id, 'confirmed');

  update appointments
    set status = 'recovered', customer_name = person.name
    where id = appt.id;
  update recovery_campaigns set status = 'filled' where id = camp.id;
  insert into audit_events (business_id, action, detail)
  values (camp.business_id, 'confirm', person.name || ' confirmed ' || appt.starts_at::text);

  return jsonb_build_object('ok', true, 'appointment_id', appt.id, 'customer', person.name);
end;
$$;

revoke all on function claim_booking(text, uuid) from public;
grant execute on function claim_booking(text, uuid) to service_role;
