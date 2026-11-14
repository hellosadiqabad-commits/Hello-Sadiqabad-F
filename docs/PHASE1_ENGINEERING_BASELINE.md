# Phase 1 — Engineering Foundation Record

## Implemented on `phase-1/codebase-foundation`

- Normalized npm package identity to `hello-sadiqabad@1.0.0`; package-lock root metadata is synchronized.
- Added a pure public-runtime configuration resolver. It validates Supabase URLs, enforces HTTPS for production, permits localhost HTTP only in development, validates the default city slug, normalizes the site URL, and reports missing production settings.
- Replaced ad-hoc Supabase environment parsing with the shared resolver. Only the public publishable key is accepted by the browser client; service-role credentials are explicitly prohibited from browser environment variables.
- Added unit tests for missing configuration, valid production configuration, insecure production URLs, local development URLs, missing publishable keys, and malformed site/city values.
- Hardened Supabase auth hydration: missing profile data, permission RPC denial, or profile/permission network failures now fail closed instead of retaining a portal role. Session bootstrap always clears its loading state after failure.
- Improved the global React error boundary: raw exception messages are no longer shown to visitors; the fallback has accessible alert semantics and both retry and full-reload actions.
- CI now has read-only repository token permissions, concurrency cancellation, a 15-minute job timeout, an explicit TypeScript check, automated tests, and a production build.
- Replaced the vulnerable npm-registry SheetJS 0.18.5 release with the official patched SheetJS 0.20.3 tarball; existing spreadsheet import/export API and tests are retained. CI dependency audit now reports zero advisories and blocks high/critical findings.
- Added the phased completion roadmap and corrected the Supabase region documentation.

## Verification

The PR checks must pass on the latest head commit before this phase is considered ready for review:

1. `npm ci`
2. `npm run typecheck`
3. `npm test`
4. `npm run build`

The npm audit report is diagnostic only at this stage. Any high/critical advisory must be investigated, documented, and fixed or explicitly accepted with a reason before final production readiness.

## Deliberately not changed

- No Supabase schema, live records, Auth dashboard settings, Storage buckets, Cloudflare Worker, Pages settings, or production deployment were modified.
- No database baseline was replayed and no migration was applied to the connected Supabase project.
- No dependency was removed merely because a text search did not find a use; dependency removal requires a full import/runtime/build audit.
- The existing migration ledger mismatch remains a Phase 6 task and must be reconciled before any schema deployment.
