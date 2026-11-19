# P-drive

## Try the live demo

Open [p-drive-sigma.vercel.app](https://p-drive-sigma.vercel.app). Select any demo team member and use password `demo123`.

The public catalogue is synthetic, not a complete or verified registry of medicines and manufacturers sold in India. Reorder flags are reminders based only on stock quantities and thresholds entered by the shop. They are not medical guidance or independent purchase recommendations. Do not enter real customer, patient, financial, or other sensitive data; the hosted demo uses temporary storage.


A local prototype for pharmaceutical business operations and analytics. It uses synthetic demo data and is not a medical device, clinical decision system, or regulated quality, safety, or regulatory system.

## Run locally

Requires Node.js 20 or newer. No external packages or network access are needed.

```sh
npm start
```

Open [http://localhost:4173](http://localhost:4173). For the demo, select any listed role and use password `demo123`. The five demo identities belong to the synthetic Northstar Pharma organization. The server hashes the demo password at startup and applies role and organization checks to API requests.

The app reads `PORT` and `PDRIVE_DATA_FILE` from the process environment. `.env.example` documents these optional settings; Node does not load that file automatically.

## Vercel demo deployment

The repository includes a Vercel serverless API route. Import `Blackcat-solution/p-drive` from [vercel.com/new](https://vercel.com/new), keep the project root at `.`, and set `PDRIVE_SESSION_SECRET` to a long random value in the project's environment variables before deploying. Vercel serves the files in `public/` and routes `/api/*` through the serverless function.

This is a public demo only. Vercel function storage under `/tmp` is temporary and isolated per function instance; record changes may disappear after a cold start and are not shared reliably between instances. The demo accounts and password are public. Do not enter real customer, patient, financial, or other sensitive information. Use a persistent database and managed identity before any shared or production deployment.

## What is included

- Dashboard with sales, repeat-purchase, product indicators, activity, and overdue work.
- Product, customer, order, task, and document-link records, with search and filters.
- Record inspection showing related records and change history.
- Repeat customer and reorder calculations based on completed orders in the selected window; cancelled, returned, and draft orders are excluded.
- Product comparison indicators with visible formulas, date window, record inputs, and limitations.
- Task assignment, status changes, and linked document metadata. Documents are links; files are not uploaded or stored.
- Automation examples are paused by default. This prototype records configuration and manual history only; it does not send notices or run scheduled jobs.
- Role checks and organization scoping on the server, plus an audit trail for changes.

## Data and security boundaries

Locally, records are stored in `data/pdrive.json` on the machine running the server. On Vercel, the demo uses temporary `/tmp` storage; records are not durable or shared across function instances. Back up local demo data if needed and restrict filesystem access if you use any non-synthetic information. This single-file JSON store is not suitable for production, concurrent use, high availability, regulated records, or a backup/recovery commitment. The app has no production identity provider, durable cloud database, or deployment hardening. Use HTTPS and a reviewed database, identity, secrets, retention, access-monitoring, backup, and recovery design before any real business deployment.

All sample records and identities are fictional. Do not enter patient-identifiable information or sensitive health data. Do not use the prototype for prescribing, patient safety, pharmacovigilance, regulated quality workflows, or approvals. No legal, regulatory, GxP, HIPAA, GDPR, or other certification is claimed. Qualified security, privacy, legal, quality, and regulatory professionals should review any production design.

## Architecture

- `server/index.js`: shared API handler and local Node HTTP server, login/session handling, API authorization, input validation, persistence, audit events, and business calculations.
- `api/[...path].js`: Vercel serverless API entry point for `/api/*`.
- `public/`: responsive single-page interface, styles, and client-side navigation.
- `data/`: local JSON persistence created at runtime.

For a shared deployment, replace local demo sign-in and JSON persistence with an approved identity provider and transactional database, add TLS and secure session storage, configure organization provisioning and retention, and review every export and document access path.
