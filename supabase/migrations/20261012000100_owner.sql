-- Uygulamanın tek kullanıcısını sahip yapar. Kayıt kapalı olduğu için auth.users içinde yalnızca
-- Supabase panelinden elle eklenen kullanıcı bulunur. Kullanıcı eklendikten sonra çalıştırılmalıdır.
insert into public.app_owner (user_id)
select id from auth.users
on conflict do nothing;
