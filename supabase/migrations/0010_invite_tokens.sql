-- RF-21/RF-56/RF-57: link de primer ingreso propio (no el token_hash de
-- Supabase, que tiene vencimiento fijo por configuración de Auth). Un token
-- de esta tabla nunca vence por sí mismo — solo deja de ser válido cuando
-- se usa (used_at) o cuando se genera uno nuevo para el mismo usuario.
create table invite_tokens (
  token text primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  used_at timestamptz
);
create index invite_tokens_user_idx on invite_tokens (user_id, used_at);

alter table invite_tokens enable row level security;
-- Sin políticas para anon/authenticated: solo el service_role (server-only)
-- puede leer o escribir esta tabla.
