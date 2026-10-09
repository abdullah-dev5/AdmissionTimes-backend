# Supabase schema vs codebase mismatches

Generated: 2026-06-02 (live query via `scripts/introspect-db-schema.js`)

Live schema snapshot: [DB-LIVE-SCHEMA.md](./DB-LIVE-SCHEMA.md)

## Summary

| Severity | Count | Theme |
|----------|-------|--------|
| High | 2 | `verification_status.disputed` vs app constants; contract fields treated as DB columns |
| Medium | 4 | Legacy notification names in docs/seeds; `users.role` vs `user_type` naming |
| Low | 5 | DB columns missing from core `Admission` type; enum values only in DB |

---

## Live tables (20 base tables)

`admin_audit_logs`, `admissions`, `analytics_events`, `changelogs`, `deadlines`, `email_delivery_logs`, `notifications`, `push_delivery_logs`, `push_notification_tokens`, `recommendations`, `reminder_delivery_logs`, `schema_migrations`, `scraper_ingestion_events`, `scraper_ingestion_runs`, `seed_tracking`, `universities`, `user_activity`, `user_preferences`, `users`, `watchlists`

**View (not a table):** `admissions_needing_reverification` — exposed in column introspection only.

---

## 1. `admissions` — columns in DB but missing from `Admission` interface

**Live DB has** (not on `src/domain/admissions/types/admissions.types.ts` `Admission`):

| Column | Type | Notes |
|--------|------|--------|
| `dispute_reason` | text | Present in initial migration; omitted from TS interface |
| `admin_notes` | text | Admin workflow |
| `verification_comments` | text | Admin workflow |
| `needs_reverification` | boolean | Re-verification flag |
| `updated_by` | uuid | Audit |
| `data_origin` | text | Scraper/manual — used in `admin.model.ts` |
| `source_system` | text | Scraper pipeline |
| `source_url` | text | Scraper pipeline |
| `source_record_hash` | text | Scraper pipeline |
| `source_last_seen_at` | timestamptz | Scraper pipeline |
| `ingestion_run_id` | uuid | Scraper pipeline |

**Code references:** `admin.types.ts`, `admin.model.ts`, `scraper-integration.service.ts` use scraper columns; core `Admission` type does not, so strict typing under-reports the row shape returned from SQL `SELECT *`.

**Mismatch:** `university_id` is **NOT NULL** in live DB but `Admission.university_id` is `string | null`.

---

## 2. Contract v2 fields — API layer only (not DB columns)

These appear on responses and in `admissionContract.ts` / dashboard types but **do not exist** on `admissions`:

- `contract_version`, `degree_label`, `degree_type`, `deadline_iso`, `days_remaining`, `program_status`, `fee_amount`, `fee_display`, `eligibility_text`, `university_website_url`, `admission_portal_url`, `primary_apply_url`, `status_label`, `match_label`

**Impact:** AI compare (`comparePrograms.service.ts`) reads `admission.eligibility_text`; value is usually `undefined` unless mapped from `requirements`/`description` via `normalizeAdmissionContract()` before compare.

**Action:** Ensure compare/search paths run contract normalization, or document as derived-only fields.

---

## 3. `verification_status` enum — `disputed` still in DB

**Live enum values:** `draft`, `pending`, `verified`, `rejected`, **`disputed`**

**App (`src/config/constants.ts`):** Only `draft`, `pending`, `verified`, `rejected` — no `disputed`.

**Migration `20260324000003_normalize_disputed_to_rejected.sql`:** Converts existing rows and adds trigger `normalize_disputed_status_to_rejected` so new writes of `disputed` become `rejected`.

**Mismatch:**

- Enum label `disputed` still exists in Postgres (changelog `change_action_type` also keeps `disputed`).
- Seeds (`seed_admissions.sql`, `changelogs.seed.ts`) still insert `disputed`.
- TypeScript `VerificationStatus` excludes `disputed`; runtime rows could still surface if trigger bypassed.

**AI chat** filters use `'verified' | 'pending' | 'rejected'` only — aligned with app constants, not full DB enum.

---

## 4. `notifications` — schema aligned; legacy names elsewhere

**Live columns:** `recipient_id`, `role_type`, `notification_type`, `event_key` (required), plus standard title/message/priority fields.

**Code:** `notifications.model.ts`, `notifications.service.ts`, `pushDelivery.ts` use `recipient_id` / `role_type` / `notification_type` — **match**.

**Legacy mismatch (docs/seeds only):**

- Initial migration used `user_id`, `user_type`, `category` (`notification_category` enum).
- Some seed files or comments may still say `user_id` / `category`.

**Dropped enum:** `notification_category` replaced by `notification_type` — no code issue if migrations applied.

---

## 5. `users` — column naming

| Live DB | Common code/docs |
|---------|------------------|
| `role` (`user_type` enum) | Auth DTOs often say `user_type` |
| `university_id` | Renamed from `organization_id` (migration `20260225000001`) |
| `auth_user_id`, `email`, `password` | Auth integration |

**Mismatch:** `auth.types.ts` uses `user_type` on registration payloads; DB column is `role`. Service layer maps correctly at runtime, but naming is inconsistent for new contributors.

**Enum:** Live `user_type` includes **`maintenance`**; `USER_TYPE` constant includes it — OK.

---

## 6. `activity_type` enum — extended in DB

**Live values:** `viewed`, `searched`, `compared`, `watchlisted`, `alert`, `saved`, `deadline`, `notification`

**Initial schema:** Only first four.

**Mismatch:** If any validator or frontend enum lists only the original four, new activity types will fail validation. Backend migration `20260401000001_extend_activity_type_enum.sql` matches live DB.

---

## 7. `deadlines` — reminder columns

**Live:** `reminder_sent_7d_at`, `reminder_sent_3d_at`, `reminder_sent_1d_at` (migration `20260313000001`)

**Core deadline types:** May still document only `reminder_sent` boolean — check domain types if adding typed queries.

---

## 8. Tables in DB with no first-class domain module

| Table | Used by |
|-------|---------|
| `email_delivery_logs` | Email delivery |
| `reminder_delivery_logs` | Deadline reminders |
| `push_delivery_logs` | Push delivery |
| `push_notification_tokens` | Push tokens |
| `scraper_ingestion_*` | Scraper integration |
| `admin_audit_logs` | Admin audit |
| `schema_migrations` | Migration runner |

Not mismatches per se — intentional separation from core admissions CRUD.

---

## 9. AI search vs DB attributes (query behavior)

Search uses `SEARCH_FIELDS`: `title`, `description`, `program_type`, `degree_level`, `field_of_study`, `location`.

**Fixed in this pass:** AI chat no longer stacks `field_of_study` + `degree_level` when program codes (BBA, CS, etc.) are present; uses `admissionSearchFilters.service.ts` search-first policy.

**Data quality note:** Many rows have **null** `field_of_study` / `degree_level` with program name only in `title` — strict column filters were excluding valid results; search-first is required for production recall.

---

## Recommended follow-ups

1. Extend `Admission` interface (or `AdmissionRow` + `AdmissionDTO`) with scraper and admin columns used in SQL.
2. Remove or update seeds referencing `verification_status = 'disputed'`.
3. Optionally `ALTER TYPE ... DROP VALUE 'disputed'` after confirming zero rows (Postgres enum surgery).
4. Run `normalizeAdmissionContract()` before AI compare when `eligibility_text` is needed.
5. Align auth docs: `user_type` (API) vs `role` (DB column).
