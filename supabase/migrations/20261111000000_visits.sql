-- Saha ziyaretleri aramalardan ayrı kaydedilir: geçmişte "ziyaret" türü, sonucu call_result sütununda
-- (doktorla_gorusuldu, sekreterle_gorusuldu, kapali, ilgilenmiyor). Ziyaret arama sayılmaz: günlük arama
-- sayısına, ulaşılamama sayacına ve "daha önce arandı mı" kontrolüne girmez.

alter table public.activities drop constraint if exists activities_type_check;
alter table public.activities add constraint activities_type_check
  check (type in ('arama','asama','not','randevu','duzeltme','sistem','ziyaret'));

-- Ziyaret sonucu: işletmeyi güncelle, geçmişe yaz; tekrar arama tarihi verildiyse açık görevi onunla değiştir;
-- ziyaret bir randevuya bağlıysa randevuyu "yapıldı" yap. Hepsi tek işlemde.
create or replace function public.apply_visit_outcome(
  p_business_id uuid, p_patch jsonb, p_activities jsonb, p_next_task jsonb,
  p_appointment_id uuid default null, p_appointment_outcome text default null
) returns void
language plpgsql security invoker set search_path = public as $$
begin
  update businesses set
    call_status = coalesce(p_patch->>'callStatus', call_status),
    sales_stage = coalesce(p_patch->>'salesStage', sales_stage),
    failed_streak = coalesce((p_patch->>'failedStreak')::int, failed_streak),
    next_action_date = case when p_patch ? 'nextActionDate' then (p_patch->>'nextActionDate')::date else next_action_date end,
    next_action_time = case when p_patch ? 'nextActionTime' then p_patch->>'nextActionTime' else next_action_time end
  where id = p_business_id;
  if not found then raise exception 'İşletme bulunamadı.'; end if;

  insert into activities (business_id, type, call_result, stage, note)
  select p_business_id, a->>'type', a->>'visitResult', a->>'stage', a->>'note'
    from jsonb_array_elements(coalesce(p_activities, '[]'::jsonb)) a;

  if p_next_task is not null and p_next_task <> 'null'::jsonb then
    update call_tasks set status = 'tamamlandi', closed_at = now()
     where business_id = p_business_id and status = 'acik';
    insert into call_tasks (business_id, kind, reason, due_date, due_time)
    values (p_business_id, 'takip', p_next_task->>'reason', (p_next_task->>'dueDate')::date, p_next_task->>'dueTime');
  end if;

  if p_appointment_id is not null then
    update appointments set status = 'yapildi', outcome = coalesce(p_appointment_outcome, outcome)
     where id = p_appointment_id and business_id = p_business_id and status = 'planlandi';
  end if;
end $$;

revoke all on function public.apply_visit_outcome(uuid, jsonb, jsonb, jsonb, uuid, text) from public, anon;
grant execute on function public.apply_visit_outcome(uuid, jsonb, jsonb, jsonb, uuid, text) to authenticated, service_role;
