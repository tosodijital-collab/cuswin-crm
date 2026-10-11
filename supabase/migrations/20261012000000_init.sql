-- Cuswin satış CRM'i: ilk şema.
-- Erişim: yalnızca app_owner tablosundaki kullanıcı (RLS). Zamanlanmış işler secret key (service_role) ile çalışır.

create extension if not exists pgcrypto;

-- ---------- sahip ----------
create table public.app_owner (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_owner where user_id = auth.uid());
$$;

-- ---------- işletmeler ----------
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 300),
  categories text[] not null default '{}'
    check (categories <@ array['estetik','dis','sac_sagligi','sac_ekim']),
  phone text,
  email text,
  website text,
  district text,
  address text,
  maps_url text,
  source text not null check (source in ('google_maps','overture','manuel','demo')),
  source_id text,
  found_at timestamptz not null default now(),
  verified_at timestamptz,
  contacts jsonb not null default '[]'::jsonb,
  call_status text not null default 'aranacak' check (call_status in
    ('aranacak','ulasilamadi','tekrar_aranacak','gorusuldu','ilgilenmiyor','beklemede','iletisim_kurma')),
  sales_stage text not null default 'yeni_aday' check (sales_stage in
    ('yeni_aday','iletisim_kuruldu','randevu_alindi','gorusme_yapildi','teklif_gonderildi','musteri_oldu','olumsuz')),
  failed_streak int not null default 0 check (failed_streak >= 0),
  review_reason text,
  next_action_date date,
  next_action_time text check (next_action_time ~ '^\d{2}:\d{2}$'),
  user_edited boolean not null default false
);
create unique index businesses_source_uq on public.businesses (source, source_id) where source_id is not null;
create index businesses_status_idx on public.businesses (call_status, sales_stage);

-- ---------- arama görevleri ----------
create table public.call_tasks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind text not null check (kind in ('yeni','takip')),
  reason text not null check (reason in ('gunluk_liste','ulasilamadi','planlandi')),
  due_date date not null,
  due_time text check (due_time ~ '^\d{2}:\d{2}$'),
  status text not null default 'acik' check (status in ('acik','tamamlandi','iptal')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
-- İşletme başına tek açık görev
create unique index call_tasks_one_open_uq on public.call_tasks (business_id) where status = 'acik';
create index call_tasks_due_idx on public.call_tasks (status, due_date);

-- ---------- geçmiş ----------
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  at timestamptz not null default now(),
  type text not null check (type in ('arama','asama','not','randevu','duzeltme','sistem')),
  call_result text,
  stage text,
  note text check (length(note) <= 4000),
  voided_at timestamptz
);
create index activities_business_idx on public.activities (business_id, at desc);

-- ---------- randevular ----------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  starts_at timestamptz not null,
  contact_name text,
  meeting_type text not null check (meeting_type in ('telefon','cevrimici','yuz_yuze')),
  location text,
  note text,
  status text not null default 'planlandi' check (status in ('planlandi','yapildi','iptal')),
  reminder_minutes int not null default 30 check (reminder_minutes between 0 and 1440),
  outcome text,
  -- hatırlatma: işler tek sefer gönderim için önce "claim" eder
  reminder_claimed_at timestamptz,
  reminder_sent_at timestamptz,
  reminder_attempts int not null default 0,
  reminder_error text,
  -- Google Takvim: değişiklikte dirty=true, iş eşitleyince false
  calendar_dirty boolean not null default true,
  calendar_status text check (calendar_status in ('eklendi','kaldirildi','hata','kapali')),
  calendar_error text,
  calendar_synced_at timestamptz
);
create index appointments_starts_idx on public.appointments (status, starts_at);

-- Saat, hatırlatma süresi veya durum değişince hatırlatma ve takvim yeniden planlanır.
create or replace function public.appointments_reschedule() returns trigger
language plpgsql as $$
begin
  if new.starts_at is distinct from old.starts_at or new.reminder_minutes is distinct from old.reminder_minutes then
    new.reminder_claimed_at := null;
    new.reminder_sent_at := null;
    new.reminder_attempts := 0;
    new.reminder_error := null;
  end if;
  if new.starts_at is distinct from old.starts_at or new.status is distinct from old.status
     or new.contact_name is distinct from old.contact_name or new.meeting_type is distinct from old.meeting_type
     or new.location is distinct from old.location or new.note is distinct from old.note
     or new.reminder_minutes is distinct from old.reminder_minutes then
    new.calendar_dirty := true;
  end if;
  return new;
end $$;
create trigger appointments_reschedule before update on public.appointments
  for each row execute function public.appointments_reschedule();

-- ---------- günlük liste, ayarlar, tarama ----------
create table public.daily_runs (
  date date primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  target int not null,
  selected int not null default 0,
  shortfall_reason text,
  error text,
  trigger text not null check (trigger in ('zamanlanmis','manuel','telafi'))
);

create table public.settings (
  id int primary key default 1 check (id = 1),
  daily_target int not null default 20 check (daily_target between 1 and 100),
  categories text[] not null default array['estetik','dis','sac_sagligi','sac_ekim'],
  districts text[] not null default '{}',
  reminder_minutes int not null default 30 check (reminder_minutes between 0 and 1440),
  scan_limit int not null default 20 check (scan_limit between 1 and 200)
);
insert into public.settings (id) values (1);

create table public.scans (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('calisiyor','tamam','hata')),
  "limit" int not null,
  queries text[] not null default '{}',
  found int not null default 0,
  added int not null default 0,
  updated int not null default 0,
  flagged int not null default 0,
  skipped int not null default 0,
  over_limit int not null default 0,
  note text,
  error text
);

-- Arayüzden "şimdi tara" istekleri; zamanlanmış iş alır ve çalıştırır.
create table public.scan_requests (
  id uuid primary key default gen_random_uuid(),
  requested_at timestamptz not null default now(),
  status text not null default 'bekliyor' check (status in ('bekliyor','alindi','bitti'))
);
-- Aynı anda tek bekleyen istek
create unique index scan_requests_one_pending_uq on public.scan_requests ((true)) where status = 'bekliyor';

-- İşlerin durumu (tarama imleci, son çalışma, hangi entegrasyonların ayarlı olduğu)
create table public.job_state (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------- atomik işlemler (kurallar TypeScript'te hesaplanır, burada tek işlemde uygulanır) ----------

-- Arama sonucu: açık görevi kapat, işletmeyi güncelle, geçmişe yaz, gerekiyorsa yeni görev aç.
create or replace function public.apply_call_outcome(
  p_business_id uuid, p_patch jsonb, p_activities jsonb, p_next_task jsonb
) returns void
language plpgsql security invoker set search_path = public as $$
begin
  update call_tasks set status = 'tamamlandi', closed_at = now()
   where business_id = p_business_id and status = 'acik';

  update businesses set
    call_status = coalesce(p_patch->>'callStatus', call_status),
    sales_stage = coalesce(p_patch->>'salesStage', sales_stage),
    failed_streak = coalesce((p_patch->>'failedStreak')::int, failed_streak),
    next_action_date = (p_patch->>'nextActionDate')::date,
    next_action_time = p_patch->>'nextActionTime'
  where id = p_business_id;
  if not found then raise exception 'İşletme bulunamadı.'; end if;

  insert into activities (business_id, type, call_result, stage, note)
  select p_business_id, a->>'type', a->>'callResult', a->>'stage', a->>'note'
    from jsonb_array_elements(coalesce(p_activities, '[]'::jsonb)) a;

  if p_next_task is not null and p_next_task <> 'null'::jsonb then
    insert into call_tasks (business_id, kind, reason, due_date, due_time)
    values (p_business_id, 'takip', p_next_task->>'reason', (p_next_task->>'dueDate')::date, p_next_task->>'dueTime');
  end if;
end $$;

-- Günlük liste: gün başına tek kayıt. Var ve hedefin altındaysa yalnızca eksik kadar eklenir.
-- Açık görevi olan işletme atlanır (tekil indeks), böylece tekrar çalıştırma kopya üretmez.
create or replace function public.create_daily_list(
  p_date date, p_trigger text, p_target int, p_business_ids uuid[], p_shortfall text
) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  v_run daily_runs;
  v_created boolean := false;
  v_room int;
  v_added int := 0;
  v_id uuid;
begin
  insert into daily_runs (date, target, trigger) values (p_date, p_target, p_trigger)
  on conflict (date) do nothing;
  v_created := found;
  select * into v_run from daily_runs where date = p_date for update;
  v_room := greatest(v_run.target - v_run.selected, 0);

  foreach v_id in array coalesce(p_business_ids, '{}') loop
    exit when v_added >= v_room;
    begin
      insert into call_tasks (business_id, kind, reason, due_date) values (v_id, 'yeni', 'gunluk_liste', p_date);
      v_added := v_added + 1;
    exception when unique_violation then
      null; -- zaten açık görevi var
    end;
  end loop;

  update daily_runs set
    selected = selected + v_added,
    finished_at = now(),
    shortfall_reason = case when selected + v_added >= target then null else p_shortfall end
  where date = p_date
  returning * into v_run;

  return jsonb_build_object('created', v_created, 'added', v_added, 'run', to_jsonb(v_run));
end $$;

-- ---------- güvenlik ----------
do $$
declare t text;
begin
  foreach t in array array['businesses','call_tasks','activities','appointments','daily_runs','settings','scans','scan_requests','job_state'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy owner_all on public.%I for all to authenticated using (public.is_owner()) with check (public.is_owner())', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated, service_role', t);
  end loop;
end $$;

alter table public.app_owner enable row level security;
create policy owner_self on public.app_owner for select to authenticated using (user_id = auth.uid());
grant select on public.app_owner to authenticated;
grant select, insert, update, delete on public.app_owner to service_role;

revoke all on function public.apply_call_outcome(uuid, jsonb, jsonb, jsonb) from public, anon;
revoke all on function public.create_daily_list(date, text, int, uuid[], text) from public, anon;
revoke all on function public.is_owner() from public, anon;
grant execute on function public.apply_call_outcome(uuid, jsonb, jsonb, jsonb) to authenticated, service_role;
grant execute on function public.create_daily_list(date, text, int, uuid[], text) to authenticated, service_role;
grant execute on function public.is_owner() to authenticated, service_role;
