-- =====================================================================
-- Work Immersion PWA — Security & data-integrity fixes
-- ---------------------------------------------------------------------
-- PAANO GAMITIN:
--   1. Supabase Dashboard → SQL Editor → New query
--   2. I-paste ang buong file na ito at i-Run (isang beses lang).
--   3. I-deploy agad ang bagong app code (git push → Vercel).
--      Magkasama dapat ang SQL at code: ang lumang app ay hindi na
--      makakapag-register / makakapag-time-in pagkatapos nito.
--
-- Ligtas itong i-run ulit: lahat ay "create or replace" / "if exists".
-- Kapag may error, walang mababago (naka-transaction ang buong file).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. HELPER FUNCTIONS
-- ---------------------------------------------------------------------

-- Approved teacher (Teacher o Admin)
create or replace function public.is_teacher()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.teachers
    where email = auth.jwt() ->> 'email' and status = 'Approved'
  );
$$;

-- Approved Admin
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.teachers
    where email = auth.jwt() ->> 'email' and status = 'Approved' and role = 'Admin'
  );
$$;

-- LRN ng naka-login na estudyante (null kung hindi estudyante)
create or replace function public.current_lrn()
returns text
language sql stable
as $$
  select case
    when auth.jwt() ->> 'email' like '%@student.local'
    then split_part(auth.jwt() ->> 'email', '@', 1)
  end;
$$;


-- ---------------------------------------------------------------------
-- 1. UNIQUE CONSTRAINTS (kailangan ng upsert / on conflict)
--    Ginagawa lang kung wala pa.
-- ---------------------------------------------------------------------
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('students',      'lrn',                    'students_lrn_uniq'),
      ('teachers',      'email',                  'teachers_email_uniq'),
      ('attendance',    'lrn, date',              'attendance_lrn_date_uniq'),
      ('diary',         'lrn, day_number',        'diary_lrn_day_uniq'),
      ('requirements',  'lrn, requirement_name',  'requirements_lrn_name_uniq'),
      ('scores',        'lrn, day_number',        'scores_lrn_day_uniq'),
      ('diary_scores',  'diary_id, criteria',     'diary_scores_diary_criteria_uniq'),
      ('sync_log',      'client_action_id',       'sync_log_client_action_uniq')
    ) as v(tbl, cols, idx)
  loop
    if not exists (
      select 1 from pg_indexes
      where schemaname = 'public'
        and tablename = t.tbl
        and indexdef ilike 'create unique index%(' || t.cols || ')%'
    ) then
      execute format('create unique index %I on public.%I (%s)', t.idx, t.tbl, t.cols);
    end if;
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- 2. ENABLE RLS SA LAHAT NG TABLE
-- ---------------------------------------------------------------------
alter table public.students                enable row level security;
alter table public.teachers                enable row level security;
alter table public.attendance              enable row level security;
alter table public.diary                   enable row level security;
alter table public.diary_scores            enable row level security;
alter table public.scores                  enable row level security;
alter table public.requirements            enable row level security;
alter table public.announcements           enable row level security;
alter table public.password_reset_requests enable row level security;
alter table public.sync_log                enable row level security;


-- ---------------------------------------------------------------------
-- 3. BURAHIN ANG LAHAT NG LUMANG POLICY
--    (marami ang sobrang luwag o nag-o-overlap)
-- ---------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('students','teachers','attendance','diary','diary_scores',
                        'scores','requirements','announcements',
                        'password_reset_requests','sync_log')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;

  for r in
    select policyname
    from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') || coalesce(with_check, ''))
          ~ '(attendance_photos|diary_images|requirements_files)'
  loop
    execute format('drop policy %I on storage.objects', r.policyname);
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- 4. BAGONG POLICIES
-- ---------------------------------------------------------------------

-- STUDENTS ----------------------------------------------------------
-- Walang INSERT policy: ang trigger sa auth.users (section 5) ang gumagawa ng row.
create policy students_select on public.students
  for select to authenticated
  using (lrn = public.current_lrn() or public.is_teacher());

create policy students_update_self on public.students
  for update to authenticated
  using (lrn = public.current_lrn())
  with check (lrn = public.current_lrn());

create policy students_update_teacher on public.students
  for update to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

-- Hindi puwedeng baguhin ng estudyante ang sarili niyang status/LRN
create or replace function public.guard_student_update()
returns trigger
language plpgsql
as $$
begin
  -- SQL editor, service role, security-definer functions, at teachers: walang limit
  if current_user not in ('authenticated', 'anon') or public.is_teacher() then
    return new;
  end if;
  new.lrn    := old.lrn;
  new.status := old.status;
  -- puwede lang gawing false (pagkatapos magpalit ng password), hindi true
  if new.is_first_login is true and old.is_first_login is not true then
    new.is_first_login := old.is_first_login;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_student_update on public.students;
create trigger trg_guard_student_update
  before update on public.students
  for each row execute function public.guard_student_update();


-- TEACHERS ----------------------------------------------------------
-- Walang INSERT policy: trigger sa auth.users ang gumagawa (laging Pending/Teacher).
create policy teachers_select on public.teachers
  for select to authenticated
  using (email = auth.jwt() ->> 'email' or public.is_admin());

create policy teachers_update_admin on public.teachers
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ATTENDANCE --------------------------------------------------------
-- Ang estudyante ay nagta-time-in sa pamamagitan lang ng record_attendance() (section 6).
create policy attendance_select on public.attendance
  for select to authenticated
  using (lrn = public.current_lrn() or public.is_teacher());

create policy attendance_update_teacher on public.attendance
  for update to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

create policy attendance_delete_teacher on public.attendance
  for delete to authenticated
  using (public.is_teacher());


-- DIARY -------------------------------------------------------------
create policy diary_select on public.diary
  for select to authenticated
  using (lrn = public.current_lrn() or public.is_teacher());

create policy diary_insert_self on public.diary
  for insert to authenticated
  with check (lrn = public.current_lrn());

create policy diary_update_self_unlocked on public.diary
  for update to authenticated
  using (lrn = public.current_lrn() and coalesce(is_locked, false) = false)
  with check (lrn = public.current_lrn());

create policy diary_update_teacher on public.diary
  for update to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

-- Hindi kayang galawin ng estudyante ang grade, feedback, at lock
create or replace function public.guard_diary_write()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_teacher() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.rubric_score     := null;
    new.teacher_feedback := null;
    new.is_locked        := false;
  else
    new.lrn              := old.lrn;
    new.rubric_score     := old.rubric_score;
    new.teacher_feedback := old.teacher_feedback;
    new.is_locked        := old.is_locked;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_guard_diary_write on public.diary;
create trigger trg_guard_diary_write
  before insert or update on public.diary
  for each row execute function public.guard_diary_write();


-- DIARY_SCORES ------------------------------------------------------
create policy diary_scores_teacher_all on public.diary_scores
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

create policy diary_scores_student_select on public.diary_scores
  for select to authenticated
  using (exists (
    select 1 from public.diary d
    where d.id = diary_scores.diary_id and d.lrn = public.current_lrn()
  ));


-- SCORES ------------------------------------------------------------
create policy scores_teacher_all on public.scores
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

create policy scores_student_select on public.scores
  for select to authenticated
  using (lrn = public.current_lrn());


-- REQUIREMENTS ------------------------------------------------------
create policy requirements_select on public.requirements
  for select to authenticated
  using (lrn = public.current_lrn() or public.is_teacher());

create policy requirements_insert_self on public.requirements
  for insert to authenticated
  with check (lrn = public.current_lrn());

create policy requirements_update_self on public.requirements
  for update to authenticated
  using (lrn = public.current_lrn())
  with check (lrn = public.current_lrn());

create policy requirements_update_teacher on public.requirements
  for update to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());


-- ANNOUNCEMENTS -----------------------------------------------------
create policy announcements_select on public.announcements
  for select to authenticated
  using (true);

create policy announcements_insert_teacher on public.announcements
  for insert to authenticated
  with check (public.is_teacher() and author_email = auth.jwt() ->> 'email');

create policy announcements_delete_teacher on public.announcements
  for delete to authenticated
  using (public.is_teacher() and (author_email = auth.jwt() ->> 'email' or public.is_admin()));


-- PASSWORD RESET REQUESTS ------------------------------------------
-- Walang public insert/select: request_password_reset() (section 6) ang gamit.
create policy reset_requests_teacher_all on public.password_reset_requests
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());


-- SYNC LOG ----------------------------------------------------------
create policy sync_log_teacher_select on public.sync_log
  for select to authenticated
  using (public.is_teacher());


-- ---------------------------------------------------------------------
-- 5. SIGN-UP TRIGGER
--    Kapag nag-signUp, dito ginagawa ang students/teachers row.
--    Laging 'Pending' ang status at 'Teacher' ang role, anuman ang ipadala.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  m     jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_lrn text;
begin
  if new.email like '%@student.local' then
    v_lrn := split_part(new.email, '@', 1);
    if v_lrn !~ '^[0-9]{12}$' then
      raise exception 'Invalid LRN';
    end if;

    insert into public.students (
      lrn, first_name, last_name, middle_name, sex, section,
      course, field, deployment_area, school_name, status, is_first_login
    ) values (
      v_lrn,
      left(nullif(trim(m ->> 'first_name'), ''), 100),
      left(nullif(trim(m ->> 'last_name'), ''), 100),
      left(nullif(trim(m ->> 'middle_name'), ''), 100),
      coalesce(nullif(m ->> 'sex', ''), 'Male'),
      coalesce(nullif(m ->> 'section', ''), '12 GAS'),
      coalesce(nullif(m ->> 'course', ''), 'Nursing'),
      coalesce(nullif(m ->> 'field', ''), 'Health'),
      left(nullif(m ->> 'deployment_area', ''), 200),
      left(nullif(m ->> 'school_name', ''), 200),
      'Pending',
      false          -- sila mismo ang pumili ng password
    )
    on conflict (lrn) do nothing;

  elsif m ->> 'account_type' = 'teacher' then
    insert into public.teachers (email, status, role)
    values (new.email, 'Pending', 'Teacher')
    on conflict (email) do nothing;
  end if;

  return new;
end $$;

drop trigger if exists on_auth_user_created_wi on auth.users;
create trigger on_auth_user_created_wi
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();


-- ---------------------------------------------------------------------
-- 6. RPC FUNCTIONS
-- ---------------------------------------------------------------------

-- 6a. Time in / time out ng estudyante.
--     * Isang beses lang puwedeng i-set ang bawat oras (hindi na mapapalitan).
--     * Tinatanggihan ang oras na nasa hinaharap o lampas 7 araw na.
--     * Idempotent: ang parehong client_action_id ay hindi madodoble.
create or replace function public.record_attendance(
  p_action           text,
  p_captured_at      timestamptz,
  p_photo_path       text default null,
  p_client_action_id uuid default null
)
returns public.attendance
language plpgsql security definer
set search_path = public
as $$
declare
  v_lrn   text := public.current_lrn();
  v_local timestamp;
  v_date  text;
  v_time  time;
  rec     public.attendance;
begin
  if v_lrn is null then
    raise exception 'Para lang sa estudyante ang attendance.';
  end if;
  if not exists (select 1 from public.students where lrn = v_lrn and status = 'Approved') then
    raise exception 'Hindi pa approved ang account mo.';
  end if;
  if p_action not in ('MORNING_IN', 'MORNING_OUT', 'AFTERNOON_IN', 'AFTERNOON_OUT') then
    raise exception 'Invalid action: %', p_action;
  end if;
  if p_captured_at is null or p_captured_at > now() + interval '10 minutes' then
    raise exception 'Mali ang oras ng cellphone mo. Ayusin muna ang Date & Time settings.';
  end if;
  if p_captured_at < now() - interval '7 days' then
    raise exception 'Lampas 7 araw na ang record na ito kaya hindi na matatanggap. Kausapin ang teacher.';
  end if;
  if p_photo_path is not null and p_photo_path not like v_lrn || '/%' then
    raise exception 'Invalid photo path.';
  end if;

  v_local := p_captured_at at time zone 'Asia/Manila';
  v_date  := to_char(v_local, 'YYYY-MM-DD');
  v_time  := date_trunc('second', v_local)::time;

  -- Na-sync na dati? Ibalik lang ang record.
  if p_client_action_id is not null
     and exists (select 1 from public.sync_log where client_action_id = p_client_action_id) then
    select * into rec from public.attendance where lrn = v_lrn and date = v_date;
    return rec;
  end if;

  insert into public.attendance (lrn, date) values (v_lrn, v_date)
  on conflict (lrn, date) do nothing;

  select * into rec from public.attendance
  where lrn = v_lrn and date = v_date
  for update;

  if p_action = 'MORNING_IN' then
    if rec.morning_in is null then
      update public.attendance
         set morning_in = v_time,
             time_in_photo = coalesce(p_photo_path, time_in_photo)
       where id = rec.id;
    end if;

  elsif p_action = 'MORNING_OUT' then
    if rec.morning_in is null then
      raise exception 'Wala pang Morning Time In para sa %.', v_date;
    end if;
    if rec.morning_out is null then
      if v_time <= rec.morning_in then
        raise exception 'Mas maaga ang Time Out kaysa Time In. I-check ang oras ng cellphone.';
      end if;
      update public.attendance set morning_out = v_time where id = rec.id;
    end if;

  elsif p_action = 'AFTERNOON_IN' then
    if rec.afternoon_in is null then
      if rec.morning_out is not null and v_time < rec.morning_out then
        raise exception 'Mas maaga ang Afternoon In kaysa Morning Out. I-check ang oras ng cellphone.';
      end if;
      update public.attendance set afternoon_in = v_time where id = rec.id;
    end if;

  elsif p_action = 'AFTERNOON_OUT' then
    if rec.afternoon_in is null then
      raise exception 'Wala pang Afternoon Time In para sa %.', v_date;
    end if;
    if rec.afternoon_out is null then
      if v_time <= rec.afternoon_in then
        raise exception 'Mas maaga ang Time Out kaysa Time In. I-check ang oras ng cellphone.';
      end if;
      update public.attendance
         set afternoon_out = v_time,
             time_out_photo = coalesce(p_photo_path, time_out_photo)
       where id = rec.id;
    end if;
  end if;

  insert into public.sync_log (lrn, action, client_action_id, payload)
  values (
    v_lrn, p_action, p_client_action_id,
    jsonb_build_object('captured_at', p_captured_at, 'received_at', now(), 'photo', p_photo_path)
  );

  select * into rec from public.attendance where id = rec.id;
  return rec;
end $$;


-- 6b. Forgot password (puwede kahit hindi naka-login)
create or replace function public.request_password_reset(p_lrn text, p_reason text default null)
returns text
language plpgsql security definer
set search_path = public
as $$
begin
  if p_lrn is null or p_lrn !~ '^[0-9]{12}$' then
    return 'invalid';
  end if;
  if not exists (select 1 from public.students where lrn = p_lrn) then
    return 'not_found';
  end if;
  if exists (select 1 from public.password_reset_requests where lrn = p_lrn and status = 'Pending') then
    return 'already_pending';
  end if;
  insert into public.password_reset_requests (lrn, reason, status)
  values (p_lrn, left(coalesce(p_reason, ''), 500), 'Pending');
  return 'ok';
end $$;


-- 6c. Teacher nagre-reset ng password ng estudyante.
--     Binabago ang TOTOONG login password (auth.users), hindi lang ang students table.
create extension if not exists pgcrypto with schema extensions;

create or replace function public.reset_student_password(p_lrn text, p_new_password text)
returns void
language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if not public.is_teacher() then
    raise exception 'Teachers lang ang puwedeng mag-reset ng password.';
  end if;
  if length(coalesce(p_new_password, '')) < 6 then
    raise exception 'Dapat hindi bababa sa 6 characters ang password.';
  end if;

  update auth.users
     set encrypted_password = crypt(p_new_password, gen_salt('bf')),
         updated_at = now()
   where email = p_lrn || '@student.local';

  if not found then
    raise exception 'Walang login account ang LRN na %.', p_lrn;
  end if;

  update public.students set is_first_login = true where lrn = p_lrn;

  update public.password_reset_requests
     set status = 'Approved', processed_at = now()
   where lrn = p_lrn and status = 'Pending';
end $$;


-- Permissions ng functions
revoke execute on function public.record_attendance(text, timestamptz, text, uuid) from public, anon;
grant  execute on function public.record_attendance(text, timestamptz, text, uuid) to authenticated;

revoke execute on function public.reset_student_password(text, text) from public, anon;
grant  execute on function public.reset_student_password(text, text) to authenticated;

grant  execute on function public.request_password_reset(text, text) to anon, authenticated;

revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 7. STORAGE: gawing PRIVATE ang lahat ng bucket
--    (signed URLs na ang ginagamit ng app; gumagana pa rin ang lumang files)
-- ---------------------------------------------------------------------
update storage.buckets
   set public = false,
       file_size_limit = 2097152,                                -- 2 MB
       allowed_mime_types = array['image/jpeg']
 where id = 'attendance_photos';

update storage.buckets
   set public = false,
       file_size_limit = 5242880,                                -- 5 MB
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'diary_images';

update storage.buckets
   set public = false,
       file_size_limit = 5242880,                                -- 5 MB
       allowed_mime_types = array['application/pdf']
 where id = 'requirements_files';

-- Estudyante: sariling folder lang (<LRN>/...). Teacher: nakikita lahat.
create policy wi_files_select on storage.objects
  for select to authenticated
  using (
    bucket_id in ('attendance_photos', 'diary_images', 'requirements_files')
    and ((storage.foldername(name))[1] = public.current_lrn() or public.is_teacher())
  );

create policy wi_files_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('attendance_photos', 'diary_images', 'requirements_files')
    and (storage.foldername(name))[1] = public.current_lrn()
  );

create policy wi_files_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id in ('attendance_photos', 'diary_images', 'requirements_files')
    and (storage.foldername(name))[1] = public.current_lrn()
  )
  with check (
    bucket_id in ('attendance_photos', 'diary_images', 'requirements_files')
    and (storage.foldername(name))[1] = public.current_lrn()
  );

create policy wi_files_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('attendance_photos', 'diary_images', 'requirements_files')
    and (storage.foldername(name))[1] = public.current_lrn()
  );


-- ---------------------------------------------------------------------
-- 8. TANGGALIN ANG PLAIN-TEXT PASSWORDS
--    Ang Supabase Auth na ang may hawak ng password (naka-hash).
-- ---------------------------------------------------------------------
alter table public.students drop column if exists password_hash;
alter table public.teachers drop column if exists password_hash;

commit;


-- =====================================================================
-- PAGKATAPOS MAG-RUN: i-check kung may nakapasok na hindi dapat.
-- (I-run nang hiwalay ang bawat isa.)
-- =====================================================================

-- A. Lahat ng teacher/admin. May hindi ka ba kilala na 'Approved'?
--    Kung meron:  update teachers set status = 'Rejected' where email = '...';
-- select email, role, status, created_at from public.teachers order by created_at;

-- B. Mga estudyanteng Approved. Tugma ba sa listahan mo?
-- select lrn, last_name, first_name, section, status, created_at
-- from public.students where status = 'Approved' order by created_at desc;

-- C. Mga login account na walang students row (nabigo dati ang registration).
--    Kailangan silang gawan ng row o burahin sa Authentication → Users.
-- select u.email, u.created_at from auth.users u
-- where u.email like '%@student.local'
--   and not exists (select 1 from public.students s where s.lrn = split_part(u.email, '@', 1));
