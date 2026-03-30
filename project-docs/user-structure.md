# User Structure and Request Flow (Backend)

## Roles

- student
- university
- admin

## Identity Model

- Request identity is derived from JWT middleware.
- Services and queries use authenticated user context for ownership and filtering.
- Preference records are user-scoped through `user_id`.

## Request Path

1. Request enters Express app.
2. Global middleware handles CORS and body parsing.
3. JWT middleware guards `/api/v1/*`.
4. Domain router receives request.
5. Validation middleware checks payload/query.
6. Controller calls service.
7. Service uses model/repository layer for SQL.
8. Standard response envelope is returned.

## Cross-Domain Interaction Examples

- Admissions updates may create changelogs and notifications.
- Deadlines and scheduler flows produce notification events.
- Notification delivery checks user preference settings before email/push side effects.

Updated: 2026-03-30
