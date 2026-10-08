-- 002 production hardening. Apply after 001. Do not load real customers until env and RLS are verified.

create table if not exists email_outbox (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  campaign_id uuid not null references recovery_campaigns(id) on delete cascade,
  waitlist_id uuid not null references waitlist_entries(id) on delete cascade,
  idempotency_key text not null unique,
  status text not null check (status in ('queued', 'sent', 'failed')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);

create table if not exists unsubscribe_tokens (
  token text primary key,
  business_id uuid not null references businesses(id) on delete cascade,
  waitlist_id uuid not null references waitlist_entries(id) on delete cascade,
  used_at timestamptz
);

alter table email_outbox enable row level security;
alter table unsubscribe_tokens enable row level security;
create policy member_read_outbox on email_outbox for select using (is_member(business_id));
create policy owner_write_outbox on email_outbox for insert with check (is_owner(business_id));

create or replace function service_belongs(bid uuid, sid uuid)
returns boolean language sql stable as $$
  select exists (select 1 from services where id = sid and business_id = bid);
$$;

create or replace function create_business(p_name text, p_city text)
returns uuid language plpgsql security definer set search_path = public as $$
declare bid uuid;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  insert into businesses (name, city) values (p_name, p_city) returning id into bid;
  insert into memberships (business_id, user_id, role) values (bid, auth.uid(), 'owner');
  insert into subscriptions (business_id, plan, status) values (bid, 'free', 'active');
  insert into audit_events (business_id, action, detail) values (bid, 'onboard', 'Owner created business');
  return bid;
end;
$$;
grant execute on function create_business(text, text) to authenticated;

create or replace function free_quota_ok(bid uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare plan text; invites int; lists int;
begin
  select s.plan into plan from subscriptions s where s.business_id = bid;
  if plan = 'pro' then return true; end if;
  select count(*) into lists from waitlist_entries where business_id = bid and active;
  select count(*) into invites from notification_deliveries
    where business_id = bid and created_at > now() - interval '30 days';
  return lists < 3 and invites < 50;
end;
$$;
