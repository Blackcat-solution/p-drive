# P-drive

A local prototype for pharmaceutical business operations and analytics. It uses synthetic demo data and is not a medical device, clinical decision system, or regulated quality, safety, or regulatory system.

## Run locally

Requires Node.js 20 or newer. No external packages or network access are needed.

```sh
npm start
```

Open [http://localhost:4173](http://localhost:4173). For the demo, select any listed role and use password `demo123`. The five demo identities belong to the synthetic Northstar Pharma organization. The server hashes the demo password at startup and applies role and organization checks to API requests.

The app reads `PORT` and `PDRIVE_DATA_FILE` from the process environment. `.env.example` documents these optional settings; Node does not load that file automatically.

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

Records are stored in `data/pdrive.json` on the machine running the server. The file is created on first run and is ignored by Git. Back it up and restrict filesystem access if you use the demo with any non-synthetic information. This single-file JSON store is not suitable for production, concurrent use, high availability, regulated records, or a backup/recovery commitment. It has no encryption-at-rest, secure multi-user session store, external identity provider, or deployment hardening. Use HTTPS and a reviewed database, identity, secrets, retention, access-monitoring, backup, and recovery design before any real business deployment.

All sample records and identities are fictional. Do not enter patient-identifiable information or sensitive health data. Do not use the prototype for prescribing, patient safety, pharmacovigilance, regulated quality workflows, or approvals. No legal, regulatory, GxP, HIPAA, GDPR, or other certification is claimed. Qualified security, privacy, legal, quality, and regulatory professionals should review any production design.

## Architecture

- `server/index.js`: Node HTTP server, login/session handling, API authorization, input validation, persistence, audit events, and business calculations.
- `public/`: responsive single-page interface, styles, and client-side navigation.
- `data/`: local JSON persistence created at runtime.

For a shared deployment, replace local demo sign-in and JSON persistence with an approved identity provider and transactional database, add TLS and secure session storage, configure organization provisioning and retention, and review every export and document access path.
