-- RF-59: profiles.email es una copia del email de auth.users (se setea una
-- sola vez al alta, en handle_new_user). Este trigger la mantiene sincronizada
-- cada vez que auth.users.email cambia (incluido el cambio de email propio
-- que RF-59 habilita), para que los listados que leen profiles.email
-- (Usuarios, Todas las cotizaciones, Mi cuenta) nunca queden desactualizados.
create function public.handle_user_email_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email, updated_at = now() where id = new.id;
  end if;
  return new;
end; $$;

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();
