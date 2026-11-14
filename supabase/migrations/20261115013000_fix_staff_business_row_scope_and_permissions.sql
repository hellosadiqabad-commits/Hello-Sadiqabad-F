-- Restrict staff listing edits to their own/assigned rows unless they have the
-- dedicated listing-publish permission. Align default staff permissions with the
-- frontend role definitions and prevent non-publishing staff from creating
-- privileged/verified listings.
create or replace function private.staff_has_permission(perm text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select private.is_super_admin() or exists (
    select 1
    from public.staff_members s
    join public.profiles p on p.id = s.user_id
    where s.user_id = (select auth.uid())
      and s.is_active
      and p.is_active
      and p.role = 'staff'
      and case
        when s.permissions ? perm then coalesce((s.permissions ->> perm)::boolean, false)
        when s.permissions ? 'all' then coalesce((s.permissions ->> 'all')::boolean, false)
        else case
          when perm = 'business.create' then s.staff_types && array['data_entry','importer','listing_manager']
          when perm = 'business.edit_own' then s.staff_types && array['data_entry','listing_manager']
          when perm = 'business.publish' then s.staff_types && array['listing_manager']
          when perm = 'import.run' then s.staff_types && array['importer']
          when perm in ('leads.manage','owners.create') then s.staff_types && array['sales_onboarding']
          when perm = 'tiers.manage' then s.staff_types && array['sales_onboarding']
          when perm = 'ads.review' then s.staff_types && array['sales_onboarding']
          when perm = 'moderation.review' then s.staff_types && array['moderator','support']
          when perm = 'support.read' then s.staff_types && array['support']
          when perm = 'analytics.view' then s.staff_types && array['listing_manager']
          else false
        end
      end
  )
$function$;

drop policy if exists businesses_update on public.businesses;
create policy businesses_update
on public.businesses
for update
to authenticated
using (
  owner_id = (select auth.uid())
  or private.is_super_admin()
  or (
    private.staff_has_permission('business.edit_own')
    and (
      created_by = (select auth.uid())
      or assigned_to = (select auth.uid())
    )
  )
  or private.staff_has_permission('business.publish')
)
with check (
  owner_id = (select auth.uid())
  or private.is_super_admin()
  or (
    private.staff_has_permission('business.edit_own')
    and (
      created_by = (select auth.uid())
      or assigned_to = (select auth.uid())
    )
  )
  or private.staff_has_permission('business.publish')
);

create or replace function public.guard_business_insert()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  -- Service-role jobs and super admins are trusted server-side/admin paths.
  if auth.uid() is null or private.is_super_admin()
     or private.staff_has_permission('business.publish') then
    return new;
  end if;

  if not (
    private.staff_has_permission('business.create')
    or private.staff_has_permission('import.run')
  ) then
    raise exception 'You are not allowed to create business listings'
      using errcode = '42501';
  end if;

  if new.created_by is distinct from (select auth.uid())
     or new.owner_id is not null
     or new.assigned_to is not null
     or new.status not in ('draft','pending_approval')
     or new.plan_code <> 'free'
     or new.plan_expires_at is not null
     or new.is_verified
     or new.is_featured
     or new.view_count <> 0
     or new.call_count <> 0
     or new.whatsapp_count <> 0
     or new.rating_avg is not null
     or new.rating_count <> 0
     or new.published_at is not null
     or new.claimed_at is not null then
    raise exception 'Staff-created listings must remain unassigned, unverified free drafts'
      using errcode = '42501';
  end if;

  return new;
end
$function$;

drop trigger if exists trg_guard_business_insert on public.businesses;
create trigger trg_guard_business_insert
before insert on public.businesses
for each row execute function public.guard_business_insert();
