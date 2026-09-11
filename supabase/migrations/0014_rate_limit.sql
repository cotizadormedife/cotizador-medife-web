-- T-A4: sin rate limiting en ningún punto del sistema. Mientras no exista
-- el API Gateway corporativo con Cloud Armor (Pilar 5.5), se implementa un
-- límite mínimo propio, basado en la misma base de datos (sin infra nueva).
create table rate_limit_events (
  key text not null,
  created_at timestamptz not null default now()
);
create index rate_limit_events_key_idx on rate_limit_events (key, created_at);
alter table rate_limit_events enable row level security;
