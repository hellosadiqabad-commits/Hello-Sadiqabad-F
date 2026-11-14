-- Use the existing notification type enum/check value for approved business claims.
create or replace function private.approve_submission(p_submission_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  s public.submissions%rowtype;
  p jsonb;
  city uuid;
  new_id uuid;
  claim_owner uuid;
begin
  if not private.staff_has_permission('moderation.review') then
    raise exception 'Permission denied';
  end if;
  if p_action not in ('approve','reject') then
    raise exception 'Invalid action';
  end if;

  select * into s from public.submissions where id=p_submission_id for update;
  if not found then raise exception 'Submission not found'; end if;

  p:=s.payload;
  perform set_config('app.approving_submission','true',true);

  if p_action='approve' then
    if s.type='new_business' then
      select id into city from public.cities where slug='sadiqabad';
      insert into public.businesses(
        city_id,name_en,name_ur,slug,category_id,area_id,address_en,address_ur,
        phone_primary,whatsapp,description_en,description_ur,logo_url,cover_url,
        services_en,status,source,created_by,published_at
      )
      values(
        city,coalesce(nullif(p->>'name_en',''),'New Sadiqabad Business'),p->>'name_ur',
        lower(regexp_replace(coalesce(nullif(p->>'name_en',''),'new-business'),'[^a-zA-Z0-9]+','-','g'))||'-'||substr(gen_random_uuid()::text,1,6),
        (p->>'category_id')::uuid,nullif(p->>'area_id','')::uuid,p->>'address_en',p->>'address_ur',
        coalesce(nullif(p->>'phone_primary',''),s.contact_phone),p->>'whatsapp',p->>'description_en',p->>'description_ur',
        p->>'logo_url',p->>'cover_url',
        case when jsonb_typeof(p->'services_en')='array' then array(select jsonb_array_elements_text(p->'services_en')) else '{}'::text[] end,
        'published','visitor_submission',auth.uid(),now()
      ) returning id into new_id;

    elsif s.type in('correction','phone_suggestion') and s.business_id is not null then
      update public.businesses
      set phone_primary=coalesce(nullif(p->>'phone_primary',''),phone_primary),
          address_en=coalesce(nullif(p->>'address_en',''),address_en),
          status=case when lower(coalesce(p->>'reason','')) like '%permanently closed%' then 'archived' else status end,
          updated_at=now()
      where id=s.business_id;

    elsif s.type='claim' and s.business_id is not null then
      if s.submitted_by is not null then
        select id into claim_owner
        from public.profiles
        where id=s.submitted_by and role='owner' and is_active;

        if claim_owner is null then
          raise exception 'The claimant account is no longer an active owner account';
        end if;

        update public.businesses
        set owner_id=claim_owner,
            claimed_at=now(),
            is_verified=true,
            owner_name=coalesce(nullif(p->>'owner_name',''),owner_name),
            updated_at=now()
        where id=s.business_id
          and (owner_id is null or owner_id=claim_owner);

        if not found then
          raise exception 'This business is already assigned to another owner; manual review is required';
        end if;

        insert into public.notifications(
          user_id,type,title_en,title_ur,body_en,body_ur,link_path,is_read,created_at
        )
        values(
          claim_owner,'claim',
          'Business claim approved','کاروبار کی ملکیت منظور ہو گئی',
          'Your ownership claim has been approved. Your business is now available in the Owner Portal.',
          'آپ کی ملکیت کی درخواست منظور ہو گئی ہے۔ اب آپ کا کاروبار اونر پورٹل میں موجود ہے۔',
          '/owner',false,now()
        );
      else
        update public.businesses
        set claimed_at=now(),
            is_verified=true,
            owner_name=coalesce(nullif(p->>'owner_name',''),owner_name),
            updated_at=now()
        where id=s.business_id;
      end if;

    elsif s.type='report' and s.business_id is not null then
      update public.businesses
      set status=case when lower(coalesce(p->>'reason','')) like '%permanently closed%' then 'archived' else status end,
          updated_at=now()
      where id=s.business_id;

    elsif s.type='plan_upgrade' and s.business_id is not null then
      if p->>'requested_plan' in('basic','premium') then
        update public.businesses
        set plan_code=p->>'requested_plan',
            plan_expires_at=now()+interval '1 year',
            updated_at=now()
        where id=s.business_id;
      end if;
    end if;

    update public.submissions set status='done',updated_at=now() where id=p_submission_id;
  else
    update public.submissions set status='rejected',updated_at=now() where id=p_submission_id;
  end if;

  insert into public.audit_logs(actor_id,action,entity,entity_id,details)
  values(auth.uid(),'submission.'||p_action,'submissions',p_submission_id::text,
         jsonb_build_object('type',s.type,'business_id',s.business_id,'submitted_by',s.submitted_by));
end
$function$;
