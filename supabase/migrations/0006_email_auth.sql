-- Cambio de alcance: login con Google -> email + contraseña.
-- El formulario de registro pide todos los datos de una sola vez (email,
-- contraseña, nombre, apellido, celular, empresa), pasados como metadata al
-- crear el usuario en Supabase Auth. El trigger ya no necesita un estado
-- intermedio "pending_profile": el perfil nace directamente en
-- "pending_approval". El valor 'pending_profile' del enum queda sin uso
-- (no se elimina para no romper el tipo en caliente).

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, nombre, apellido, celular, empresa, status)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'nombre',
    new.raw_user_meta_data->>'apellido',
    new.raw_user_meta_data->>'celular',
    new.raw_user_meta_data->>'empresa',
    'pending_approval'
  );
  return new;
end; $$;
