-- =============================================================================
-- Búsqueda de texto completo dentro de las lecciones (solo alumnos inscritos).
--
-- El índice vive en lesson_contents (protegida por RLS) y NO en lessons
-- (pública): así los lexemas del contenido de pago nunca quedan expuestos a
-- quien no compró el curso. search_lessons() es SECURITY INVOKER, de modo que
-- además de su propio filtro (has_course_access) se aplican las políticas RLS.
-- =============================================================================

create extension if not exists unaccent with schema extensions;

-- Español sin acentos: "función", "funcion" y "funciones" encuentran lo mismo.
do $$
begin
  if not exists (select 1 from pg_ts_config where cfgname = 'nexus_es' and cfgnamespace = 'public'::regnamespace) then
    create text search configuration public.nexus_es (copy = pg_catalog.spanish);
    alter text search configuration public.nexus_es
      alter mapping for hword, hword_part, word with extensions.unaccent, spanish_stem;
  end if;
end;
$$;

alter table public.lesson_contents
  add column if not exists search_vector tsvector not null default ''::tsvector;

-- El analizador de Postgres trata "boton.addEventListener" o "/api/cursos"
-- como un solo token (host/archivo), y entonces "addEventListener" no se
-- encontraría. Se sustituyen "." entre palabras y "/" ante una palabra por
-- caracteres de uso privado (U+E000 y U+E001) que el analizador toma como
-- separadores; la app los vuelve a mostrar como "." y "/".
create or replace function public.lesson_search_text(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
           regexp_replace(coalesce(p, ''), '([[:alnum:]_])\.(?=[[:alnum:]_])', '\1' || chr(57344), 'g'),
           '/(?=[[:alnum:]_])', chr(57345), 'g');
$$;

-- Documento indexable: título (peso A) > resumen (B) > cuerpo (C).
create or replace function public.lesson_search_document(p_title text, p_summary text, p_body text)
returns tsvector
language sql
immutable
set search_path = ''
as $$
  select setweight(to_tsvector('public.nexus_es'::regconfig, public.lesson_search_text(p_title)), 'A')
      || setweight(to_tsvector('public.nexus_es'::regconfig, public.lesson_search_text(p_summary)), 'B')
      || setweight(to_tsvector('public.nexus_es'::regconfig, public.lesson_search_text(p_body)), 'C');
$$;

-- Al guardar el cuerpo se recalcula el índice con el título/resumen actuales.
create or replace function public.lesson_contents_search_refresh()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_title text;
  v_summary text;
begin
  select l.title, l.summary into v_title, v_summary from public.lessons l where l.id = new.lesson_id;
  new.search_vector := public.lesson_search_document(v_title, v_summary, new.body);
  return new;
end;
$$;

drop trigger if exists lesson_contents_search on public.lesson_contents;
create trigger lesson_contents_search before insert or update of body, lesson_id
  on public.lesson_contents for each row execute function public.lesson_contents_search_refresh();

-- Toda lección tiene su fila de contenido (también los cuestionarios), para que
-- su título y resumen se puedan buscar.
create or replace function public.lessons_ensure_content()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.lesson_contents (lesson_id, course_id, body)
  values (new.id, new.course_id, '')
  on conflict (lesson_id) do nothing;
  return null;
end;
$$;

drop trigger if exists lessons_ensure_content on public.lessons;
create trigger lessons_ensure_content after insert on public.lessons
  for each row execute function public.lessons_ensure_content();

-- Si cambia el título o el resumen, se reindexa la lección.
create or replace function public.lessons_search_refresh()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.lesson_contents lc
     set search_vector = public.lesson_search_document(new.title, new.summary, lc.body)
   where lc.lesson_id = new.id;
  return null;
end;
$$;

drop trigger if exists lessons_search_refresh on public.lessons;
create trigger lessons_search_refresh after update of title, summary on public.lessons
  for each row execute function public.lessons_search_refresh();

revoke all on function public.lessons_ensure_content() from public, anon, authenticated;
revoke all on function public.lessons_search_refresh() from public, anon, authenticated;
revoke all on function public.lesson_contents_search_refresh() from public, anon, authenticated;

-- Datos existentes.
insert into public.lesson_contents (lesson_id, course_id, body)
select l.id, l.course_id, '' from public.lessons l
where not exists (select 1 from public.lesson_contents lc where lc.lesson_id = l.id);

update public.lesson_contents lc
   set search_vector = public.lesson_search_document(l.title, l.summary, lc.body)
  from public.lessons l
 where l.id = lc.lesson_id;

create index if not exists lesson_contents_search_idx on public.lesson_contents using gin (search_vector);

-- Convierte lo que escribe el alumno en una consulta segura: solo letras y
-- números (sin operadores de tsquery) y cada palabra como prefijo, para que
-- "prom" encuentre "promesas". Máximo 8 palabras.
create or replace function public.lesson_search_query(p_q text)
returns tsquery
language sql
immutable
set search_path = ''
as $$
  select case when count(*) = 0 then null
              else to_tsquery('public.nexus_es'::regconfig, string_agg(t || ':*', ' & '))
         end
  from (
    select t from regexp_split_to_table(lower(left(coalesce(p_q, ''), 200)), '[^[:alnum:]]+') as t
    where t <> ''
    limit 8
  ) words;
$$;

create or replace function public.search_lessons(q text, p_course_id uuid default null, p_limit int default 20)
returns table (
  lesson_id uuid,
  course_id uuid,
  course_slug text,
  course_title text,
  module_title text,
  lesson_title text,
  lesson_type public.lesson_type,
  snippet text,
  rank real
)
language sql
stable
security invoker
set search_path = ''
as $$
  with query as (select public.lesson_search_query(q) as tsq)
  select l.id, c.id, c.slug, c.title, m.title, l.title, l.type,
         ts_headline(
           'public.nexus_es'::regconfig,
           public.lesson_search_text(coalesce(nullif(lc.body, ''), nullif(l.summary, ''), l.title)),
           query.tsq,
           'StartSel=⟦, StopSel=⟧, MaxWords=28, MinWords=10, MaxFragments=2, FragmentDelimiter=" … "'
         ),
         ts_rank_cd(lc.search_vector, query.tsq)
    from query
    join public.lesson_contents lc on lc.search_vector @@ query.tsq
    join public.lessons l on l.id = lc.lesson_id
    join public.modules m on m.id = l.module_id
    join public.courses c on c.id = lc.course_id
   where query.tsq is not null
     and public.has_course_access(lc.course_id)
     and (p_course_id is null or lc.course_id = p_course_id)
   order by 9 desc, c.title, m.position, l.position
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke all on function public.search_lessons(text, uuid, int) from public, anon;
grant execute on function public.search_lessons(text, uuid, int) to authenticated;
