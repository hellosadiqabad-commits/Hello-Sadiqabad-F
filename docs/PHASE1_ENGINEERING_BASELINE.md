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
- Fixed malformed bearer-token and email validation patterns in Admin account provisioning. These patterns were not caught by the original frontend-only CI; regression tests now cover them.
- Hardened Admin user creation: verified actor permissions, strict input validation, owner-only explicit business assignment, safe errors, and best-effort rollback if profile/staff/business provisioning fails.
- Hardened Admin password reset: strict Super Admin verification, valid target UUID, 12–128 character temporary password, no-store response, and first-login password-change flag.
- Hardened account activation/deactivation: Super Admin checks, strict UUID/body validation, safe self-protection, checked database updates, and best-effort rollback for partial failures.
- Reworked public inquiry and review functions with bounded JSON bodies, strict UUID and field validation, published-listing checks, fail-closed plan/rate-limit checks, and layered session plus hashed phone/author rate limits.
- Reworked public suggestion/claim intake with bounded object payloads, validated business/contact fields, hashed phone rate limiting, authenticated owner linking, and safe error responses.
- Reworked event tracking with bounded JSON, strict event/business/ad validation, checked RPC failures, and safer search-filter validation.
- All seven Edge Function entry points are now type-checked by Deno in CI.

### CI and deployment verification
- GitHub Actions uses read-only repository token permissions, concurrency cancellation, 15-minute job timeouts, explicit TypeScript checks, tests, production builds, and a blocking high/critical npm audit gate.
- A separate Deno CI job type-checks every Supabase Edge Function.
- Dependabot checks npm packages and GitHub Actions weekly.
- Latest verified commit for this batch: `d51e1053a12725af0957860e2dbf1240054ac4bf`.
- Latest verified CI: https://github.com/samt87804-gif/Hello-Sadiqabad/actions/runs/43627453013 — npm install, npm audit, TypeScript, 60/60 tests, production build, and Deno Edge Function type-check all passed.
- Cloudflare Pages check for the same commit completed successfully.

## Still open in Phase 1
- Full component-by-component audit of every admin and owner route, plus remaining public route actions and data states.
- Backend/RLS ownership matrix tests and direct unauthorized API regression tests.
- End-to-end browser journeys for the full public directory and portal workflows.
- Dead/duplicate code audit with proof of non-use before deletion.
- Accessibility, mobile interaction, broken-link, SEO and resilience passes.
- Reconcile migration history and clean-project setup instructions without applying migrations to the connected test database.

## Deliberately not changed
- No Supabase schema, live records, Auth dashboard settings, Storage buckets, or Worker configuration was changed.
- No database baseline was replayed and no migration was applied to the connected Supabase project.
- Existing listings were not bulk-assigned to owners.
- Main-branch commits trigger the connected Cloudflare Pages build/deployment pipeline. The latest Pages check passed; no custom domain, DNS, or Worker was changed.
- The existing migration ledger mismatch remains a later backend-integrity task and must be reconciled before any schema deployment.
