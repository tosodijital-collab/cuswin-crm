-- Ara verme: belirtilen günlerde (ya da süresiz) sabah taraması ve günün listesi otomatik oluşturulmaz.
-- Randevu hatırlatmaları ve takvim eşitlemesi etkilenmez. Elle "listeyi hazırla" / "şimdi tara" çalışmaya devam eder.
alter table public.settings
  add column if not exists paused_from date,
  add column if not exists paused_until date,
  add column if not exists pause_forever boolean not null default false;

alter table public.settings drop constraint if exists settings_pause_range;
alter table public.settings add constraint settings_pause_range
  check (paused_from is null or paused_until is null or paused_from <= paused_until);

create or replace function public.is_paused(d date) returns boolean
language sql stable set search_path = public as $$
  select coalesce((select pause_forever
                     or (paused_from is not null and paused_until is not null and d between paused_from and paused_until)
                   from settings where id = 1), false);
$$;
revoke all on function public.is_paused(date) from public, anon;
grant execute on function public.is_paused(date) to authenticated, service_role;
