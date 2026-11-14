-- Owner Portal hardening: consistent analytics windows, editable replies, least-privilege inquiry updates.

create or replace function public.owner_dashboard_stats(p_business_id uuid, p_days integer default 30)
returns jsonb
language sql
stable
set search_path to ''
as $function$
with date_window as (
  select current_date - greatest(1, least(coalesce(p_days, 30), 90)) as start_date
)
select jsonb_build_object(
  'totals', jsonb_build_object(
    'views', coalesce((select sum(s.views) from public.daily_business_stats s, date_window w where s.business_id = p_business_id and s.stat_date >= w.start_date), 0),
    'calls', coalesce((select sum(s.calls) from public.daily_business_stats s, date_window w where s.business_id = p_business_id and s.stat_date >= w.start_date), 0),
    'whatsapp', coalesce((select sum(s.whatsapp) from public.daily_business_stats s, date_window w where s.business_id = p_business_id and s.stat_date >= w.start_date), 0),
    'directions', coalesce((select sum(s.directions) from public.daily_business_stats s, date_window w where s.business_id = p_business_id and s.stat_date >= w.start_date), 0),
    'shares', coalesce((select sum(s.shares) from public.daily_business_stats s, date_window w where s.business_id = p_business_id and s.stat_date >= w.start_date), 0)
  ),
  'series', coalesce((
    select jsonb_agg(to_jsonb(x) order by x.stat_date)
    from (
      select s.*
      from public.daily_business_stats s, date_window w
      where s.business_id = p_business_id and s.stat_date >= w.start_date
    ) x
  ), '[]'::jsonb),
  'top_search_terms', '[]'::jsonb
)
where private.is_owner_of(p_business_id)
$function$;

create or replace function private.owner_reply_to_review(p_review_id uuid, p_reply text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if p_reply is null or char_length(trim(p_reply)) not between 1 and 500 then
    raise exception 'Reply must be 1-500 characters';
  end if;

  update public.reviews r
  set owner_reply = trim(p_reply),
      owner_reply_at = now(),
      updated_at = now()
  where r.id = p_review_id
    and r.status = 'approved'
    and private.is_owner_of(r.business_id);

  if not found then
    raise exception 'Review not found, not approved, or not owned by you';
  end if;
end
$function$;

drop policy if exists inquiries_manage on public.inquiries;

create policy inquiries_owner_read
on public.inquiries
for select
to authenticated
using (
  private.is_owner_of(business_id)
  or private.staff_has_permission('support.read')
);

create policy inquiries_owner_update_status
on public.inquiries
for update
to authenticated
using (
  private.is_owner_of(business_id)
  or private.staff_has_permission('support.read')
)
with check (
  (private.is_owner_of(business_id) or private.staff_has_permission('support.read'))
  and (handled_by is null or handled_by = (select auth.uid()))
);

revoke update on table public.inquiries from authenticated;
revoke update (id, business_id, name, phone, message, status, handled_by, created_at, updated_at)
on table public.inquiries from authenticated;
grant update (status, handled_by, updated_at) on table public.inquiries to authenticated;
revoke delete on table public.inquiries from authenticated;
