-- =============================================================================
-- Notas personales del alumno por lección.
--
-- Son privadas: solo su autor las lee (ni otros alumnos ni administradores).
-- Solo se pueden crear o editar en lecciones que el alumno puede ver; si luego
-- pierde el acceso (p. ej. reembolso), conserva la lectura y el borrado de sus
-- propias notas, porque son sus datos.
-- =============================================================================

create table if not exists public.lesson_notes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index if not exists lesson_notes_user_course_idx on public.lesson_notes (user_id, course_id, updated_at desc);

-- course_id siempre se toma de la lección (no se confía en el cliente).
drop trigger if exists lesson_notes_sync on public.lesson_notes;
create trigger lesson_notes_sync before insert or update of lesson_id
  on public.lesson_notes for each row execute function public.sync_course_from_lesson();
drop trigger if exists lesson_notes_updated_at on public.lesson_notes;
create trigger lesson_notes_updated_at before update on public.lesson_notes
  for each row execute function public.set_updated_at();

alter table public.lesson_notes enable row level security;

revoke all on public.lesson_notes from anon, authenticated;
grant select, delete on public.lesson_notes to authenticated;
grant insert (user_id, lesson_id, course_id, body) on public.lesson_notes to authenticated;
grant update (body) on public.lesson_notes to authenticated;

create policy "lesson_notes: leer las propias" on public.lesson_notes for select to authenticated
  using (user_id = (select auth.uid()));
create policy "lesson_notes: crear en lecciones visibles" on public.lesson_notes for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_view_lesson(lesson_id));
create policy "lesson_notes: editar en lecciones visibles" on public.lesson_notes for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.can_view_lesson(lesson_id));
create policy "lesson_notes: borrar las propias" on public.lesson_notes for delete to authenticated
  using (user_id = (select auth.uid()));
