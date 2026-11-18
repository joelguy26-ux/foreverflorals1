alter table public.orders
  add column if not exists customer_notification_status text not null default 'not_sent'
    check (customer_notification_status in ('not_sent', 'pending', 'sent', 'failed'));
