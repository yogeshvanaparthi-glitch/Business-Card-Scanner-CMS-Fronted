# NameCardScan CMS (standalone)

Standalone React app for **Super Admin** configuration management.

Uses the **existing** Business Card Scanner backend only (login, users, health, integration tests). No new backend APIs.

## Requirements

- Node 20+
- Backend running (default `http://localhost:5000`)

## Setup

```bash
cd BusinessCardScanner_CMS
cp .env.example .env
npm install
npm run dev
```

App runs at **http://localhost:5174**

## Login

Sign in with a **SUPER_ADMIN** account from the existing backend (same credentials as the main app).

Admin and User roles are rejected at login.

## Features

| Area | Behavior |
|------|----------|
| Admins | One card per **ADMIN** (Super Admin is never listed) |
| Per-Admin env | WhatsApp + Email fields; Save stores in DB (`admin_env_settings`) |
| Secrets | Masked on load; leave blank to keep existing |

Create Admins in the main app → **Manage Team**. After they accept the invite, refresh CMS — each Admin gets their own env form.

Global server `.env` still powers existing WhatsApp/Email send flows until you ask to wire per-Admin runtime.

## Scripts

- `npm run dev` — Vite dev server (proxies `/api`, `/health`, `/integrations`)
- `npm run build` — production build
- `npm run preview` — preview build
