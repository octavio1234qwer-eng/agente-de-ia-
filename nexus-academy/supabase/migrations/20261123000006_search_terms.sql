-- Raíces (lexemas) de lo que buscó el alumno, con el mismo analizador que el
-- índice. La lección las usa para resaltar en pantalla las mismas palabras que
-- encontró la búsqueda ("eventos" → "event" resalta "evento", "Eventos"...).
-- Solo transforma el texto recibido: no lee ninguna tabla.
create or replace function public.lesson_search_terms(p_q text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(distinct t.lexeme order by t.lexeme), '{}'::text[])
  from unnest(to_tsvector('public.nexus_es'::regconfig, public.lesson_search_text(left(coalesce(p_q, ''), 200)))) as t
  where char_length(t.lexeme) >= 2;
$$;

revoke all on function public.lesson_search_terms(text) from public, anon;
grant execute on function public.lesson_search_terms(text) to authenticated;
