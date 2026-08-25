# Medicare Voice AI — Backend

FastAPI + SQLAlchemy backend for the `medicare-voice-ai` React frontend
(marketing site + product dashboard for an AI voice receptionist for clinics).

Maps 1:1 onto the shapes in the frontend's `src/lib/data.js` mock file — swap
the mock imports for `fetch` calls against these endpoints and the UI works
unchanged.

## Stack

- FastAPI + Uvicorn
- SQLAlchemy 2.0 (SQLite by default, swap `DATABASE_URL` for Postgres in prod)
- JWT auth (python-jose) + bcrypt password hashing
- Multi-tenant: every resource is scoped to an `Organization` (`org_id`)

## Setup

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # edit SECRET_KEY for anything beyond local dev

python -m app.seed      # loads demo org "HealthLink Clinic" + all mock data
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

Demo login (after seeding): `admin@healthlinkclinic.com` / `password123`

## Auth

OAuth2 password flow. Get a token:

```bash
curl -X POST http://localhost:8000/auth/login \
  -d "username=admin@healthlinkclinic.com&password=password123"
```

Send it on every other request: `Authorization: Bearer <token>`.

New clinics self-serve via `POST /auth/register` (creates an
`Organization` + admin `User` in one call).

Three roles: `admin`, `medical_staff`, `ai_agent` (mirrors the "Access
Control" cards in Security & Compliance). Admin-only endpoints are marked
below.

## Endpoint map (→ which frontend page uses it)

| Router | Base path | Frontend page |
|---|---|---|
| auth | `/auth` | login/register (not in current mockups, needed for real auth) |
| dashboard | `/dashboard` | Overview |
| patients | `/patients` | Patients, Patient Profile |
| calls | `/calls` | Call Logs & Transcripts |
| appointments | `/appointments` | Appointment Manager |
| knowledge-base | `/knowledge-base` | Knowledge Base, AI Agent Settings (docs section) |
| agent-settings | `/agent-settings` | AI Agent Settings |
| ehr | `/ehr` | EHR Integration Hub |
| security | `/security` | Security & Compliance |
| billing | `/billing` | Billing & Usage |
| support | `/support` | Support |

Full request/response schemas are in `/docs` (Swagger UI) once running.

### Notable behaviors

- `GET /dashboard/stats` — `calls_handled_today`, `appointments_booked_today`,
  `resolution_rate_pct`, `staff_time_saved_hrs`, computed live from today's
  `CallLog` rows (not stored counters).
- `GET /dashboard/call-volume` — 24 hourly buckets computed from `CallLog.occurred_at`,
  for the Overview bar chart.
- `GET/POST /dashboard/live-calls` — in-progress calls. This is naturally a
  websocket/polling feed in production (telephony webhook pushes a row in,
  deletes it when the call ends); wired here as plain REST for simplicity.
- `POST /appointments/pending/bookings/{id}/verify` — approves an AI-proposed
  booking and creates the real `Appointment` row.
- `POST /knowledge-base/documents` — multipart file upload, stored under
  `uploads/<org_id>/`. Indexing is stubbed to complete synchronously; wire to
  a real embedding/indexing job queue in production.
- `POST /ehr/api-keys` — returns the plaintext key **once**; only a masked
  prefix is stored/returned afterward. Admin-only.
- Admin-only: EHR integration management, API keys, webhook config, plan
  upgrade, support ticket list.

## Data model

See `app/models.py`. Every table (except `TranscriptMessage`, which nests
under `CallLog`) carries `org_id` for tenant isolation — all router queries
filter on `current_user.org_id`, so one org can never see another's data.

## Seeding

`app/seed.py` recreates the exact demo data the frontend was designed
against (Sarah Jenkins / Michael Chen patients, the sample call + transcript,
EHR integrations, invoices, etc). Safe to re-run — it's a no-op if
"HealthLink Clinic" already exists.

## Production notes

- Swap `DATABASE_URL` to Postgres and drop the `sqlite` `connect_args` in
  `app/database.py`.
- Set a real `SECRET_KEY` and shorten `ACCESS_TOKEN_EXPIRE_MINUTES`, or move
  to refresh tokens.
- `POST /knowledge-base/documents` writes to local disk — move to S3/GCS
  and run indexing as a background job (Celery/RQ) rather than inline.
- `LiveCall` rows should be created/removed by your telephony webhook
  (Twilio, Vonage, etc.) and pushed to the frontend over a websocket instead
  of polled.
- Wire real MRN/EHR sync instead of `EHRIntegration.connected` being a
  manually-flipped boolean.
