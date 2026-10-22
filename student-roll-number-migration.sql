-- Adds an optional roll number for students and backfills it from the
-- position of each student inside their class.
alter table public.students add column if not exists roll_number text;

with ranked as (
  select
    id,
    class_id,
    row_number() over (partition by class_id order by full_name, id) as position
  from public.students
)
update public.students s
set roll_number = ranked.position::text
from ranked
where s.id = ranked.id
  and (s.roll_number is null or btrim(s.roll_number) = '');
