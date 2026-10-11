-- Zamanlama: GitHub Actions zamanlayıcısı güvenilir olmadığı için Supabase pg_cron her dakika "tick" fonksiyonunu çağırır.
-- Günün listesi seçimi de veritabanında yapılır (run_daily_list) — arayüz, tick ve GitHub işi aynı kuralı kullanır.

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Türkiye telefonu: 0090 / 90 / 0 önekleri atıldıktan sonra 10 hane
create or replace function public.phone_ok(p text) returns boolean
language sql immutable set search_path = public as $$
  select case when p is null then false else (
    with d as (select regexp_replace(p, '\D', '', 'g') as v)
    select length(case
      when v like '0090%' then substr(v, 5)
      when v like '90%' and length(v) = 12 then substr(v, 3)
      when v like '0%' and length(v) = 11 then substr(v, 2)
      else v end) = 10
    from d) end;
$$;

-- Günün listesi (Europe/Istanbul günü). Kural src/lib/domain/rules.ts selectDailyCandidates ile aynıdır:
-- aranacak + yeni aday + kontrol notu yok + geçerli telefon + tercih edilen kategori/ilçe +
-- açık görevi yok + daha önce hiç listeye girmemiş + hiç aranmamış; en eski bulunan önce.
create or replace function public.run_daily_list(p_trigger text) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  v_date date := (now() at time zone 'Europe/Istanbul')::date;
  s settings;
  v_existing daily_runs;
  v_need int;
  v_ids uuid[];
  v_review int;
  v_shortfall text;
begin
  select * into s from settings where id = 1;
  select * into v_existing from daily_runs where date = v_date;
  v_need := case when v_existing.date is null then s.daily_target else greatest(v_existing.target - v_existing.selected, 0) end;

  select coalesce(array_agg(c.id), '{}') into v_ids from (
    select b.id from businesses b
    where b.call_status = 'aranacak' and b.sales_stage = 'yeni_aday' and b.review_reason is null
      and phone_ok(b.phone) and cardinality(b.categories) > 0
      and b.categories && s.categories
      and (cardinality(s.districts) = 0 or b.district = any (s.districts))
      and not exists (select 1 from call_tasks t where t.business_id = b.id and (t.status = 'acik' or t.kind = 'yeni'))
      and not exists (select 1 from activities a where a.business_id = b.id and a.type = 'arama')
    order by b.found_at, b.id
    limit v_need
  ) c;

  if cardinality(v_ids) < v_need then
    select count(*) into v_review from businesses where call_status = 'aranacak' and review_reason is not null;
    v_shortfall := format('Uygun yeni aday sayısı %s, hedef %s. Tercih edilen kategori ve ilçelerde aranmamış, telefonu olan başka işletme yok.',
                          cardinality(v_ids) + coalesce(v_existing.selected, 0), s.daily_target)
      || case when v_review > 0 then format(' %s kayıt eksik bilgi nedeniyle kontrol bekliyor.', v_review) else '' end;
  end if;

  return create_daily_list(v_date, p_trigger, s.daily_target, v_ids, v_shortfall);
end $$;

revoke all on function public.phone_ok(text) from public, anon;
revoke all on function public.run_daily_list(text) from public, anon;
grant execute on function public.phone_ok(text) to authenticated, service_role;
grant execute on function public.run_daily_list(text) to authenticated, service_role;

-- pg_cron → tick yetkisi: rastgele belirteç Vault'ta tutulur, kimse görmeden üretilir.
select vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'cron_token', 'pg_cron -> tick Edge Function yetkisi')
where not exists (select 1 from vault.secrets where name = 'cron_token');

create or replace function public.check_cron_token(p text) returns boolean
language sql stable security definer set search_path = public, vault as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'cron_token' and decrypted_secret = p);
$$;
revoke all on function public.check_cron_token(text) from public, anon, authenticated;
grant execute on function public.check_cron_token(text) to service_role;

-- Her dakika tick
select cron.unschedule('cuswin-tick') where exists (select 1 from cron.job where jobname = 'cuswin-tick');
select cron.schedule('cuswin-tick', '* * * * *', $cron$
  select net.http_post(
    url := 'https://zemljzbrpburfzkodjrp.supabase.co/functions/v1/tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_RVpjBPIP59hCTBPRQ_I1Lw_n5_n4raQ',
      'x-cron-token', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
$cron$);
