# NTAXCO ERP — Product Requirements Document

## Original Problem Statement
Build NTAXCO (Nizam's Tax Consultancy) ERP — an enterprise Indian Tax & Accounting ERP with 4 role-based portals (Super Admin, Employee, Customer, Agent). Foundation + complete JWT/OTP authentication + shared UI system + Yellow & White theme, followed by full business modules per portal.

## Architecture
- **Frontend**: React 19 (CRA + craco), Tailwind CSS, shadcn/ui, React Router 7, Axios, React Hook Form + Zod, Recharts, framer-motion, sonner. `@/` alias -> `src/`.
- **Backend**: FastAPI (single shared backend), MongoDB (motor), custom JWT auth (PyJWT + bcrypt). All routes prefixed `/api`.
- **Auth model**: access + refresh JWT tokens returned in response body, stored in localStorage, sent as `Authorization: Bearer`. OTP is a mock, always `123456`.
- **Folder structure**: `src/lib` (api, constants), `src/context` (AuthContext), `src/routes` (guards), `src/components/{ui,shared,layout}`, `src/pages/{auth,admin,employee,customer,agent}`, `src/data` (mock).

## User Personas
- **Super Admin**: full control (email+password OR mobile OTP). Seeded email: chinmayiracharla58@gmail.com / Admin@123, mobile 9876543210.
- **Employee** (Rahul Sharma, EMP001, GST): mobile OTP 9876543211.
- **Customer** (ABC Industries Pvt Ltd, CUS001): mobile OTP 9876543212.
- **Agent** (Vikram Singh, AG001): mobile OTP 9876543213.

## Core Requirements (static)
- 4 dedicated portals each with sidebar + navbar layout, dashboard, protected + role-based routes, 404 page.
- Reusable UI: cards, tables (search/sort/filter/pagination/export/print), forms, buttons, inputs, charts, dialogs, toasts, loading skeletons, empty states.
- Yellow & White theme only. Official NTAXCO logo throughout.

## Implemented (2026-08-03) — Phase 1: Foundation + Auth
- Backend auth endpoints: `/api/auth/admin/login`, `/mobile/send-otp`, `/mobile/verify-otp`, `/refresh`, `/logout`, `/me`. 4 users seeded idempotently on startup.
- Frontend: Home (4 portal cards), role-based LoginPage (email + OTP tabs, countdown timer, resend, validation), AuthContext (persist/auto-login/logout), ProtectedRoute + PublicRoute guards with role isolation, PortalLayout (sidebar + navbar + notification bell + user menu), 4 role dashboards with 15-16 KPI cards + Recharts charts + activity/due-date widgets, ModulePlaceholder for all business module routes, 404 page, LoadingScreen.
- Shared components: KpiCard, DataTable, Charts (Area/Bar/Line/Donut), PageHeader, EmptyState, Widgets, Logo.
- Theme: Chivo (headings) + IBM Plex Sans (body), brand yellow #FFB800.
- **Tested: 100% backend (21/21 pytest) + 100% frontend (17/17 acceptance flows).**

## Prioritized Backlog (remaining business modules — all currently ModulePlaceholder)
### P0 — Super Admin portal modules
- Employee Management (CRUD, profile, attendance, leave, salary, performance, assigned clients/projects, documents)
- Customer Management (CRUD, business details, GST/PAN/TAN/CIN, timeline, notes, documents)
- Bookings, Projects (Kanban/Timeline/Calendar views)
### P1
- GST / Income Tax / TDS / ROC compliance modules
- Invoices (GST calc + PDF), Payments, Accounting (P&L, balance sheet, ledger)
- Reports (PDF/Excel/CSV export), Documents, Notifications drawer
### P1 — Employee portal
- Attendance (check-in/out), Leave, Tasks, Projects, Customers, Calendar, Meetings, Payslips, Performance, Profile
### P1 — Customer portal
- GST/ITR/TDS returns, Projects, Bookings, Invoices, Payments, Documents, Support, Messages, Reports, Profile
### P1 — Agent portal
- Leads, Onboarding, Appointments, Meetings, Commission, Performance, Reports, Profile
### P2 — Cross-cutting
- Backend module APIs + centralized mock datasets, real PDF/Excel/CSV generation, file upload/object storage, notification system, server-side pagination.

## Implemented (2026-08-03) — Phase 3: Compliance + Employee + Accounting + Agent
- Backend `erp.py`: +12 seeded collections (gst, itr, tds, roc, attendance, leaves, tasks, payslips, leads, appointments, commissions, journal) with generic CRUD; `GET /api/accounting/summary` (income/expense/profit, cash flow, P&L, balance sheet, trial balance). 20 collections total.
- `CrudModule` extended with `kpiFn(rows)` to render KPI cards above tables.
- Super Admin: GST / Income Tax / TDS / ROC modules (KPIs + returns tables + due dates + CRUD), Accounting dashboard (KPIs + cash-flow chart + P&L/Balance Sheet/Trial Balance tabs), Reports page (8 reports, PDF/Excel/CSV/Print).
- Employee portal: Attendance (check-in/out + history + KPIs), Leave (apply/CRUD + balance KPIs), Tasks (CRUD + progress), Payslips (PDF download).
- Agent portal: Leads (CRUD pipeline), Onboarding (lead→customer form), Appointments (CRUD), Commission (KPIs + chart + table).
- **Tested: 42/42 backend + 100% Phase-3 frontend criteria. No production bugs.** (Testing agent fixed missing App.js imports.)

## Implemented (2026-08-03) — Phase 4: Portal Completion + Reminders + WhatsApp + AI Copilot + Rename
- Backend `erp.py`: `GET /api/reminders` (GST/ITR/TDS/ROC/invoice due dates → days-remaining, priority, type + summary Today/Week/Overdue/Upcoming).
- Employee portal completed: Projects, Assigned Customers, Calendar, Meetings, Performance, Profile (real data).
- Tax Consultant portal completed: Customers, Calendar, Meetings, Performance, Reports, Profile.
- **Role rename**: "Agent" → "Tax Consultant" across ALL UI (backend role key stays `agent`, routes `/agent/*` & `/login/agent` for compatibility).
- Customer Payments: mock Razorpay checkout (checkout→processing→success + Txn ID) + downloadable receipt PDF.
- GST Auto-Reminders widget on Super Admin dashboard + Customer Notifications page.
- Floating WhatsApp support widget + AI Tax Copilot (mock GST/ITR/TDS calculators in ₹) on Customer portal.
- Reusable: CollectionTable (preset-driven), CalendarView, PerformancePage, ProfilePage, RemindersWidget, WhatsAppWidget, AiTaxCopilot. Config in `constants.js` (WHATSAPP).
- **Tested: 100% backend (9/9 phase-4) + 100% Phase-4 frontend criteria. Zero remaining issues.**

## Implemented (2026-06) — Phase 5: Premium Unified Login + Marketing Homepage + LIVE AI Copilot
- **Unified Login** (`LoginPage.jsx`): premium royal-blue (#0A2540) split-screen. Left brand panel with office image + overlay, headline, live stat cards, service chips. Right glass card with framer-motion animated 4-role switcher (layoutId "role-pill"). Admin = Email + Mobile OTP tabs; others = Mobile OTP. Routes `/login` (switcher) and `/login/:role` (preselects). All flows verified.
- **Customer Marketing Homepage** (`CustomerLanding.jsx`): full corporate site — hero, dark stats band (count-up), Why-Choose-Us, services bento grid, analytics showcase, project showcase, testimonials, team, gallery, contact/CTA with WhatsApp. Rich Unsplash imagery. Royal blue + yellow theme.
- **LIVE AI Tax Copilot** (`AiTaxCopilot.jsx` + `erp.py` POST `/api/copilot/chat`): real OpenAI **gpt-5.4** via `EMERGENT_LLM_KEY` (emergentintegrations). System prompt = Indian tax expert (GST/ITR/TDS/ROC in ₹, step-by-step). Multi-turn memory stored in `erp_copilot` (system prompt prepended to `initial_messages`). Premium chat widget (typing indicator, quick prompts, session id).
- **Tested: iteration_5 — 100% backend (copilot + memory + all 4 auth flows) + 100% frontend Phase-5 acceptance. No blocking issues.**

## Implemented (2026-06) — Phase 6/7: All Placeholders Eliminated + Booking Workflow + Customer Home Landing
- **No placeholder pages remain (all 4 portals).** Backend `erp.py` expanded seed: 44 payments, 8 agents, 60 documents, 66+ bookings (realistic Indian business data in ₹); new collections `payments` & `agents`; `WRITE_ROLES.bookings` now allows customer/agent; `seed_erp` auto-refreshes expanded collections.
- **New pages:** Admin — Agent Management, Payments, Documents (download/preview), full **Notification Center** (`NotificationsPage.jsx`: search/filter/mark-all/archive/delete/pagination + KPIs), **Settings** (`SettingsPage.jsx`, 10 tabs). Employee/Agent — Documents + Notifications (+ Agent Projects). Customer — TDS, Bookings, Messages (chat), Reports (PDF/Excel/CSV/Print). New `CollectionTable` presets drive most tables.
- **Book Service workflow** (`BookServiceModal.jsx`): 3-step stepper (details → schedule/docs → review with auto-assigned consultant + fee estimate + terms) → POST `/api/bookings` → success screen with Booking ID + downloadable receipt. Wired into Services "Book Now", Customer Bookings, and Home hero/CTA. Persistence curl-verified.
- **Customer default landing = Home** (`landingPath()` in constants): customer lands on `/customer` (premium Home) after login; admin/employee/agent unchanged (→ `/dashboard`). Home enhanced with personalized welcome, quick actions, upcoming deadlines, announcements, FAQs. Home nav item added; Home page removed (login is app landing at `/`).
- **Branding/responsive:** enlarged logos (login/sidebars/loading), favicon + title, premium branded LoadingScreen, global responsive safeguards (no horizontal overflow, safe-area, smooth scroll).
- **Tested: iteration_6 (100% backend, customer pages fixed after) + iteration_7 (100% frontend — landing redirects, all fixed pages, booking E2E, responsive no-overflow).** Added OTP auto-focus.

## Implemented (2026-06) — Phase 8/9: Notifications + AI Everywhere + Agent Booking Mgmt + Mock Razorpay Payments
- **Live role-based booking notifications** (`erp.py` `_notify()`): POST `/api/bookings` fires admin ("New booking … received"), agent ("New booking assigned"), customer ("Booking … submitted"); status updates + payment fire follow-ups. Visible in every portal's Notification Center + NotificationBell. Curl + UI verified. (Customer `/customer/notifications` route fixed from RemindersWidget → shared `NotificationsPage`.)
- **AI Tax Copilot everywhere**: global `window 'ntaxco:open-copilot'` event (`lib/copilot.js`); `AiTaxCopilot` listens and opens; Customer Home "AI Copilot" quick action opens it instantly; floating button present on all customer pages.
- **Agent Booking Management** (`AgentBookings.jsx`, `/agent/bookings`): booking cards with status timeline + Accept/In-Progress/Complete/Reject/Request-Docs/Schedule/Invoice/Contact actions; status changes persist (PUT `/api/bookings/{id}`) and notify customer+admin.
- **Modular MOCK Razorpay payment workflow**: `POST /api/payments/create-order` + `/verify` (mock when no `RAZORPAY_KEY_ID/SECRET` in `.env`; real Razorpay when keys added — no code change). Book Service step 3 → "Proceed to Payment" → Razorpay-style checkout (`RazorpayCheckoutMock`) → verify → success screen with Payment ID / Txn Ref / Invoice No. / Receipt No. / Amount / Paid / Confirmed. Payment stored in `erp_payments`, invoice in `erp_invoices`, booking → Confirmed/Paid, notifications sent. New bookings sort newest-first (`created_at`).
- **Tested:** iteration_8 (payment+copilot+agent 85%), iteration_9 (admin/agent notifications + rzp-close + payment pass), then customer-notifications route + booking sort fixed and curl-verified (feed shows Booking submitted + Payment successful newest-first).

## Implemented (2026-06) — Phase 10: Per-Booking Chat Threads
- **Each booking has its own chat thread** shared by customer ↔ consultant (agent). Backend: `GET/POST /api/bookings/{id}/messages` (collection `erp_booking_chat`); posting notifies the counterpart role. Reusable `BookingChat.jsx` dialog (right-aligned own messages, sender name/role, timestamps). Wired into Customer Bookings ("Chat" column, `chat-<id>`) and Agent Bookings ("Chat" action, `ab-chat-<id>`).
- **Verified via curl:** customer posts → agent reads same thread → agent replies → customer sees both (correct order + sender names) → agent receives "New message" notification. Frontend compiles clean.

## Known Notes / Tech Debt
- `erp.py` generic CRUD has NO role guard (open for demo) — MUST gate before production.
- Theme remains Yellow & White (a later prompt asked for Royal Blue; kept per earlier explicit Yellow/White-only choice).
- Recharts ResponsiveContainer warnings are non-blocking console noise.
- Not adopted: unified single login page & full logo overhaul (separate role login pages retained and working).

## Next Tasks
1. Add role-based auth dependency to erp.py CRUD (gate writes by role).
2. Build remaining Customer sub-pages (Messages, Reports, TDS, Bookings) into full modules.
3. Optional: unified login page + Royal Blue accent if the user reconfirms the theme change.

## Implemented (2026-08-03) — Phase 2: Business Modules + Customer Portal Redesign
- Backend `erp.py`: centralized mock datasets + generic CRUD for employees, customers, bookings, projects, invoices, documents, tickets, services (seeded idempotently in MongoDB). Standard response envelope. `/api/health`.
- Super Admin modules (real): Employees CRUD, Customers CRUD, Bookings CRUD, Projects (Kanban/List/Timeline + progress bars), Invoices (KPI cards + CGST/SGST/IGST preview + branded jsPDF download).
- Shared system: `useCrud` hook, generic `CrudModule` (add/edit/delete/view dialogs + confirm), DataTable enhanced with real PDF/Excel/CSV/Print exports (`lib/exports.js`), StatusBadge/PriorityBadge.
- Customer Portal REDESIGNED (distinct top-nav, no sidebar): CustomerLayout, Landing (hero + animated counters + CTAs + featured services), Services catalog (15 cards, search, book, details), ServiceDetails (animated workflow timeline), Documents (drag & drop upload + delete), Support (raise ticket + FAQ), Invoices (PDF), Business Profile, GST/ITR returns tables, Projects tracker.
- Docs: README.md, .env.example.
- **Tested: 40/40 backend (21 auth + 19 ERP) + 100% Phase-2 frontend criteria. No production bugs.**
