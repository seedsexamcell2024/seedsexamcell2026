-- Adds per-subject student enrollment and protects gradebook mark entry.
-- Run once in the Supabase SQL Editor for an existing installation.

create table if not exists public.subject_enrollments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  assignment_id uuid not null references public.class_subjects(id) on delete cascade,
  student_id uuid not null,
  created_at timestamptz not null default now(),
  unique (assignment_id, student_id),
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

create index if not exists subject_enrollments_student_idx
  on public.subject_enrollments (school_id, student_id);
alter table public.subject_enrollments enable row level security;

-- Keep existing class rosters enrolled when upgrading from the class-wide gradebook.
insert into public.subject_enrollments (school_id, assignment_id, student_id)
select cs.school_id, cs.id, s.id
from public.class_subjects cs
join public.students s on s.school_id = cs.school_id and s.class_id = cs.class_id
on conflict (assignment_id, student_id) do nothing;

drop policy if exists "Assigned teachers delete assessments" on public.assessments;
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

create or replace function public.validate_mark_record()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  assessment_max numeric(8, 2);
  assessment_class uuid;
  assessment_type text;
  assessment_term text;
  assessment_month integer;
begin
  select a.max_marks, a.class_id, a.assessment_type, a.term, extract(month from a.assessment_date)::integer
    into assessment_max, assessment_class, assessment_type, assessment_term, assessment_month
  from public.assessments a
  where a.id = new.assessment_id and a.school_id = new.school_id;

  if not found then
    raise exception 'The assessment must belong to the mark school.';
  end if;
  if assessment_type = 'Monthly test' and (
    assessment_max <> 20
    or (
      (coalesce(assessment_term, '') !~* '^(2|second)' and assessment_month not in (9, 10, 11))
      or (coalesce(assessment_term, '') ~* '^(2|second)' and assessment_month not in (2, 3, 4))
    )
  ) then
    raise exception 'Monthly tests must be scheduled in their term months and be out of 20 marks.';
  end if;
  if new.score > assessment_max then
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
drop trigger if exists marks_assessment_enrollment_guard on public.marks;
create trigger marks_assessment_score_guard
before insert or update of assessment_id, student_id, score, school_id on public.marks
for each row execute function public.validate_mark_record();

drop policy if exists "Users read permitted subject enrollments" on public.subject_enrollments;
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

drop policy if exists "Assigned teachers manage subject enrollments" on public.subject_enrollments;
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

drop policy if exists "Assigned teachers remove subject enrollments" on public.subject_enrollments;
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

drop policy if exists "Developers manage all subject enrollments" on public.subject_enrollments;
create policy "Developers manage all subject enrollments" on public.subject_enrollments for all to authenticated
  using (public.is_platform_developer()) with check (public.is_platform_developer());

drop policy if exists "Users read permitted assessments" on public.assessments;
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

drop policy if exists "Staff create assessments" on public.assessments;
create policy "Staff create assessments" on public.assessments for insert to authenticated with check (
  school_id = public.my_school_id()
  and created_by = (select auth.uid())
  and (
    public.is_school_admin()
    or (
      public.my_role() = 'teacher'
      and exists (
        select 1 from public.class_subjects cs
        where cs.school_id = public.my_school_id()
          and cs.class_id = assessments.class_id
          and cs.subject_id = assessments.subject_id
          and cs.teacher_id = public.my_teacher_id()
      )
    )
  )
);

drop policy if exists "Staff update assessments" on public.assessments;
create policy "Staff update assessments" on public.assessments for update to authenticated using (
  school_id = public.my_school_id()
  and (
    public.is_school_admin()
    or (
      public.my_role() = 'teacher'
      and exists (
        select 1 from public.class_subjects cs
        where cs.school_id = public.my_school_id()
          and cs.class_id = assessments.class_id
          and cs.subject_id = assessments.subject_id
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
        where cs.school_id = public.my_school_id()
          and cs.class_id = assessments.class_id
          and cs.subject_id = assessments.subject_id
          and cs.teacher_id = public.my_teacher_id()
      )
    )
  )
);

drop policy if exists "Users read permitted marks" on public.marks;
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

drop policy if exists "Staff record marks" on public.marks;
create policy "Staff record marks" on public.marks for insert to authenticated with check (
  school_id = public.my_school_id()
  and recorded_by = (select auth.uid())
  and (
    public.is_school_admin()
    or (
      public.my_role() = 'teacher'
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
    )
  )
);

drop policy if exists "Staff update marks" on public.marks;
create policy "Staff update marks" on public.marks for update to authenticated using (
  school_id = public.my_school_id()
  and (
    public.is_school_admin()
    or (
      public.my_role() = 'teacher'
      and exists (
        select 1
        from public.assessments a
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
        select 1
        from public.assessments a
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

drop policy if exists "Assigned teachers delete marks" on public.marks;
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

grant select, insert, update, delete on public.subject_enrollments to authenticated;
