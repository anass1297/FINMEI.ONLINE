# FINMEI Financial — Financial management for freelancers & small businesses

FINMEI Financial is a full-stack SaaS app for invoices, customers, expenses, recurring billing,
payments and financial reports. You can run several businesses from one account, and
each business keeps its own separate data.

**Stack:** Next.js 14 (App Router, Server Actions) · TypeScript · Prisma ORM · NextAuth (email/password + Google) · Tailwind CSS · Recharts · pdf-lib · Zod

---

## Quick start

```bash
npm install
cp .env.example .env          # set DATABASE_URL and NEXTAUTH_SECRET
npx prisma migrate deploy     # create the PostgreSQL database schema
npm run db:seed               # optional demo data
npm run dev                   # http://localhost:3000
```

**Demo login (after seeding):** `demo@kontora.app` / `Demo1234`

> No SMTP configured? Verification and password-reset emails are **printed to the server console**, so you can open the links locally.

## Features

| Area | What's included |
|---|---|
| **Auth** | Registration, email+password login, Google OAuth, email verification, forgot/reset password, secure logout, profile & password management, account deletion, login rate limiting |
| **Multi-business** | Unlimited businesses per user, a business switcher, and data separated per business (every query is scoped by `businessId` after a membership check) |
| **Dashboard** | Revenue, expenses, net profit, outstanding/paid/overdue totals, monthly revenue & expense charts, spending by category, recent invoices & transactions, quick actions, date-range and currency filters |
| **Invoices** | Create/edit/delete/duplicate, automatic numbering (prefix, padding, next number), statuses Draft/Sent/Partially paid/Paid/Overdue/Cancelled, multiple currencies, per-line tax, custom tax label (VAT/GST…), % or fixed discounts, payment terms and due dates, notes/terms/payment instructions, 3 templates, custom accent color and font, live preview, PDF export, public share links (can be regenerated), email sending |
| **Customers** | Full CRM record (company, contact, email, phone, billing address, tax ID, notes, preferred currency), invoice history, revenue and outstanding balance per customer, create a customer directly from the invoice editor |
| **Expenses** | Categories (custom too), vendor, date, amount, currency, tax rate/amount, notes, receipt/document uploads (PDF, images, CSV, DOCX, XLSX, 10MB each), filters by date/category/search, CSV & PDF export |
| **Recurring** | Weekly, monthly, quarterly, annual or custom (every N days/weeks/months/years), end never / on a date / after N invoices, create as draft or issue automatically, pause/resume, upcoming-dates preview, "Run now" |
| **Reports** | Profit & loss, revenue (payments), expenses by category, outstanding/aging buckets, revenue per customer, year-over-year comparison; each has a chart and a table view, and exports to CSV and PDF |
| **Payments** | Manual full/partial payments, methods, dates, references, payment history, balance calculation, automatic status updates; overpayments and future dates are rejected |
| **UX** | Sidebar layout, responsive (desktop/tablet/mobile), light/dark/system theme, toasts, dialogs, skeleton loaders, empty states |

## Payments — honest by design

A payment only counts as received in one of two cases:
1. **The user records it manually** (money they actually received), or
2. **A payment provider webhook whose signature has been verified on the server** reports a completed payment (`src/app/api/webhooks/[provider]/route.ts`). These are idempotent on `providerRef`.

Stripe and PayPal are **prepared but not enabled**. `src/lib/payments/providers.ts` defines the `PaymentProvider` interface (`createCheckout`, `verifyWebhook`). The stub providers deliberately **reject** every webhook until real signature verification is written. To add Stripe:
`npm i stripe`, implement `createCheckout` with Checkout Sessions (put the invoice `publicToken` in metadata), implement `verifyWebhook` with `stripe.webhooks.constructEvent`, then add a "Pay online" button to `src/app/i/[token]/page.tsx`.

## Recurring invoices & overdue status

Point any scheduler at the cron endpoint once a day:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.com/api/cron/recurring
```

It generates the recurring invoices that are due and marks past-due invoices as overdue. Running it more than once is safe (each schedule's next run date moves forward in the same transaction). The dashboard also runs a catch-up for the active business.

Vercel example (`vercel.json`): `{ "crons": [{ "path": "/api/cron/recurring", "schedule": "0 6 * * *" }] }` — Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically.

## Google sign-in

1. Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web).
2. Authorized redirect URI: `https://your-domain.com/api/auth/callback/google`.
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. The Google button appears automatically.

A Google account with the same email as an existing account is linked to it (Google-verified emails only).

## Production deployment

1. **Database:** set `DATABASE_URL` to a PostgreSQL connection string (for example, a Vercel Postgres or Neon database). Run `npx prisma migrate deploy` to apply migrations.
2. **Secrets:** set `NEXTAUTH_URL`, `NEXTAUTH_SECRET` and `CRON_SECRET`, plus SMTP settings for real emails.
3. **File storage:** set `BLOB_READ_WRITE_TOKEN` for Vercel Blob storage. Local development can continue using `UPLOAD_DIR` without that variable.
4. **Rate limiting:** `src/lib/rate-limit.ts` keeps counts in memory. For several instances, back it with Redis or Upstash.
5. `npm run build && npm start`.

## Architecture

```
prisma/schema.prisma        Data model (money stored in integer minor units)
prisma/seed.ts              Demo data
src/middleware.ts           Edge auth guard for app & API routes
src/lib/
  auth.ts                   NextAuth config (credentials + Google, JWT sessions)
  session.ts                requireUser() / requireBusiness() — tenancy guard
  calc.ts                   Invoice math shared by the editor preview AND the server
  invoices.ts               Numbering, status logic, payment sync, overdue refresh
  recurring.ts              Schedule engine
  reports.ts, report-data.ts  Aggregations shared by pages, CSV and PDF exports
  pdf/                      Invoice PDF + generic report/table PDF (pdf-lib, no browser)
  payments/providers.ts     Payment provider abstraction (Stripe/PayPal-ready)
  storage.ts                File storage abstraction
src/actions/                Server Actions (all validated with Zod, all tenant-scoped)
src/app/(auth)/             Login, register, forgot/reset password, verify email
src/app/(app)/              Authenticated app (dashboard, invoices, customers, …)
src/app/i/[token]/          Public invoice page (drafts are never public)
src/app/api/                PDF, CSV export, attachments, cron, webhooks, NextAuth
src/components/             UI primitives + app components (editor, document, charts)
```

### Security notes
- Every business-scoped read and write filters by the active `businessId`, which is resolved from a verified membership. API routes check membership in the query itself.
- Invoice totals are always **recomputed on the server**; totals sent by the client are ignored.
- Passwords use bcrypt (cost 12). Verification and reset tokens are random, stored only as SHA-256 hashes, single-use and time-limited. Password reset doesn't reveal whether an account exists.
- Upload type and size are checked; files are served only to members of the business, with a sandboxing CSP header.
- CSV exports neutralize spreadsheet formula injection. Security headers are set in `next.config.mjs`.
- Public invoice links use 144-bit random tokens, can be regenerated, and are marked `noindex`.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / start |
| `npm run typecheck` | TypeScript check |
| `npm run db:push` | Sync the schema to the database |
| `npm run db:migrate` | Create a migration (dev) |
| `npm run db:seed` | Load demo data |
