-- Allows student and teacher profiles to store additional custom fields.
alter table public.students add column if not exists extra_fields jsonb not null default '{}'::jsonb;
alter table public.teachers add column if not exists extra_fields jsonb not null default '{}'::jsonb;