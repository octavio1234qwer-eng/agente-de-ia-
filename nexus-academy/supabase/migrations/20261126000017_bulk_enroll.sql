-- =============================================================================
-- Inscripción masiva por lista de correos (empresas, escuelas, grupos).
--
-- admin_bulk_enroll(curso, correos): solo admin. Por cada correo devuelve:
--   enrolled   → tenía cuenta y se le dio acceso
--   restored   → tenía el acceso revocado y se le devolvió
--   already    → ya tenía acceso vigente (no se toca)
--   not_found  → no hay cuenta con ese correo (el servidor puede invitarlo)
--   invalid    → no parece un correo
-- Compara correos sin distinguir mayúsculas. Máximo 500 por llamada.
-- Deja una sola fila de auditoría con los conteos (sin la lista de correos).
-- =============================================================================

create or replace function public.admin_bulk_enroll(p_course_id uuid, p_emails text[])
returns table (email text, status text, user_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_user uuid;
  v_enr_id uuid;
  v_revoked timestamptz;
  v_counts jsonb := '{}'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.courses c where c.id = p_course_id) then
    raise exception 'course_not_found' using errcode = 'P0002';
  end if;
  if coalesce(array_length(p_emails, 1), 0) > 500 then
    raise exception 'too_many_emails' using errcode = '22023';
  end if;

  for v_email in
    select distinct lower(btrim(e)) from unnest(coalesce(p_emails, '{}')) e where btrim(e) <> ''
  loop
    email := v_email;
    user_id := null;
    if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
      status := 'invalid';
    else
      select p.id into v_user from public.profiles p where lower(p.email::text) = v_email;
      if v_user is null then
        status := 'not_found';
      else
        user_id := v_user;
        select en.id, en.revoked_at into v_enr_id, v_revoked from public.enrollments en where en.user_id = v_user and en.course_id = p_course_id;
        if v_enr_id is null then
          insert into public.enrollments (user_id, course_id, source) values (v_user, p_course_id, 'admin_grant');
          status := 'enrolled';
        elsif v_revoked is not null then
          update public.enrollments en set revoked_at = null where en.id = v_enr_id;
          status := 'restored';
        else
          status := 'already';
        end if;
      end if;
    end if;
    v_counts := jsonb_set(v_counts, array[status], to_jsonb(coalesce((v_counts ->> status)::int, 0) + 1));
    v_user := null;
    v_enr_id := null;
    v_revoked := null;
    return next;
  end loop;

  insert into public.admin_audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'bulk_enroll', 'course', p_course_id::text, v_counts);
end;
$$;

revoke all on function public.admin_bulk_enroll(uuid, text[]) from public, anon;
grant execute on function public.admin_bulk_enroll(uuid, text[]) to authenticated;
