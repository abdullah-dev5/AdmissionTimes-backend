# Deploying AdmissionTimes (free, no credit card)

| Part | Host | Config in repo |
|---|---|---|
| API (this repo) | Vercel Hobby, project `admissiontimes-api` | `vercel.json`, `api/index.js` |
| Web app | Vercel Hobby, project `admissiontimes` | `admission-times-frontend/vercel.json` |
| Database, auth, realtime | Supabase (existing project) | `supabase/migrations` |
| Scheduled jobs | cron-job.org | calls `/api/v1/internal/jobs/*` |
| Scrapers | GitHub Actions | `AdmissionTimes-Scrapers/.github/workflows/scraper.yml` |
| Mobile app | Expo EAS | `AdmissionTimes-MobileApp/eas.json` |

Deploy the API first: the web app, the mobile app and the scrapers all need its URL.

## How the API runs on Vercel

- `pnpm build` compiles `src/` to `dist/`. `tsc-alias` turns the `@domain/...` aliases into relative paths, so Vercel can bundle every file.
- `api/index.js` exports the Express app as one function, and `vercel.json` routes every path to it.
- The function runs in Seoul (`icn1`), next to the Supabase database. The database is reached through Supabase's transaction pooler (port 6543), which is designed for serverless.
- Notifications, emails and pushes finish after the response, using `waitUntil` (`src/shared/utils/background.ts`).
- There is no long-running process, so the in-process scheduler does not run. cron-job.org calls the job endpoint instead (step 3).
- PDF uploads are limited to 4 MB, because Vercel rejects request bodies over 4.5 MB.

## Before you start

1. **Brevo:** turn off Security → Authorized IPs (Vercel's IPs change). Otherwise every email fails with `525 5.7.1 Unauthorized IP address`.
2. **Merge** the open PRs into `main` in every repo.
3. Two git-ignored files hold the values to paste. Never commit or share them:
   - `admission-times-backend/.env.vercel` (API, contains secrets)
   - `admission-times-frontend/.env.vercel` (web app, public values)

## 1. API on Vercel

1. vercel.com → sign up with GitHub (Hobby, no card).
2. **Add New → Project** → import `AdmissionTimes-backend`.
3. **Project Name:** `admissiontimes-api`. This gives `https://admissiontimes-api.vercel.app`; if Vercel adds a suffix, use the URL it shows everywhere below.
4. **Framework Preset:** Other. Leave the build settings alone (they come from `vercel.json`).
5. **Environment Variables:** open `admission-times-backend/.env.vercel`, copy everything, and paste it into the first *Key* box. Vercel splits it into 34 variables.
6. **Deploy.** Then open `https://admissiontimes-api.vercel.app/health`. You should see `"status":"ok","database":"ok"`.

If it fails, check **Deployments → the deployment → Logs** (build) or **Functions/Logs** (runtime). `Missing required environment variables: …` names exactly what to add.

## 2. Web app on Vercel

1. **Add New → Project** → import `admission-times-frontend`, with **Project Name** `admissiontimes`.
2. **Environment Variables:** paste `admission-times-frontend/.env.vercel`. If the API URL differs from `https://admissiontimes-api.vercel.app`, fix `VITE_API_BASE_URL`.
3. **Deploy.** Note the URL, e.g. `https://admissiontimes.vercel.app`.
4. If that URL differs from `https://admissiontimes.vercel.app`, go to the API project → Settings → Environment Variables. Set `CORS_ORIGIN` and `WEB_APP_URL` to it, then **Redeploy** the API.
5. **Supabase** → Authentication → URL Configuration:
   - Site URL: the web URL.
   - Redirect URLs: `https://<web-url>/reset-password` and `https://<web-url>/signin`.

`VITE_*` values are compiled in, so after changing one, redeploy the web project.

## 3. Scheduled jobs (cron-job.org, free)

Every job uses method **POST** and an extra header `x-internal-service-token` set to the `CRON_SECRET` value from `.env.vercel`.

| Title | URL | Schedule |
|---|---|---|
| Deadline reminders | `https://admissiontimes-api.vercel.app/api/v1/internal/jobs/reminders` | every hour (minute 5) |
| Email retries | `https://admissiontimes-api.vercel.app/api/v1/internal/jobs/email-retries` | every 15 minutes |
| Recommendations | `https://admissiontimes-api.vercel.app/api/v1/internal/jobs/recommendations` | daily at 02:00 |
| Recommendation cleanup | `https://admissiontimes-api.vercel.app/api/v1/internal/jobs/recommendation-cleanup` | daily at 04:30 |

A correct call returns **202**. `GET /api/v1/internal/jobs` (same header) shows each job's last run. Reminders are sent once per program and threshold, however often the job runs.

## 4. Scrapers (GitHub Actions)

In `AdmissionTimes-Scrapers` → Settings → Secrets and variables → Actions:

- `BACKEND_BASE_URL` = `https://admissiontimes-api.vercel.app`
- `SCRAPER_INTERNAL_SERVICE_TOKEN` = the value in `.env.vercel`

Then run the workflow once (Actions → Run workflow). A real run replaces the demo deadlines with the universities' real dates.

## 5. Mobile app (EAS)

`eas.json` points the `preview` and `production` builds at `https://admissiontimes-api.vercel.app/api/v1`; change it there if the URL differs. Then:

```bash
npx eas build --profile preview --platform android
```

## After deploying

- Sign in on the web URL as admin, university and student.
- Run the reminders job once from cron-job.org (**Test run**). Check the admin Email Delivery Logs for a `sent` row.

## Alternative host

`render.yaml` describes the same API as a Render web service. That runs the in-process scheduler and accepts 10 MB uploads, but Render requires a card.
