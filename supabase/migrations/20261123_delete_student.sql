-- =====================================================================
-- Work Immersion PWA — Pagbura ng estudyante (para sa mga duplicate/maling account)
-- ---------------------------------------------------------------------
-- PAANO GAMITIN:
--   1. Supabase Dashboard → SQL Editor → New query
--   2. I-paste ang buong file na ito at i-Run (isang beses lang).
--   3. I-deploy ang bagong app code (git push → Vercel).
--
-- Ligtas itong i-run ulit. Naka-transaction: kapag may error, walang mababago.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. delete_student(p_lrn)
--    Binubura ang estudyante at LAHAT ng record niya:
--    diary scores, diary, attendance, requirements, scores,
--    password reset requests, sync log, students row, at login account.
--    Approved teacher o Admin lang ang puwedeng gumamit.
--    (Ang mga file sa Storage ay binubura ng app bago tawagin ito.)
-- ---------------------------------------------------------------------
create or replace function public.delete_student(p_lrn text)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_teacher() then
    raise exception 'Teachers lang ang puwedeng magbura ng estudyante.';
  end if;
  if p_lrn is null or not exists (select 1 from public.students where lrn = p_lrn) then
    raise exception 'Walang estudyanteng may LRN na %.', coalesce(p_lrn, '(blank)');
  end if;

  delete from public.diary_scores
   where diary_id in (select id from public.diary where lrn = p_lrn);
  delete from public.diary                   where lrn = p_lrn;
  delete from public.attendance              where lrn = p_lrn;
  delete from public.requirements            where lrn = p_lrn;
  delete from public.scores                  where lrn = p_lrn;
  delete from public.password_reset_requests where lrn = p_lrn;
  delete from public.sync_log                where lrn = p_lrn;
  delete from public.students                where lrn = p_lrn;

  -- Login account (para magamit ulit ang LRN kung kailangan)
  delete from auth.users where email = p_lrn || '@student.local';
end $$;

revoke execute on function public.delete_student(text) from public, anon;
grant  execute on function public.delete_student(text) to authenticated;


-- ---------------------------------------------------------------------
-- 2. STORAGE: puwedeng magbura ng file ang teacher
--    (photos, diary images, requirements ng estudyanteng binubura)
-- ---------------------------------------------------------------------
drop policy if exists wi_files_delete_teacher on storage.objects;
create policy wi_files_delete_teacher on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('attendance_photos', 'diary_images', 'requirements_files')
    and public.is_teacher()
  );

commit;


-- =====================================================================
-- PANGHANAP NG DUPLICATE (opsyonal; i-run nang hiwalay)
-- Mga estudyanteng pareho ang pangalan pero magkaiba ang LRN:
-- =====================================================================
-- select lower(trim(last_name)) as last_name, lower(trim(first_name)) as first_name,
--        count(*) as bilang, string_agg(lrn || ' (' || status || ')', ', ') as mga_lrn
-- from public.students
-- group by 1, 2
-- having count(*) > 1
-- order by 1, 2;
