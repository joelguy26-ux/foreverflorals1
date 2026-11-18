alter table public.orders
  add column if not exists customer_note text not null default '';
