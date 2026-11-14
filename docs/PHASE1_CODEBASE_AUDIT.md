# Hello Sadiqabad — Phase 1 Codebase Audit

Audit snapshot: 2026-11-15  
Repository: `samt87804-gif/Hello-Sadiqabad`  
Audited ref: `main` at `29cbaaf572f3b682d5e40b5ebc3ca9e6a306b4df`

> Status: Phase 1 is in progress. This is a source-backed first-pass inventory and risk register, not a final release approval. Component-by-component UI, browser, accessibility and end-to-end verification remain open.

## 1. Repository and CI inventory

| Area | Verified state |
|---|---|
| Default branch | `main` |
| Recursive Git tree | 198 entries; not truncated |
| React source files | 94 |
| Automated test files | 12 Node test files under `src/lib` |
| Supabase Edge Function entrypoints | 7 |
| SQL migration files in repository | 11 |
| Latest main commit at audit start | `29cbaaf572f3b682d5e40b5ebc3ca9e6a306b4df` |
| Latest main CI run | [Run 43638378006](https://github.com/samt87804-gif/Hello-Sadiqabad/actions/runs/43638378006) — both `build` and `edge-functions` jobs succeeded |
| PR #8 | Closed, not merged; its PR CI run [43629260712](https://github.com/samt87804-gif/Hello-Sadiqabad/actions/runs/43629260712) succeeded |
| Branch protection | GitHub branch metadata reports `main` as unprotected |
| Root README | No `README.md` currently exists |

CI currently runs `npm ci`, a blocking high/critical `npm audit` gate, TypeScript, Node tests, Vite production build and Deno type-checking for Edge Functions. Dependabot is configured weekly for npm and GitHub Actions. The test suite is not a browser E2E suite and does not run live database/RLS tests.

## 2. Architecture observed in source

- Frontend: React 19, TypeScript, Vite 8, React Router 7, Tailwind CSS 4.
- Data access: a large shared `src/lib/api.ts` module (about 2,568 lines) wraps Supabase queries and local demo/cache behavior.
- Authentication: Supabase Auth with an application Auth context; demo-only local browser accounts are gated by runtime configuration.
- Authorization: route guards and a frontend staff permission map in `src/lib/permissions.tsx`; database authorization is implemented separately through RLS and private SQL helpers.
- Maps: Leaflet.
- Media: HTTPS URL fields and externally hosted media; there are no current Storage buckets.
- PWA: web manifest, service worker, icons and install control. The service worker deliberately caches only the offline fallback page; this is not a full offline directory.
- Localization: bilingual English/Urdu support through the i18n context and bilingual data fields.

## 3. Route and feature inventory

### Public routes
- `/` — Home
- `/search` — search and filtering
- `/categories`, `/category/:slug` — category discovery
- `/area/:slug` — area directory
- `/business/:slug` — business profile
- `/offers` — offers
- `/add-business` — listing request
- `/map` — map/list discovery
- `/favorites` — browser-local favorites/recently viewed
- `/emergency` — emergency directory
- `/announcements` — announcements

### Static/legal routes
- `/about`, `/advertise`, `/contact`, `/terms`, `/privacy`, `/listing-terms`, `/refund-policy`, `/faq`

### Authentication routes
- `/login`, `/forgot-password`, `/reset-password`, protected `/change-password`
- No public signup/owner-application route is present in the current route table.

### Owner routes
- `/owner`, `/owner/listing`, `/owner/listings/:id`, `/owner/offers`, `/owner/reviews`, `/owner/inquiries`, `/owner/analytics`, `/owner/plan`, `/owner/profile`, `/owner/notifications`
- Routes require authentication and the `owner` role. Owner data loading calls owner-scoped API methods; database RLS remains the security boundary.

### Admin/staff routes
- `/admin` redirects to `/admin/overview`; `/admin/:tab` contains tab-based modules.
- Source modules cover dashboard, businesses/moderation, inquiries, leads, quality, import/export, owners, ads, plans, categories, areas, emergency contacts, announcements, staff, settings, analytics and audit logs.
- UI visibility and data loading use permission checks, but every data mutation still needs matching database authorization tests.

A route existing in `App.tsx` is not proof that its complete user journey works. Full interactive verification is still pending.

## 4. Existing tests

The 12 current test files cover CSV import, Edge Function validation helpers, formatting, opening hours, offers, open-now behavior, owner portal pure logic, password validation, phone normalization, regression helpers, runtime configuration and search filtering.

The latest main CI run confirms the current suite passes. Coverage gaps:
- No Playwright/Cypress browser journey suite is present in the repository tree.
- No repeatable database/RLS test job is present in GitHub Actions.
- Existing owner portal tests are primarily pure/local logic tests, not authenticated multi-user isolation tests.
- No automated mobile viewport, accessibility or broken-link checks are configured.

## 5. Live testing Supabase snapshot

Read-only checks against the connected testing project returned:

| Item | Observed |
|---|---:|
| PostgreSQL | 17.11 |
| Public tables | 25 |
| Public tables with RLS enabled | 25 |
| Businesses | 123 |
| Published businesses | 123 |
| Businesses linked to an owner | 0 |
| Areas | 204 |
| Profiles / Auth users | 2 / 2 |
| Submissions | 0 |
| Plans | 3 |
| Storage buckets | 0 |
| Subscription / invoice / payment lifecycle tables | 0 |
| Active Edge Functions | 7 |
| Live migration history entries | 25 |

Current plan codes are `free`, `basic`, `premium`. The plan schema has JSONB `limits` and `features` plus a text `price_note`; it does not currently provide numeric price and billing-cycle fields or subscription/invoice/payment history tables.

The live migration ledger contains 25 entries while the repository contains 11 SQL files, including a consolidated baseline and selected later migrations. This is a clean-bootstrap/reproducibility blocker until the migration history is reconciled. Do not replay the baseline against the existing project.

The current private setting `owner_edits_require_approval` is `false`; `reviews_require_approval` is `true`. No existing business was reassigned during this audit.

## 6. Findings and priorities

### Critical / high — address before enabling the relevant production workflow

1. **Admin account provisioning email validation defect — fix prepared on this audit branch.** The Admin create-user Edge Function imported the shared tested `isValidEmail` helper but used a separate malformed inline regular expression. Testing common valid addresses against that exact expression returned false. The branch switches to the shared validator and uses the existing bounded JSON reader with a 16 KB request limit. It does not deploy or change the live Edge Function.
2. **Owner onboarding/approval workflow is incomplete.** There is no public owner registration/application route. The profile schema defaults `role='owner'` and `is_active=true`, and the auth profile trigger must be treated as a conditional risk if public Supabase signup is enabled. Deployment documentation says public signup should be disabled, but the current Auth dashboard setting was not independently verified. Before enabling signup, implement an explicit pending application/approval state and fail-closed access. Admin-created owner accounts are currently provisioned through the privileged Admin function.
3. **Public endpoint abuse resistance is partly client-identity based.** Public review and inquiry endpoints use hashed author/phone identities plus a client-provided session ID. A browser can rotate those identifiers; CORS is not an authentication or abuse-prevention boundary. Review the current limits and add trusted edge/IP-based controls or equivalent abuse controls before public launch.
4. **Fresh-project migration reproducibility is not established.** The 25-entry live ledger and 11-file repository migration set do not form a directly replayable clean-install history. Reconcile historical migrations and generate/test a deterministic fresh-project bootstrap before infrastructure transfer.
5. **Subscription lifecycle is not implemented.** Plan catalogue metadata exists, but no subscription, invoice, payment or renewal-history model exists. Implement the plan/subscription data model only after recording the unresolved billing and expiry rules; do not add a payment gateway before owner approval.

### Medium — required before release readiness

6. **Storage/media workflow is absent.** There are zero Supabase Storage buckets; current business media use HTTPS URL fields. Prepare a portable upload adapter and R2-compatible abstraction later; do not create R2 resources now.
7. **Testing environment identifiers are coupled to the repository.** `supabase/config.toml` contains the current testing project reference, and runtime/deployment documentation defaults to the current Pages hostname while labelling it a production URL. Separate local defaults from environment-specific configuration during portability work.
8. **Deployment instructions are not aligned with the owner’s current testing-only strategy.** `DEPLOYMENT.md` describes the current Pages hostname as production. Rewrite it as a testing deployment note and document fresh-project release steps separately when that phase is approved.
9. **No root README.** A clean setup, local development and contributor entrypoint is missing.
10. **No browser E2E or visual/accessibility QA automation.** Add critical journeys and mobile/accessibility checks after the route-level audit.
11. **Leaked-password protection is disabled** in the current Supabase Auth security advisor. It is a warning in the testing project; add it to the fresh Auth configuration checklist. Do not change dashboard settings during this code-only audit.
12. **Main branch has no protection rule.** This is an operational risk; enable required checks/review on the future repository. The current owner has asked for no new account/repository setup yet.
13. **`metadata.json` has an empty `majorCapabilities` array.** Review project metadata and SEO/social metadata during the discoverability pass.
14. **PWA is intentionally partial.** Only the offline fallback is cached; do not market this as a full offline directory.

### Low / informational

15. Supabase Performance Advisor reports 20 unused-index notices in this low-traffic testing project. Do not drop indexes without production-like query evidence.
16. Several Dependabot PRs are open, including major-version updates. Review compatibility and CI individually; do not bulk-merge dependency PRs.

## 7. Business decisions still intentionally unresolved

- Paid plan prices and exact monthly/quarterly/yearly entitlements.
- Manual payment verification versus online payment gateway.
- Owner application fields, verification evidence and approval process details.
- Grandfathering/ownership verification for the 123 existing published businesses.
- Plan expiry and grace-period behavior.
- Free plan limits and paid feature caps.
- Refund/cancellation policy.
- Advertising packages and pricing.
- Future AI feature scope.

These are not to be hardcoded by engineering assumptions.

## 8. Next implementation sequence

1. Complete the route/component/API/Edge Function source audit and update the feature-by-feature matrix.
2. Complete the Admin provisioning validation fix and CI verification in this branch.
3. Review public endpoint abuse controls and owner onboarding design without changing Auth dashboard settings.
4. Add repeatable database/RLS regression tests to CI using isolated test fixtures.
5. Add browser E2E coverage for visitor, Admin, staff and Owner critical journeys.
6. Complete public website and Admin/Owner functional audits.
7. Design subscription schema around the confirmed business rules; keep payment integration blocked pending owner decision.
8. Reconcile migrations and produce a fresh-project bootstrap guide.
9. Complete SEO, accessibility, mobile and performance passes.
10. Run the final codebase release audit only after all critical/high findings are closed or explicitly blocked by a documented owner decision.

## 9. Scope boundaries respected

- No new Gmail, GitHub, Supabase or Cloudflare accounts/projects were created.
- No production infrastructure was set up.
- No live Edge Function deployment or Auth dashboard configuration was changed.
- No destructive database operation or business-row ownership assignment was performed.
- Existing 123 published businesses remain unlinked to owners pending evidence and owner policy.


## 10. Six-document specification conformance and cross-document conflicts

The uploaded `Hello SDK.zip` contains the six source documents (PRD, TRD, App Flow, UI/UX Brief, Backend Schema and Implementation Plan). `Website_Builder_Master_Prompt_v5` defines the original workflow. The repository has been compared against those documents as well as the newer handover supplied in this conversation.

### Confirmed implementation matches
- React + TypeScript + Vite, React Router lazy routes, Supabase browser client via public environment variables, Leaflet, QR, bilingual i18n provider, theme provider, SEO/LocalBusiness JSON-LD, search load-more, favorites/recently-viewed, emergency contact local cache, safe Markdown renderer, CSV/XLSX import, Admin/Owner modules and seven planned Edge Function names are present.
- English/Urdu language state and the `hs_urdu_hints` toggle exist; Urdu hints default to enabled.
- The original v2 plan catalogue is informational (`free/basic/premium`) and the current database follows that model.
- No Supabase Storage buckets exist, matching the original PRD/TRD/Backend Schema v2 scope.

### Confirmed specification gaps
1. **PWA update prompt:** `main.tsx` dispatches the `hs-sw-update` event, but no `PwaUpdateToast` component or listener is present in the repository tree. The TRD and Implementation Plan require an update prompt.
2. **Cloudflare SPA redirect file:** `public/_redirects` is absent, although TRD/Implementation Plan explicitly require the SPA fallback file. Cloudflare Pages may provide fallback behavior without it when no root 404 exists, but the repository does not meet the documented file-level acceptance check.
3. **Offline app shell:** `public/sw.js` explicitly caches only `offline.html`, not the app shell. Emergency contacts are stored in localStorage, but the React Emergency route cannot be assumed to load offline if the app JS was never cached. This is below the TRD's app-shell/offline requirement and must be tested on an actual browser.
4. **Bilingual portal UI:** `src/pages/owner/OwnerPortalPages.tsx` and the Admin component modules contain substantial English-only labels and do not consume the shared i18n context. The i18n dictionary and some public screens are bilingual, but this does not prove every Admin/Owner UI string is bilingual as required by PRD/Implementation Plan.
5. **Owner preview route discrepancy:** App Flow and Implementation Plan allow staff/Super Admin preview of `/owner`; current `App.tsx` guards Owner routes to role `owner` only. The newer handover says Owner Portal access follows approval and does not clearly authorize staff preview. Treat as a documented policy/spec conflict, not an automatic code change.
6. **Permission matrix drift:** PRD §4.5 gives `moderator` `business.publish` and `ads.review`; `listing_manager` receives `tiers.manage`, `ads.review`, `analytics.view`; `sales_onboarding` receives only `leads.manage` and `owners.create`. Current frontend `STAFF_TYPE_PERMISSIONS` and live SQL derivation differ from that PRD matrix (for example, frontend grants `tiers.manage`/`ads.review` to sales_onboarding and does not grant publish/ads to moderator). Do not silently choose a matrix; align only after the owner confirms which source version governs.
7. **Review reply rule:** PRD and App Flow describe one owner reply per review; recent repository changes support editing/updating an existing reply. Confirm whether the newer behavior intentionally supersedes the original one-reply rule.
8. **Admin create-user input validation:** The shared `isValidEmail` helper has valid-email unit tests, but the Edge Function had a malformed duplicate regex at its call site. PR #9 fixes the call site and bounds the JSON request body; CI is still pending.

### Requirements conflict between the newer handover and the six original project documents

The newer handover in this conversation is more recent, but it intentionally changes several original v2 scope decisions. These must remain visible until the relevant implementation phase; they must not be silently reconciled:

| Topic | Six original documents | Newer handover in this conversation |
|---|---|---|
| Payments/subscriptions | PRD §5 and §8, TRD §1/§12 and Implementation Plan §1/§8 explicitly say informational tiers only; no payment, checkout or subscription billing | Requests monthly/quarterly/yearly plan cycles and a subscription lifecycle design; payment method remains undecided |
| Media storage | PRD/TRD/Backend Schema explicitly say no Supabase Storage buckets; use HTTPS media URLs | Target architecture includes Cloudflare R2 and a future media workflow |
| AI | PRD/TRD/Implementation Plan say no AI features and no AI Gateway in v2 | Target architecture includes Workers AI and AI Gateway for future expansion |
| Owner onboarding | PRD/Backend Schema say owner accounts are Admin-created or linked through an approved claim; no public signup | Newer handover describes owner application/registration followed by Admin verification/approval |
| Release workflow | Master Prompt v5 says future code changes use PRs and owner merges | This remains consistent with the latest handover's phase-wise Git workflow; do not merge without owner approval |

The newer handover is the active execution brief for this conversation. For now, code remains portable and payment collection, AI, R2 provisioning, public signup/Auth dashboard changes and fresh infrastructure are deferred. At the subscription/media/AI/onboarding phases, update the relevant six documents together after owner policy is confirmed.

### Current scope conclusion

Phase 1 inventory and first-pass spec comparison are substantially documented, but Phase 1 is **not complete** until the remaining page/component/API/Edge Function audits, actual browser journeys, responsive/accessibility checks and repeatable DB/RLS tests are complete. The findings above feed the implementation roadmap; they are not a declaration that the features have been fixed.
