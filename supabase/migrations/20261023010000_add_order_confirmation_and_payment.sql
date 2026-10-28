alter table public.orders
  add column if not exists order_status text not null default 'inquiry'
    check (order_status in ('inquiry', 'confirmed', 'paid', 'cancelled')),
  add column if not exists topper_subtotal_jmd integer not null default 0
    check (topper_subtotal_jmd >= 0),
  add column if not exists estimated_total_jmd integer not null default 0
    check (estimated_total_jmd >= 0),
  add column if not exists confirmed_total_jmd integer
    check (confirmed_total_jmd is null or confirmed_total_jmd > 0),
  add column if not exists confirmed_at timestamptz,
  add column if not exists invoice_sent_at timestamptz,
  add column if not exists paid_at timestamptz;

update public.orders
set topper_subtotal_jmd =
  (case when 'Glitter ($300)' = any(toppers) then 300 else 0 end) +
  (case when 'Butterfly ($100 ea)' = any(toppers) then 100 else 0 end) +
  (case when 'Bow ($100 ea)' = any(toppers) then 100 else 0 end) +
  (case when 'Banner ($100 ea)' = any(toppers) then 100 else 0 end) +
  (case when 'Crown ($500)' = any(toppers) then 500 else 0 end) +
  (case when 'Tiara ($1,000)' = any(toppers) then 1000 else 0 end) +
  (case when 'Baby''s breath ($800)' = any(toppers) then 800 else 0 end) +
  (case when 'Pearl Bows ($300 per)' = any(toppers) then 300 else 0 end) +
  (case when 'Mesh wrapping ($800)' = any(toppers) then 800 else 0 end) +
  (case when 'Pins ($200)' = any(toppers) then 200 else 0 end);

update public.orders
set estimated_total_jmd = bouquet_subtotal_jmd + topper_subtotal_jmd;

create index if not exists orders_created_at_desc_idx on public.orders (created_at desc);
create index if not exists orders_status_created_at_idx on public.orders (order_status, created_at desc);
