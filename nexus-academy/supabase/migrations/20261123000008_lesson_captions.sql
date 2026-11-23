-- =============================================================================
-- Subtítulos (WebVTT) para videos propios.
--
-- Se guardan como texto en lesson_contents, así heredan exactamente las mismas
-- reglas de acceso (RLS) que el contenido de la lección. También se indexan en
-- la búsqueda: lo que se dice en el video se puede buscar.
-- =============================================================================

alter table public.lesson_contents
  add column if not exists captions_vtt text
    check (captions_vtt is null or (captions_vtt like 'WEBVTT%' and char_length(captions_vtt) <= 500000)),
  add column if not exists captions_lang text not null default 'es'
    check (captions_lang in ('es', 'en', 'pt')),
  add column if not exists has_captions boolean generated always as (captions_vtt is not null) stored;

-- Texto hablado de un WebVTT, sin encabezado, números de cue, tiempos, notas ni etiquetas.
create or replace function public.lesson_captions_text(p_vtt text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(btrim(regexp_replace(
           regexp_replace(
             regexp_replace(coalesce(p_vtt, ''), '^(WEBVTT[^\n]*|NOTE[^\n]*|STYLE|REGION|\d+|[0-9:.]+ --> [^\n]*)$', '', 'gn'),
             '<[^>]*>', '', 'g'),
           '\s+', ' ', 'g')), '');
$$;

-- El documento indexable ahora incluye los subtítulos (con el mismo peso que el cuerpo).
drop function if exists public.lesson_search_document(text, text, text);
create or replace function public.lesson_search_document(p_title text, p_summary text, p_body text, p_captions text)
returns tsvector
language sql
immutable
set search_path = ''
as $$
  select setweight(to_tsvector('public.nexus_es'::regconfig, public.lesson_search_text(p_title)), 'A')
      || setweight(to_tsvector('public.nexus_es'::regconfig, public.lesson_search_text(p_summary)), 'B')
      || setweight(to_tsvector('public.nexus_es'::regconfig, public.lesson_search_text(p_body)), 'C')
      || setweight(to_tsvector('public.nexus_es'::regconfig, public.lesson_search_text(public.lesson_captions_text(p_captions))), 'C');
$$;

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
  new.search_vector := public.lesson_search_document(v_title, v_summary, new.body, new.captions_vtt);
  return new;
end;
$$;

drop trigger if exists lesson_contents_search on public.lesson_contents;
create trigger lesson_contents_search before insert or update of body, lesson_id, captions_vtt
  on public.lesson_contents for each row execute function public.lesson_contents_search_refresh();

create or replace function public.lessons_search_refresh()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.lesson_contents lc
     set search_vector = public.lesson_search_document(new.title, new.summary, lc.body, lc.captions_vtt)
   where lc.lesson_id = new.id;
  return null;
end;
$$;

-- El fragmento de resultados también puede salir de los subtítulos.
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
           public.lesson_search_text(coalesce(
             nullif(concat_ws(E'\n', nullif(lc.body, ''), public.lesson_captions_text(lc.captions_vtt)), ''),
             nullif(l.summary, ''),
             l.title)),
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
