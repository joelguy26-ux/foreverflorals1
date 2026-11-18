create table if not exists public.admin_settings (
  singleton boolean primary key default true check (singleton),
  payment_bank_name text not null default '',
  payment_account_name text not null default '',
  payment_account_number text not null default '',
  payment_bank_branch text not null default '',
  payment_instructions text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.admin_settings enable row level security;
revoke all on table public.admin_settings from anon, authenticated;
grant all on table public.admin_settings to service_role;

insert into public.admin_settings (singleton)
values (true)
on conflict (singleton) do nothing;

alter table public.orders
  add column if not exists internal_notes text not null default '';
