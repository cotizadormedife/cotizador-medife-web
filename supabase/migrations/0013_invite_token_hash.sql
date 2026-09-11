-- T-A2: el token de invitación se guardaba en texto plano como clave
-- primaria de invite_tokens — un volcado de la tabla sería directamente
-- utilizable como credencial de acceso. Se guarda solo su hash; el valor en
-- claro únicamente vive en el link que recibe el usuario, nunca en la base
-- (pgcrypto ya está habilitado desde 0001_init.sql).
alter table invite_tokens add column token_hash text;
update invite_tokens set token_hash = encode(digest(token, 'sha256'), 'hex');
alter table invite_tokens alter column token_hash set not null;
alter table invite_tokens drop constraint invite_tokens_pkey;
alter table invite_tokens add constraint invite_tokens_pkey primary key (token_hash);
alter table invite_tokens drop column token;
