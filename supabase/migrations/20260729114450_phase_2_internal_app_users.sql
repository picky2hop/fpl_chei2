alter table public.app_users
  drop constraint app_users_id_fkey,
  alter column id set default gen_random_uuid();

;
