# Phase 1 Security Review — Backend Enforcement Still Required

This file records security gaps found while auditing the connected test project. No Supabase schema or live data changes were made.

## High priority: owner listing updates are not fully enforced by RLS

### Observed state
- The live `businesses_update` policy permits the current owner to update a row when `owner_id = auth.uid()`.
- Its `WITH CHECK` condition also verifies ownership, but does not restrict which business columns an owner can update.
- The browser API helper removes protected fields and can set `status = 'pending_approval'` when its approval setting says so. This is application logic, not a database security boundary.
- The live `site_settings.owner_edits_require_approval` row is private (`is_public = false`). Public site settings reads cannot see it; the browser helper currently retains the seeded default for this private setting.
- Therefore a direct authenticated Supabase REST request can bypass the browser helper and attempt to change fields such as `status`, `plan_code`, `is_verified`, or `is_featured`, subject to the current broad owner update policy.

### Required backend fix (not applied)
Prepare a reviewed migration that:
1. Restricts owner updates to an explicit allow-list of owner-editable columns.
2. Prevents owners from changing `owner_id`, `status`, `plan_code`, verification/feature flags, moderation fields, assignment fields, and internal counters.
3. Enforces the private `owner_edits_require_approval` setting in a database trigger or trusted server-side update function, not in the browser.
4. Moves publication/status transitions to Admin-controlled functions.
5. Adds SQL regression tests using an authenticated owner JWT for both allowed and denied column updates.

Do not treat this workflow as fully secure until the migration and direct-API tests are applied to the test database and verified. A schema migration has intentionally not been created or applied pending user approval.

## Medium priority: public endpoint abuse controls
- Inquiry and suggestion submissions use session rate limits plus SHA-256 hashed phone identities.
- Review submissions use session limits plus hashed author-name identities.
- The session identifier is client-controlled, and phone/name values can be rotated. These controls are defense-in-depth, not a complete IP-based abuse barrier.
- Before launch, add a trusted edge-IP rate limit and/or Turnstile protection after confirming the trusted request headers and deployment path. Do not trust arbitrary client-supplied `X-Forwarded-For` values.

## Medium priority: owner edit approval setting
- `owner_edits_require_approval` is currently private in `site_settings`.
- The public settings client now reads public settings dynamically, but it intentionally cannot read this private value.
- The current UI helper therefore cannot reliably reflect future Admin changes to this private setting. The database-level fix above must be completed before relying on this switch.

## Account provisioning
- Preset owner/staff passwords have been removed from the UI.
- Temporary passwords are required to be at least 12 characters and the first-login password-change flag is set.
- Admin provisioning still uses a manually supplied temporary password; a verified email invitation/reset workflow remains future work.
- Public self-registration is not implemented. Do not enable Supabase public signups until new users are created inactive/pending and an explicit Admin approval workflow is implemented.

## Deployment boundary
- Edge Function source changes are committed to GitHub and Deno type-checked in CI.
- These function changes have not been deployed to the connected Supabase project. The currently deployed Edge Functions remain unchanged until a separate deployment is explicitly approved.
- No Supabase schema, RLS policy, Auth setting, or live record was modified during this audit.
