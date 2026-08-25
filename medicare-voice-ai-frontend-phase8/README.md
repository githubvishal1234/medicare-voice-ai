# Medicare Voice AI

Marketing site + product dashboard for "Medicare Voice AI" — an autonomous, HIPAA-compliant
AI voice receptionist for clinics. Built with React, React Router, and Tailwind CSS v4, based
on the provided Stitch design mockups.

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL (typically http://localhost:5173).

## Build for production

```bash
npm run build
npm run preview
```

## Structure

- `src/pages/marketing/Landing.jsx` – the public marketing page (`/`)
- `src/pages/app/*` – the product dashboard, mounted under `/app/*`:
  - `/app` – Overview
  - `/app/calls` – Call Logs & Transcripts
  - `/app/appointments` – Appointment Manager
  - `/app/patients` and `/app/patients/:id` – Patients & Patient Profile
  - `/app/ehr` – EHR Integration Hub
  - `/app/agent` – AI Agent Settings
  - `/app/security` – Security & Compliance
  - `/app/billing` – Billing & Usage
- `src/components/AppShell.jsx` – shared dashboard sidebar/topbar layout
- `src/components/marketing/*` – marketing page sections
- `src/components/ui.jsx` – shared Card / Chip / Button primitives
- `src/lib/data.js` – mock data powering the dashboard (swap for real API calls)
- `src/index.css` – design tokens (colors, type, radii) as Tailwind v4 `@theme` variables

## Notes

- All dashboard pages share one consistent sidebar/nav — the original mockups had two
  slightly different sidebar variants across screens, so these were unified into a single
  navigation structure for a coherent, working app.
- Data is mocked in `src/lib/data.js`; wire up real endpoints there when ready.
- Fonts (Plus Jakarta Sans, Inter) load from Google Fonts via `src/index.css`.
