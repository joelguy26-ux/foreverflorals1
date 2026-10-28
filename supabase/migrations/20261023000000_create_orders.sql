create table if not exists public.orders (
  id uuid primary key,
  created_at timestamptz not null default now(),
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  date_needed date not null,
  occasion text,
  wrap_color text not null,
  delivery text not null,
  delivery_details text,
  bouquet_items jsonb not null,
  bouquet_subtotal_jmd integer not null check (bouquet_subtotal_jmd >= 0),
  toppers text[] not null default '{}',
  cash_amount text,
  cash_denominations text[] not null default '{}',
  special_instructions text,
  inspiration_path text,
  notification_status text not null default 'pending'
    check (notification_status in ('pending', 'sent', 'failed'))
);

alter table public.orders enable row level security;
revoke all on table public.orders from anon, authenticated;
grant all on table public.orders to service_role;

create table if not exists public.order_submission_limits (
  ip_hash text primary key,
  last_submission_at timestamptz not null
);

alter table public.order_submission_limits enable row level security;
revoke all on table public.order_submission_limits from anon, authenticated;
grant all on table public.order_submission_limits to service_role;

create or replace function public.claim_order_submission(p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  previous_submission timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_ip_hash, 0));
  select last_submission_at
    into previous_submission
    from public.order_submission_limits
    where ip_hash = p_ip_hash
    for update;

  if previous_submission is not null and previous_submission > now() - interval '1 minute' then
    return false;
  end if;

  insert into public.order_submission_limits (ip_hash, last_submission_at)
    values (p_ip_hash, now())
    on conflict (ip_hash) do update
      set last_submission_at = excluded.last_submission_at;

  delete from public.order_submission_limits
    where last_submission_at < now() - interval '7 days';

  return true;
end;
$$;

revoke all on function public.claim_order_submission(text) from public, anon, authenticated;
grant execute on function public.claim_order_submission(text) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('order-inspiration', 'order-inspiration', false, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
