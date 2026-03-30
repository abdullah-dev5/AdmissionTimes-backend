# Preferences Alignment Gap Report

Date: 2026-03-30
Scope: backend preference contract, Swagger consistency, and delivery behavior

## Summary

The preference system is user-scoped and functionally integrated with notification delivery. Primary remaining issues are contract consistency and update-safety behavior.

## Verified Facts

- Preference routes are under `/api/v1/users/me/preferences`.
- JWT middleware protects `/api/v1/*` routes except intended public auth paths.
- Delivery paths consult user preference channels/categories before side effects.

## Key Gaps

1. Swagger drift on `email_frequency`
- Runtime/validator supports `immediate` only.
- Historical docs listed unsupported values.

2. Partial category update safety
- Partial `notification_categories` updates can overwrite object values if not merge-safe in implementation.

3. PUT/PATCH semantics clarity
- If both are partial in implementation, docs must explicitly state this.

## Required Alignment Actions

1. Keep Swagger schema enum limited to `immediate`.
2. Keep route-level Swagger examples consistent with runtime.
3. Document PUT/PATCH semantics explicitly in route comments.
4. Consider merge-safe update behavior for category partials as a follow-up hardening item.

## Acceptance Checks

- API docs show only supported preference values.
- PATCH examples do not imply unsupported frequency values.
- Frontend/mobile preference docs match backend contract.

