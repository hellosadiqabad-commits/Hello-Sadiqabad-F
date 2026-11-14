# Phase 1 Security Review — Live Test Project

This file records the security review and verified fixes applied to the connected testing Supabase project. No production deployment or business-row ownership linking was performed.

## Fixed: staff business row scope and protected fields

### Applied migrations
- `20261114202955_fix_staff_business_row_scope_and_permissions.sql`
  - Aligns database defaults for `business.publish`, `tiers.manage`, and `ads.review` with the staff role definitions in `src/lib/permissions.tsx`.
  - Restricts `business.edit_own` updates to rows where the staff member is `created_by` or `assigned_to`.
  - Adds a database insert guard so staff without `business.publish` can only create unassigned, unverified, free draft/pending listings.
- `20261114203132_protect_business_columns_from_edit_own_staff.sql`
  - Removes the `business.edit_own` bypass from the protected-column trigger.
  - Only super admins and staff with `business.publish` can change protected fields such as owner assignment, plan, verification, featured state, counters, source, and publication metadata.
- `20261114203234_enforce_owner_edit_approval_in_database.sql`
  - Adds a private security-definer helper to read the private approval setting safely.
  - When `owner_edits_require_approval=true`, an owner's content edit to a published listing automatically changes its status to `pending_approval` in the database, even if browser code cannot read the private setting.

### Frontend support
- `src/lib/api.ts` now sets `created_by` to the signed-in actor when inserting a new business, while omitting it from updates. This gives the database a reliable creator identity for row scoping.

### Verification
- Live regression transactions passed:
  - data-entry staff could not update a business created by someone else;
  - data-entry staff could update a draft they created;
  - data-entry staff could not change `is_verified`;
  - with the private setting temporarily enabled inside a rolled-back test transaction, an owner editing a published listing was automatically moved to `pending_approval`;
  - all test fixtures and temporary setting changes were rolled back.
- Existing business data was not changed by the test.
- The testing project currently has 123 businesses, 0 linked owner accounts, and 97 rows with `created_by` populated. No owner links were fabricated.

## Remaining high-priority work

### Owner edit approval setting
- `owner_edits_require_approval` currently has value `false` and is private in `site_settings`.
- The database-side approval workflow is now implemented and regression-tested. If an Admin later changes this setting to true, published owner edits are automatically sent to moderation.
- The browser no longer reads this private setting to decide approval; the database is authoritative. Keep the setting private.

### Public endpoint abuse controls
- Inquiry and suggestion submissions use session rate limits plus hashed phone identities.
- Review submissions use session limits plus hashed author-name identities.
- Session identifiers and contact values are client-controlled and can be rotated. These controls are defense-in-depth, not a complete IP-based abuse barrier.
- Before launch, add trusted edge-IP rate limiting and/or Turnstile after confirming the trusted request headers and deployment path. Do not trust arbitrary client-supplied `X-Forwarded-For` values.

### Auth and account provisioning
- Preset owner/staff passwords have been removed from the UI.
- Temporary passwords are required to be at least 12 characters and first-login password change is enabled.
- Public self-registration is not implemented. Actual Supabase public-signup configuration still needs dashboard verification. Keep public signups disabled until new users are created inactive/pending and an explicit Admin approval workflow exists.
- Leaked-password protection is currently disabled in Supabase Auth; enable it before launch.

## Operational / release boundaries
- GitHub main branch is being updated directly as explicitly requested by the project owner; no PR is being created for these changes.
- Main branch protection was previously found disabled. Enable branch protection / required CI checks once the direct-main work is complete.
- Edge Function source changes are committed to GitHub and type-checked by CI, but they have not been deployed to the connected Supabase project.
- Cloudflare Pages remains the existing testing deployment. No new infrastructure was created and no production domain cutover was performed.
