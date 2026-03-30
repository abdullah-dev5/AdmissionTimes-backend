# Backend Technical Specs

## Stack

- Node.js
- TypeScript
- Express 5
- PostgreSQL via `pg`
- Supabase services (auth/realtime integration points)
- Joi validation
- Swagger (`swagger-jsdoc`, `swagger-ui-express`)
- Nodemailer for email delivery
- node-cron scheduler

## Package Scripts

- `pnpm dev`
- `pnpm build`
- `pnpm start`
- `pnpm type-check`
- `pnpm migrate`
- `pnpm seed`

## API and Security Model

- API base path: `/api/v1`
- Auth middleware applied at app level for `/api/v1`
- Public routes include `/health` and selected `/api/v1/auth/*`
- Swagger docs hosted at `/api-docs`

## Documentation Sources

- `src/config/swagger.ts` defines shared schemas and top-level metadata.
- Route files provide endpoint-level `@swagger` annotations.

## Preference Contract Baseline

- `email_frequency` currently supports `immediate` only.
- `email_notifications_enabled` and category toggles define delivery behavior.
- Category keys: verification, deadline, system, update.

Updated: 2026-03-30
