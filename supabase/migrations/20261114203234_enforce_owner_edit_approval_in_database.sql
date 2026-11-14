-- Enforce owner_edits_require_approval at the database boundary. The setting is
-- private and must never be trusted to a browser-side read or client-supplied flag.
create or replace function private.owner_edits_require_approval()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    (
      select (s.value #>> '{}')::boolean
      from public.site_settings s
      where s.key = 'owner_edits_require_approval'
      limit 1
    ),
    false
  )
$function$;

revoke all on function private.owner_edits_require_approval() from public;
grant execute on function private.owner_edits_require_approval() to authenticated;

create or replace function public.guard_business_columns()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if current_setting('app.approving_submission', true) = 'true'
     or current_setting('app.recalculating_rating', true) = 'true' then
    return new;
  end if;

  if auth.uid() is not null
     and old.owner_id = (select auth.uid())
     and old.status = 'published'
     and private.owner_edits_require_approval()
     and (to_jsonb(new) - 'status' - 'updated_at')
         is distinct from (to_jsonb(old) - 'status' - 'updated_at') then
    new.status := 'pending_approval';
  end if;

  if auth.uid() is not null
     and not private.is_super_admin()
     and not private.staff_has_permission('business.publish') then

    if new.status is distinct from old.status
       and not (
         (old.status in ('draft','rejected') and new.status = 'pending_approval')
         or (
           old.status = 'published'
           and new.status = 'pending_approval'
           and old.owner_id = (select auth.uid())
           and private.owner_edits_require_approval()
         )
       ) then
      raise exception 'Business status is managed by staff'
        using errcode = '42501';
    end if;

    if new.plan_code is distinct from old.plan_code
       or new.plan_expires_at is distinct from old.plan_expires_at
       or new.is_verified is distinct from old.is_verified
       or new.is_featured is distinct from old.is_featured
       or new.view_count is distinct from old.view_count
       or new.call_count is distinct from old.call_count
       or new.whatsapp_count is distinct from old.whatsapp_count
       or new.owner_id is distinct from old.owner_id
       or new.rating_avg is distinct from old.rating_avg
       or new.rating_count is distinct from old.rating_count
       or new.assigned_to is distinct from old.assigned_to
       or new.source is distinct from old.source
       or new.published_at is distinct from old.published_at
       or new.created_by is distinct from old.created_by then
      raise exception 'Protected business fields cannot be changed by this user'
        using errcode = '42501';
    end if;
  end if;

  return new;
end
$function$;
