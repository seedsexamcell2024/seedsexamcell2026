-- SEEDS Academics Hub: school-scoped Supabase schema.
-- Run in the Supabase SQL Editor before connecting config.js.

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  academic_year text not null default extract(year from current_date)::text,
  logo_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  grade text not null,
  section text not null,
  name text generated always as ('Grade ' || grade || ' ' || section) stored,
  created_at timestamptz not null default now(),
  unique (school_id, grade, section),
  unique (id, school_id)
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  code text not null,
  created_at timestamptz not null default now(),
  unique (school_id, code),
  unique (id, school_id)
);

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id text not null default (
    'TCH-' || to_char(current_date, 'YYYY') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
  ),
  full_name text not null,
  email text,
  phone text,
  photo_path text,
  extra_fields jsonb not null default '{}'::jsonb,
  status text not null default 'Active' check (status in ('Active', 'Inactive')),
  created_at timestamptz not null default now(),
  unique (school_id, teacher_id),
  unique (id, school_id)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id text not null default (
    'STD-' || to_char(current_date, 'YYYY') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
  ),
  full_name text not null,
  class_id uuid,
  gender text check (gender in ('Female', 'Male', 'Other') or gender is null),
  guardian_name text,
  guardian_phone text,
  photo_path text,
  roll_number text,
  extra_fields jsonb not null default '{}'::jsonb,
  status text not null default 'Active' check (status in ('Active', 'Inactive')),
  created_at timestamptz not null default now(),
  unique (school_id, student_id),
  unique (id, school_id),
  foreign key (class_id, school_id) references public.classes(id, school_id)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  role text not null check (role in ('developer', 'admin', 'teacher', 'student', 'parent')),
  display_name text not null,
  teacher_id uuid,
  student_id uuid,
  created_at timestamptz not null default now(),
  foreign key (teacher_id, school_id) references public.teachers(id, school_id),
  foreign key (student_id, school_id) references public.students(id, school_id)
);

alter table public.schools add column if not exists logo_path text;
alter table public.teachers add column if not exists photo_path text;
alter table public.students add column if not exists photo_path text;
alter table public.teachers add column if not exists extra_fields jsonb not null default '{}'::jsonb;
alter table public.students add column if not exists extra_fields jsonb not null default '{}'::jsonb;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('developer', 'admin', 'teacher', 'student', 'parent'));

update public.schools
set name = 'SEEDS School of Excellence'
where name = 'SEEDS Academy';

create table if not exists public.class_subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null,
  subject_id uuid not null,
  teacher_id uuid not null,
  created_at timestamptz not null default now(),
  unique (class_id, subject_id),
  foreign key (class_id, school_id) references public.classes(id, school_id) on delete cascade,
  foreign key (subject_id, school_id) references public.subjects(id, school_id) on delete cascade,
  foreign key (teacher_id, school_id) references public.teachers(id, school_id) on delete cascade
);

create table if not exists public.subject_enrollments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  assignment_id uuid not null references public.class_subjects(id) on delete cascade,
  student_id uuid not null,
  created_at timestamptz not null default now(),
  unique (assignment_id, student_id),
  foreign key (student_id, school_id) references public.students(id, school_id) on delete cascade
);

create table if not exists public.parent_students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  parent_profile_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null,
  created_at timestamptz not null default now(),
  unique (parent_profile_id, student_id),
  foreign key (student_id, school_id) references public.students(id, school_id) on delete cascade
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null,
  class_id uuid not null,
  attendance_date date not null default current_date,
  status text not null check (status in ('present', 'absent', 'leave', 'holiday')),
  recorded_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique (student_id, attendance_date),
  foreign key (student_id, school_id) references public.students(id, school_id) on delete cascade,
  foreign key (class_id, school_id) references public.classes(id, school_id) on delete cascade
);

alter table public.attendance drop constraint if exists attendance_status_check;
update public.attendance set status = 'leave' where status = 'late';
alter table public.attendance add constraint attendance_status_check
  check (status in ('present', 'absent', 'leave', 'holiday'));

create table if not exists public.school_holidays (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  holiday_date date not null,
  title text not null,
  description text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique (school_id, holiday_date)
);

alter table public.school_holidays enable row level security;

create policy "School members view holidays" on public.school_holidays for select to authenticated
  using (school_id = public.my_school_id());

create policy "Staff manage holidays" on public.school_holidays for all to authenticated
  with check (school_id = public.my_school_id() and public.is_school_admin());

create index if not exists school_holidays_school_date_idx on public.school_holidays (school_id, holiday_date);

create table if not exists public.subject_attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null,
  class_id uuid not null,
  subject_id uuid not null,
  attendance_date date not null default current_date,
  status text not null check (status in ('present', 'absent', 'leave', 'holiday')),
  recorded_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique (student_id, subject_id, attendance_date),
  foreign key (student_id, school_id) references public.students(id, school_id) on delete cascade,
  foreign key (class_id, school_id) references public.classes(id, school_id) on delete cascade,
  foreign key (subject_id, school_id) references public.subjects(id, school_id) on delete cascade
);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  title text not null,
  assessment_type text not null check (assessment_type in ('Monthly test', 'Term exam')),
  class_id uuid not null,
  subject_id uuid not null,
  assessment_date date not null,
  term text,
  max_marks numeric(8, 2) not null check (max_marks > 0),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (class_id, school_id) references public.classes(id, school_id) on delete cascade,
  foreign key (subject_id, school_id) references public.subjects(id, school_id) on delete cascade
);

create table if not exists public.marks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  student_id uuid not null,
  score numeric(8, 2) not null check (score >= 0),
  recorded_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique (assessment_id, student_id),
  foreign key (student_id, school_id) references public.students(id, school_id) on delete cascade
);

create or replace function public.validate_assessment_record()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  assessment_month integer := extract(month from new.assessment_date);
  normalized_term text := case
    when coalesce(new.term, '') ~* '^(2|second)' then '2nd Term'
    else '1st Term'
  end;
begin
  if new.assessment_type = 'Monthly test' then
    if new.max_marks <> 20 then
      raise exception 'Monthly tests must be out of 20 marks.';
    end if;
    if (normalized_term = '1st Term' and assessment_month not in (9, 10, 11))
      or (normalized_term = '2nd Term' and assessment_month not in (2, 3, 4)) then
      raise exception 'Monthly test date does not match its academic term.';
    end if;
    if exists (
      select 1 from public.assessments a
      where a.school_id = new.school_id
        and a.class_id = new.class_id
        and a.subject_id = new.subject_id
        and a.assessment_type = 'Monthly test'
        and extract(year from a.assessment_date) = extract(year from new.assessment_date)
        and extract(month from a.assessment_date) = assessment_month
        and (case when coalesce(a.term, '') ~* '^(2|second)' then '2nd Term' else '1st Term' end) = normalized_term
        and a.id is distinct from new.id
    ) then
      raise exception 'A monthly test already exists for this subject, class, term, and month.';
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists assessments_term_month_guard on public.assessments;
create trigger assessments_term_month_guard
before insert or update of assessment_type, assessment_date, term, max_marks, class_id, subject_id, school_id on public.assessments
for each row execute function public.validate_assessment_record();

create index if not exists students_school_class_idx on public.students (school_id, class_id);
create index if not exists attendance_school_date_idx on public.attendance (school_id, attendance_date);
create index if not exists subject_attendance_school_date_idx on public.subject_attendance (school_id, attendance_date);
create index if not exists assessments_school_date_idx on public.assessments (school_id, assessment_date);
create index if not exists marks_school_assessment_idx on public.marks (school_id, assessment_id);
create index if not exists class_subjects_teacher_idx on public.class_subjects (school_id, teacher_id, class_id);
create index if not exists subject_enrollments_student_idx on public.subject_enrollments (school_id, student_id);

create or replace function public.validate_attendance_record()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  assigned_class uuid;
begin
  select s.class_id into assigned_class
  from public.students s
  where s.id = new.student_id and s.school_id = new.school_id;

  if assigned_class is null or assigned_class <> new.class_id then
    raise exception 'Attendance class must match the student class.';
  end if;
  return new;
end
$$;

create trigger attendance_student_class_guard
before insert or update of student_id, class_id, school_id on public.attendance
for each row execute function public.validate_attendance_record();

create or replace function public.validate_subject_enrollment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.class_subjects cs
    join public.students s on s.class_id = cs.class_id and s.school_id = cs.school_id
    where cs.id = new.assignment_id
      and cs.school_id = new.school_id
      and s.id = new.student_id
  ) then
    raise exception 'The enrolled student must belong to the assigned class.';
  end if;
  return new;
end
$$;

drop trigger if exists subject_enrollment_class_guard on public.subject_enrollments;
create trigger subject_enrollment_class_guard
before insert or update of assignment_id, student_id, school_id on public.subject_enrollments
for each row execute function public.validate_subject_enrollment();

create or replace function public.validate_subject_attendance_record()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  student_class uuid;
begin
  select s.class_id into student_class
  from public.students s
  where s.id = new.student_id and s.school_id = new.school_id;

  if student_class is null or student_class <> new.class_id then
    raise exception 'Attendance class must match the student class.';
  end if;
  if not exists (
    select 1 from public.class_subjects cs
    where cs.school_id = new.school_id
      and cs.class_id = new.class_id
      and cs.subject_id = new.subject_id
  ) then
    raise exception 'Subject attendance must match an assigned class subject.';
  end if;
  return new;
end
$$;

drop trigger if exists subject_attendance_assignment_guard on public.subject_attendance;
create trigger subject_attendance_assignment_guard
before insert or update of student_id, class_id, subject_id, school_id on public.subject_attendance
for each row execute function public.validate_subject_attendance_record();

create or replace function public.validate_mark_record()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  max_score numeric(8, 2);
  assessment_class uuid;
  assessment_type text;
  assessment_term text;
  assessment_month integer;
begin
  select a.max_marks, a.class_id, a.assessment_type, a.term, extract(month from a.assessment_date)::integer
    into max_score, assessment_class, assessment_type, assessment_term, assessment_month
  from public.assessments a
  where a.id = new.assessment_id and a.school_id = new.school_id;

  if not found then
    raise exception 'The assessment must belong to the mark school.';
  end if;
  if assessment_type = 'Monthly test' and (
    max_score <> 20
    or (
      (coalesce(assessment_term, '') !~* '^(2|second)' and assessment_month not in (9, 10, 11))
      or (coalesce(assessment_term, '') ~* '^(2|second)' and assessment_month not in (2, 3, 4))
    )
  ) then
    raise exception 'Monthly tests must be scheduled in their term months and be out of 20 marks.';
  end if;
  if new.score > max_score then
    raise exception 'A score cannot exceed the assessment maximum.';
  end if;
  if not exists (
    select 1
    from public.students s
    join public.class_subjects cs
      on cs.school_id = s.school_id and cs.class_id = s.class_id
    join public.assessments a
      on a.school_id = cs.school_id and a.class_id = cs.class_id and a.subject_id = cs.subject_id
    join public.subject_enrollments se
      on se.school_id = cs.school_id and se.assignment_id = cs.id and se.student_id = s.id
    where a.id = new.assessment_id
      and s.id = new.student_id
      and s.school_id = new.school_id
      and s.class_id = assessment_class
  ) then
    raise exception 'The student must be enrolled in the assessment subject and class.';
  end if;
  return new;
end
$$;

drop trigger if exists marks_assessment_score_guard on public.marks;
create trigger marks_assessment_score_guard
before insert or update of assessment_id, student_id, score, school_id on public.marks
for each row execute function public.validate_mark_record();

create or replace function public.my_school_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select p.school_id from public.profiles p where p.id = (select auth.uid()) limit 1
$$;

create or replace function public.my_role()
returns text
language sql stable security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid()) limit 1
$$;

create or replace function public.my_teacher_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select p.teacher_id from public.profiles p where p.id = (select auth.uid()) limit 1
$$;

create or replace function public.my_student_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select p.student_id from public.profiles p where p.id = (select auth.uid()) limit 1
$$;

create or replace function public.is_platform_developer()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(public.my_role() = 'developer', false)
$$;

create or replace function public.can_manage_school(p_school_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_platform_developer()
    or (p_school_id = public.my_school_id() and public.my_role() = 'admin')
$$;

create or replace function public.is_school_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(public.my_role() = 'admin', false)
$$;

create or replace function public.teaches_class(p_class_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.class_subjects cs
    where cs.school_id = public.my_school_id()
      and cs.class_id = p_class_id
      and cs.teacher_id = public.my_teacher_id()
  )
$$;

create or replace function public.can_access_student(p_student_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select
    public.is_school_admin()
    or p_student_id = public.my_student_id()
    or exists (
      select 1 from public.parent_students ps
      where ps.parent_profile_id = (select auth.uid())
        and ps.student_id = p_student_id
        and ps.school_id = public.my_school_id()
    )
    or (
      public.my_role() = 'teacher'
      and exists (
        select 1 from public.students s
        where s.id = p_student_id and public.teaches_class(s.class_id)
      )
    )
$$;

create or replace function public.can_access_class(p_class_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select
    public.is_school_admin()
    or (public.my_role() = 'teacher' and public.teaches_class(p_class_id))
    or exists (
      select 1 from public.students s
      where s.class_id = p_class_id
        and (
          s.id = public.my_student_id()
          or exists (
            select 1 from public.parent_students ps
            where ps.parent_profile_id = (select auth.uid())
              and ps.student_id = s.id
              and ps.school_id = public.my_school_id()
          )
        )
    )
$$;

alter table public.schools enable row level security;
alter table public.classes enable row level security;
alter table public.subjects enable row level security;
alter table public.teachers enable row level security;
alter table public.students enable row level security;
alter table public.profiles enable row level security;
alter table public.class_subjects enable row level security;
alter table public.parent_students enable row level security;
alter table public.subject_enrollments enable row level security;
alter table public.attendance enable row level security;
alter table public.subject_attendance enable row level security;
alter table public.assessments enable row level security;
alter table public.marks enable row level security;

create policy "Members read own school" on public.schools for select to authenticated using (id = public.my_school_id());
create policy "Admins update own school" on public.schools for update to authenticated using (id = public.my_school_id() and public.is_school_admin()) with check (id = public.my_school_id() and public.is_school_admin());

create policy "Profiles read own or school admin" on public.profiles for select to authenticated using (id = (select auth.uid()) or (school_id = public.my_school_id() and public.is_school_admin()));
create policy "Admins manage school profiles" on public.profiles for all to authenticated using (school_id = public.my_school_id() and public.is_school_admin()) with check (school_id = public.my_school_id() and public.is_school_admin());

create policy "Members read classes" on public.classes for select to authenticated using (school_id = public.my_school_id() and public.can_access_class(id));
create policy "Admins manage classes" on public.classes for all to authenticated using (school_id = public.my_school_id() and public.is_school_admin()) with check (school_id = public.my_school_id() and public.is_school_admin());

create policy "Members read subjects" on public.subjects for select to authenticated using (school_id = public.my_school_id());
create policy "Admins manage subjects" on public.subjects for all to authenticated using (school_id = public.my_school_id() and public.is_school_admin()) with check (school_id = public.my_school_id() and public.is_school_admin());

create policy "Members read teachers" on public.teachers for select to authenticated using (school_id = public.my_school_id());
create policy "Admins manage teachers" on public.teachers for all to authenticated using (school_id = public.my_school_id() and public.is_school_admin()) with check (school_id = public.my_school_id() and public.is_school_admin());

create policy "Users read permitted students" on public.students for select to authenticated using (school_id = public.my_school_id() and public.can_access_student(id));
create policy "Admins manage students" on public.students for all to authenticated using (school_id = public.my_school_id() and public.is_school_admin()) with check (school_id = public.my_school_id() and public.is_school_admin());

create policy "Members read subject assignments" on public.class_subjects for select to authenticated using (
  school_id = public.my_school_id()
  and (public.is_school_admin() or teacher_id = public.my_teacher_id() or public.can_access_class(class_id))
);
create policy "Admins manage subject assignments" on public.class_subjects for all to authenticated using (school_id = public.my_school_id() and public.is_school_admin()) with check (school_id = public.my_school_id() and public.is_school_admin());

create policy "Users read permitted subject enrollments" on public.subject_enrollments for select to authenticated using (
  school_id = public.my_school_id()
  and (
    public.is_platform_developer()
    or
    public.is_school_admin()
    or exists (
      select 1 from public.class_subjects cs
      where cs.id = subject_enrollments.assignment_id
        and cs.school_id = subject_enrollments.school_id
        and cs.teacher_id = public.my_teacher_id()
        and public.my_role() = 'teacher'
    )
    or (
      public.my_role() in ('student', 'parent')
      and public.can_access_student(student_id)
    )
  )
);
create policy "Assigned teachers manage subject enrollments" on public.subject_enrollments for insert to authenticated with check (
  school_id = public.my_school_id()
  and (
    public.is_school_admin()
    or (
      public.my_role() = 'teacher'
      and exists (
        select 1 from public.class_subjects cs
        join public.students s on s.id = subject_enrollments.student_id and s.school_id = subject_enrollments.school_id
        where cs.id = subject_enrollments.assignment_id
          and cs.school_id = subject_enrollments.school_id
          and cs.teacher_id = public.my_teacher_id()
          and s.class_id = cs.class_id
      )
    )
  )
);
create policy "Assigned teachers remove subject enrollments" on public.subject_enrollments for delete to authenticated using (
  school_id = public.my_school_id()
  and (
    public.is_school_admin()
    or (
      public.my_role() = 'teacher'
      and exists (
        select 1 from public.class_subjects cs
        where cs.id = subject_enrollments.assignment_id
          and cs.school_id = subject_enrollments.school_id
          and cs.teacher_id = public.my_teacher_id()
      )
    )
  )
);

create policy "Parents read their links" on public.parent_students for select to authenticated using (
  school_id = public.my_school_id()
  and (parent_profile_id = (select auth.uid()) or public.is_school_admin())
);
create policy "Admins manage parent links" on public.parent_students for all to authenticated using (school_id = public.my_school_id() and public.is_school_admin()) with check (school_id = public.my_school_id() and public.is_school_admin());

create policy "Users read permitted attendance" on public.attendance for select to authenticated using (
  school_id = public.my_school_id()
  and (public.is_school_admin() or public.can_access_student(student_id))
);
create policy "Staff record attendance" on public.attendance for insert to authenticated with check (
  school_id = public.my_school_id()
  and recorded_by = (select auth.uid())
  and (public.is_school_admin() or (public.my_role() = 'teacher' and public.teaches_class(class_id)))
);
create policy "Staff update attendance" on public.attendance for update to authenticated using (
  school_id = public.my_school_id()
  and (public.is_school_admin() or (public.my_role() = 'teacher' and public.teaches_class(class_id)))
) with check (
  school_id = public.my_school_id()
  and (public.is_school_admin() or (public.my_role() = 'teacher' and public.teaches_class(class_id)))
);
create policy "Admins delete attendance" on public.attendance for delete to authenticated using (school_id = public.my_school_id() and public.is_school_admin());

drop policy if exists "Users read assigned subject attendance" on public.subject_attendance;
create policy "Users read assigned subject attendance" on public.subject_attendance for select to authenticated using (
  school_id = public.my_school_id()
  and (
    public.is_school_admin()
    or exists (
      select 1 from public.class_subjects cs
      where cs.school_id = subject_attendance.school_id
        and cs.class_id = subject_attendance.class_id
        and cs.subject_id = subject_attendance.subject_id
        and cs.teacher_id = public.my_teacher_id()
        and public.my_role() = 'teacher'
    )
    or (
      public.my_role() in ('student', 'parent')
      and public.can_access_student(subject_attendance.student_id)
    )
  )
);
drop policy if exists "Assigned subject teachers record attendance" on public.subject_attendance;
create policy "Assigned subject teachers record attendance" on public.subject_attendance for insert to authenticated with check (
  school_id = public.my_school_id()
  and recorded_by = (select auth.uid())
  and (
    public.is_school_admin()
    or (
      public.my_role() = 'teacher'
      and exists (
        select 1
        from public.class_subjects cs
        join public.students s on s.id = subject_attendance.student_id and s.school_id = subject_attendance.school_id
        where cs.school_id = subject_attendance.school_id
          and cs.class_id = subject_attendance.class_id
          and cs.subject_id = subject_attendance.subject_id
          and cs.teacher_id = public.my_teacher_id()
          and s.class_id = subject_attendance.class_id
      )
    )
  )
);
drop policy if exists "Assigned subject teachers update attendance" on public.subject_attendance;
create policy "Assigned subject teachers update attendance" on public.subject_attendance for update to authenticated using (
  school_id = public.my_school_id()
  and (
    public.is_school_admin()
    or (
      public.my_role() = 'teacher'
      and exists (
        select 1 from public.class_subjects cs
        where cs.school_id = subject_attendance.school_id
          and cs.class_id = subject_attendance.class_id
          and cs.subject_id = subject_attendance.subject_id
          and cs.teacher_id = public.my_teacher_id()
      )
    )
  )
) with check (
  school_id = public.my_school_id()
  and (
    public.is_school_admin()
    or (
      public.my_role() = 'teacher'
      and exists (
        select 1 from public.class_subjects cs
        join public.students s on s.id = subject_attendance.student_id and s.school_id = subject_attendance.school_id
        where cs.school_id = subject_attendance.school_id
          and cs.class_id = subject_attendance.class_id
          and cs.subject_id = subject_attendance.subject_id
          and cs.teacher_id = public.my_teacher_id()
          and s.class_id = subject_attendance.class_id
      )
    )
  )
);
drop policy if exists "Admins delete subject attendance" on public.subject_attendance;
create policy "Admins delete subject attendance" on public.subject_attendance for delete to authenticated using (
  school_id = public.my_school_id() and public.is_school_admin()
);

create policy "Users read permitted assessments" on public.assessments for select to authenticated using (
  school_id = public.my_school_id()
  and (
    public.is_school_admin()
    or (
      public.my_role() = 'teacher'
      and exists (
        select 1 from public.class_subjects cs
        where cs.school_id = assessments.school_id
          and cs.class_id = assessments.class_id
          and cs.subject_id = assessments.subject_id
          and cs.teacher_id = public.my_teacher_id()
      )
    )
    or (
      public.my_role() in ('student', 'parent')
      and public.can_access_class(class_id)
    )
  )
);
create policy "Staff create assessments" on public.assessments for insert to authenticated with check (
  school_id = public.my_school_id()
  and created_by = (select auth.uid())
  and (public.is_school_admin() or (public.my_role() = 'teacher' and exists (
    select 1 from public.class_subjects cs
    where cs.school_id = public.my_school_id()
      and cs.class_id = assessments.class_id
      and cs.subject_id = assessments.subject_id
      and cs.teacher_id = public.my_teacher_id()
  )))
);
create policy "Staff update assessments" on public.assessments for update to authenticated using (
  school_id = public.my_school_id()
  and (public.is_school_admin() or (public.my_role() = 'teacher' and exists (
    select 1 from public.class_subjects cs
    where cs.school_id = public.my_school_id()
      and cs.class_id = assessments.class_id
      and cs.subject_id = assessments.subject_id
      and cs.teacher_id = public.my_teacher_id()
  )))
) with check (
  school_id = public.my_school_id()
  and (
    public.is_school_admin()
    or (public.my_role() = 'teacher' and exists (
      select 1 from public.class_subjects cs
      where cs.school_id = public.my_school_id()
        and cs.class_id = assessments.class_id
        and cs.subject_id = assessments.subject_id
        and cs.teacher_id = public.my_teacher_id()
    ))
  )
);
create policy "Admins delete assessments" on public.assessments for delete to authenticated using (school_id = public.my_school_id() and public.is_school_admin());
create policy "Assigned teachers delete assessments" on public.assessments for delete to authenticated using (
  school_id = public.my_school_id()
  and public.my_role() = 'teacher'
  and exists (
    select 1 from public.class_subjects cs
    where cs.school_id = assessments.school_id
      and cs.class_id = assessments.class_id
      and cs.subject_id = assessments.subject_id
      and cs.teacher_id = public.my_teacher_id()
  )
);

create policy "Users read permitted marks" on public.marks for select to authenticated using (
  school_id = public.my_school_id()
  and (
    public.is_school_admin()
    or (
      public.my_role() in ('student', 'parent')
      and public.can_access_student(student_id)
    )
    or exists (
      select 1
      from public.assessments a
      join public.class_subjects cs on cs.school_id = a.school_id and cs.class_id = a.class_id and cs.subject_id = a.subject_id
      join public.subject_enrollments se on se.school_id = a.school_id and se.assignment_id = cs.id and se.student_id = marks.student_id
      where a.id = marks.assessment_id
        and public.my_role() = 'teacher'
        and cs.teacher_id = public.my_teacher_id()
    )
  )
);
create policy "Staff record marks" on public.marks for insert to authenticated with check (
  school_id = public.my_school_id()
  and recorded_by = (select auth.uid())
  and (
    public.is_school_admin()
    or (
      public.my_role() = 'teacher'
      and exists (
        select 1         from public.assessments a
        join public.students s on s.id = marks.student_id and s.school_id = marks.school_id
        join public.class_subjects cs on cs.class_id = a.class_id and cs.subject_id = a.subject_id and cs.school_id = a.school_id
        join public.subject_enrollments se on se.assignment_id = cs.id and se.student_id = s.id and se.school_id = a.school_id
        where a.id = marks.assessment_id
          and s.class_id = a.class_id
          and cs.teacher_id = public.my_teacher_id()
      )
    )
  )
);
create policy "Staff update marks" on public.marks for update to authenticated using (
  school_id = public.my_school_id()
  and (
    public.is_school_admin()
    or (
      public.my_role() = 'teacher'
      and exists (
        select 1 from public.assessments a
        join public.class_subjects cs on cs.class_id = a.class_id and cs.subject_id = a.subject_id and cs.school_id = a.school_id
        join public.subject_enrollments se on se.assignment_id = cs.id and se.student_id = marks.student_id and se.school_id = a.school_id
        where a.id = marks.assessment_id and cs.teacher_id = public.my_teacher_id()
      )
    )
  )
) with check (
  school_id = public.my_school_id()
  and (
    public.is_school_admin()
    or (
      public.my_role() = 'teacher'
      and exists (
        select 1         from public.assessments a
        join public.class_subjects cs on cs.class_id = a.class_id and cs.subject_id = a.subject_id and cs.school_id = a.school_id
        join public.students s on s.id = marks.student_id and s.school_id = marks.school_id
        join public.subject_enrollments se on se.assignment_id = cs.id and se.student_id = s.id and se.school_id = a.school_id
        where a.id = marks.assessment_id
          and s.class_id = a.class_id
          and cs.teacher_id = public.my_teacher_id()
      )
    )
  )
);
create policy "Assigned teachers delete marks" on public.marks for delete to authenticated using (
  school_id = public.my_school_id()
  and public.my_role() = 'teacher'
  and exists (
    select 1
    from public.assessments a
    join public.students s on s.id = marks.student_id and s.school_id = marks.school_id
    join public.class_subjects cs on cs.class_id = a.class_id and cs.subject_id = a.subject_id and cs.school_id = a.school_id
    join public.subject_enrollments se on se.assignment_id = cs.id and se.student_id = s.id and se.school_id = a.school_id
    where a.id = marks.assessment_id
      and s.class_id = a.class_id
      and cs.teacher_id = public.my_teacher_id()
  )
);
create policy "Admins delete marks" on public.marks for delete to authenticated using (school_id = public.my_school_id() and public.is_school_admin());

create policy "Developers manage all schools" on public.schools for all to authenticated
  using (public.is_platform_developer()) with check (public.is_platform_developer());
create policy "Developers read all profiles" on public.profiles for select to authenticated
  using (public.is_platform_developer());
create policy "Developers manage non-developer profiles" on public.profiles for all to authenticated
  using (public.is_platform_developer() and role <> 'developer')
  with check (public.is_platform_developer() and role <> 'developer');
create policy "Developers manage all classes" on public.classes for all to authenticated
  using (public.is_platform_developer()) with check (public.is_platform_developer());
create policy "Developers manage all subjects" on public.subjects for all to authenticated
  using (public.is_platform_developer()) with check (public.is_platform_developer());
create policy "Developers manage all teachers" on public.teachers for all to authenticated
  using (public.is_platform_developer()) with check (public.is_platform_developer());
create policy "Developers manage all students" on public.students for all to authenticated
  using (public.is_platform_developer()) with check (public.is_platform_developer());
create policy "Developers manage all assignments" on public.class_subjects for all to authenticated
  using (public.is_platform_developer()) with check (public.is_platform_developer());
create policy "Developers manage all subject enrollments" on public.subject_enrollments for all to authenticated
  using (public.is_platform_developer()) with check (public.is_platform_developer());
create policy "Developers manage all parent links" on public.parent_students for all to authenticated
  using (public.is_platform_developer()) with check (public.is_platform_developer());
create policy "Developers manage all attendance" on public.attendance for all to authenticated
  using (public.is_platform_developer()) with check (public.is_platform_developer());
drop policy if exists "Developers manage all subject attendance" on public.subject_attendance;
create policy "Developers manage all subject attendance" on public.subject_attendance for all to authenticated
  using (public.is_platform_developer()) with check (public.is_platform_developer());
create policy "Developers manage all assessments" on public.assessments for all to authenticated
  using (public.is_platform_developer()) with check (public.is_platform_developer());
create policy "Developers manage all marks" on public.marks for all to authenticated
  using (public.is_platform_developer()) with check (public.is_platform_developer());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('school-media', 'school-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "School members view school media" on storage.objects for select to authenticated
  using (
    bucket_id = 'school-media'
    and (
      public.is_platform_developer()
      or (
        (storage.foldername(name))[1]::uuid = public.my_school_id()
        and (
          (storage.foldername(name))[2] = 'school'
          or (storage.foldername(name))[2] = 'teachers'
          or (
            (storage.foldername(name))[2] = 'students'
            and case
              when split_part(storage.filename(name), '.', 1) ~*
                '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then public.can_access_student(split_part(storage.filename(name), '.', 1)::uuid)
              else false
            end
          )
        )
      )
    )
  );
create policy "School managers upload school media" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'school-media'
    and public.can_manage_school((storage.foldername(name))[1]::uuid)
  );
create policy "School managers update school media" on storage.objects for update to authenticated
  using (
    bucket_id = 'school-media'
    and public.can_manage_school((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'school-media'
    and public.can_manage_school((storage.foldername(name))[1]::uuid)
  );
create policy "School managers delete school media" on storage.objects for delete to authenticated
  using (
    bucket_id = 'school-media'
    and public.can_manage_school((storage.foldername(name))[1]::uuid)
  );

grant select, insert, update, delete on public.schools, public.classes, public.subjects, public.teachers,
  public.students, public.profiles, public.class_subjects, public.subject_enrollments, public.parent_students,
  public.attendance, public.subject_attendance, public.assessments, public.marks to authenticated;

-- First-account setup:
-- 1) Create an Auth user in Supabase Authentication.
-- 2) Replace the UUID below with that user's Auth ID.
-- 3) Create the school and first developer profile. Developer accounts must be
--    provisioned manually in Supabase; never allow public self-registration.
-- insert into public.schools (name, academic_year) values ('SEEDS School of Excellence', '2026') returning id;
-- insert into public.profiles (id, school_id, role, display_name)
-- values ('AUTH-USER-UUID'::uuid, 'SCHOOL-UUID'::uuid, 'developer', 'Platform Developer');
--
-- Developer role grants access across all schools. Only assign it to a trusted,
-- individually authenticated developer account.
-- Create admin/student accounts in Auth, then insert profile rows. Set teacher_id
-- or student_id for those roles; add parent_students rows to link a guardian to a child.
