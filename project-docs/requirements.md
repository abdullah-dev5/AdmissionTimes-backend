# Backend Requirements

## Functional Requirements

1. Authentication and authorization
- Protect `/api/v1/*` routes with JWT middleware except intended public auth routes.
- Derive user context (id, role, university) from token claims.

2. Admissions and verification
- CRUD-like admissions management with role restrictions.
- Verification and revision/rejection workflows for admin and university roles.

3. Student-facing data
- Dashboard aggregation
- Watchlists and alert toggles
- Deadlines and reminder eligibility
- Recommendations APIs

4. Notifications
- In-app notification records
- Read and read-all operations
- Preference-aware email/push side effects

5. Preferences
- User-scoped preferences under `/users/me/preferences`.
- Safe updates for category toggles and channel toggles.

6. Operations
- Scheduler trigger endpoints and reminder execution logs
- API docs generation and maintainability via Swagger annotations

## Non-Functional Requirements

- Type-safe implementation with strict TypeScript.
- Consistent API response envelope.
- Parameterized SQL and role-aware data access.
- Backward compatibility for active frontend/mobile endpoint usage.

## Contract Constraints

- Public docs must match runtime validation rules.
- Unsupported enums must be removed from Swagger.
- PUT/PATCH semantics must be explicitly documented and consistent.

Updated: 2026-03-30
