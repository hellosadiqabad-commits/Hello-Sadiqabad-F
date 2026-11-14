# Phase 1 — Engineering Foundation Record

## Implemented on `main`

### Frontend and repository foundation
- Normalized npm package identity to `hello-sadiqabad@1.0.0`; package-lock root metadata is synchronized.
- Removed unused direct frontend dependencies (`@google/genai`, `express`, `dotenv`, and `@types/express`) after scanning application source imports. AI dependencies will be added when approved AI features are implemented.
- Added a pure public-runtime configuration resolver. It validates Supabase URLs, enforces HTTPS for production, permits localhost HTTP only in development, validates the default city slug, normalizes the site URL, and reports missing production settings.
- Replaced ad-hoc Supabase environment parsing with the shared resolver. Only the public publishable key is accepted by the browser client; service-role credentials are explicitly prohibited from browser environment variables.
- Added tests for runtime configuration, invalid/valid environments, import file size, Edge Function validation helpers, bounded JSON parsing, and hashed rate-limit identities.
- Added a 20 MB upload limit for both CSV and Excel import files before reading them into browser memory.
- Hardened auth hydration against stale asynchronous session responses. Prior-user roles and permissions are cleared while a new session is verified; out-of-order responses cannot restore old privileges.
- Sign-in now fails closed if the profile row or permissions RPC cannot be verified.
- Owner Portal routes now require the `owner` role. Staff/Super Admin preview access is intentionally not exposed until a separate, read-only preview mode is implemented.
- Added explicit loading, failure, cancellation, and retry handling to Category, Area, Map, Favorites, Business Profile, Add Business, and Offers public routes. Non-critical search telemetry failures no longer become unhandled promise rejections.
- Connected public categories, areas, plans, emergency contacts, announcements, ads, and static pages to Supabase reads, retaining seed/cache fallbacks for offline/demo behavior.
- Implemented the previously empty public Offers data path using active, date-valid Supabase offers and their published business profiles.
- Public directory data now merges published Supabase business rows with crawl-only static Google Places records. Database-backed static snapshots are replaced by live published records; if publication status cannot be verified, stale database-backed snapshot rows are withheld. Public business hydration omits internal moderation assignment/creator fields.
- Improved the global React error boundary: raw exception messages are no longer shown to visitors; the fallback has accessible alert semantics and retry/reload actions.
- Replaced the vulnerable npm-registry SheetJS 0.18.5 release with the official patched SheetJS 0.20.3 tarball; existing spreadsheet import/export API and tests are retained.
- Removed unused direct app dependencies after scanning source imports. The lockfile retains transitive metadata required for deterministic installs.

### Supabase Edge Function hardening
- Added shared Edge Function helpers for bearer-token extraction, email/UUID validation, bounded JSON-object parsing, and SHA-256 hashed rate-limit identities.
- Added and tested shared bearer-token and email validation helpers. The Phase 1 source audit found that `admin-create-user` still duplicated email validation with a malformed inline regex despite importing the shared helper; the audit branch now switches the call site to `isValidEmail` and bounds the request body to 16 KB. The branch is not merged or deployed yet.
- Hardened Admin user creation: verified actor permissions, strict input validation, owner-only explicit business assignment, safe errors, and best-effort rollback if profile/staff/business provisioning fails.
- Hardened Admin password reset: strict Super Admin verification, valid target UUID, 12–128 character temporary password, no-store response, and first-login password-change flag.
- Hardened account activation/deactivation: Super Admin checks, strict UUID/body validation, safe self-protection, checked database updates, and best-effort rollback for partial failures.
- Reworked public inquiry and review functions with bounded JSON bodies, strict UUID and field validation, published-listing checks, fail-closed plan/rate-limit checks, and layered session plus hashed phone/author rate limits.
- Reworked public suggestion/claim intake with bounded object payloads, validated business/contact fields, hashed phone rate limiting, authenticated owner linking, and safe error responses.
- Reworked event tracking with bounded JSON, strict event/business/ad validation, checked RPC failures, and safer search-filter validation.
- Request-body limits are enforced while streaming Edge Function bodies, rather than after loading an unbounded body into memory.
- Edge Function CORS defaults now include Vite development origins (`localhost:5173` and `127.0.0.1:5173`) in addition to the configured Pages/custom hosts.
- Admin Portal data loading now respects each staff permission before querying protected tables; unauthorized datasets are not fetched. Admin/owner read errors no longer silently fall back to demo records.
- All seven Edge Function entry points are now type-checked by Deno in CI.

### Backend authorization hardening
- Applied four additive, non-destructive migrations to the connected testing Supabase project: `20261114202955`, `20261114203132`, `20261114203234`, and `20261114203404`.
- Staff `business.edit_own` updates are now row-scoped to listings they created or were assigned; the permission no longer bypasses protected-column checks.
- Only staff with `business.publish` (default: listing_manager) can change protected moderation, ownership, plan, verification, feature, counter, and publication fields.
- Staff-created listings are database-enforced as their creator's unassigned, unverified, free drafts/pending submissions unless the actor has `business.publish`.
- The private `owner_edits_require_approval` setting is now enforced by a database trigger; the browser no longer tries to read the private setting. Current setting remains `false`.
- Owner updates are restricted to the exact fields exposed by the Owner Listing Editor; immutable IDs, city, slug, and creation metadata are blocked.
- Live rollback-only SQL regression checks passed for all six staff types, staff row isolation, protected fields, owner field allow-list, and owner approval switch ON/OFF behavior.
- `adminUpsertBusiness` now records `created_by` for new staff-created listings so row scoping works reliably.
- Existing business rows were not modified; all test fixtures and temporary setting changes were rolled back.

### CI and deployment verification
- GitHub Actions uses read-only repository token permissions, concurrency cancellation, 15-minute job timeouts, explicit TypeScript checks, tests, production builds, and a blocking high/critical npm audit gate.
- A separate Deno CI job type-checks every Supabase Edge Function.
- Dependabot checks npm packages and GitHub Actions weekly.
- Latest verified application-code commit for this batch: `efe2e9eb708b3f8e19fad3ab4119ba5bd0e54ef2`.
- Latest verified CI for that code commit: https://github.com/samt87804-gif/Hello-Sadiqabad/actions/runs/43638256514 — npm install, high/critical dependency audit gate, TypeScript, automated tests, production build, and Deno Edge Function type-check all passed.
- Latest Cloudflare Pages production-environment deployment for the testing project: https://bb881cd7.hello-sadiqabad-2bs.pages.dev — commit `efe2e9e`, build and deploy stages successful.
- Cloudflare Pages check for the same commit completed successfully.

## Still open in Phase 1
- Full component-by-component audit of every admin and owner route, plus remaining public route actions and data states.
- Repeatable CI automation for database/RLS regression tests; current rollback-only checks were executed directly against the connected testing project.
- End-to-end browser journeys for the full public directory and portal workflows.
- Dead/duplicate code audit with proof of non-use before deletion.
- Accessibility, mobile interaction, broken-link, SEO and resilience passes.
- Reconcile migration history and clean-project setup instructions without applying migrations to the connected test database.

## Deliberately not changed
- Four additive migrations were applied to the connected testing Supabase project; no baseline replay, table rebuild, destructive data operation, or permanent business-row fixture change was performed.
- Supabase Auth dashboard settings, Storage buckets, Edge Function deployments, and Cloudflare Worker/R2 infrastructure were not changed.
- Existing listings were not bulk-assigned to owners. The 123 existing businesses still have 0 owner links.
- Main-branch commits trigger Cloudflare Pages automatically. The latest application-code deployment passed; no custom domain, DNS, or Worker was changed.
- The repository still has a consolidated baseline plus a subset of historical migrations, while the live migration ledger contains 25 entries. Reconcile this carefully before clean-project setup or any future schema push.
