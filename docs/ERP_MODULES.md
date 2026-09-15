# NTAXCO ERP — Business Modules & API Notes

## Implemented in this package

- Admin: employee management, leave approvals, customer CRM, bookings, services, projects, GST/ITR/TDS/ROC workspaces, accounting, invoices, payments, documents, notifications, security, dynamic modules and reporting.
- Employee: attendance, leave, tasks, assigned customers/projects, documents, payslips, performance, calendar/meetings, profile and notifications.
- Agent: leads, customer onboarding, customers, bookings, appointments, meetings/calendar, projects, commissions, performance, reports, documents, profile and notifications.
- Customer: company profile, services/bookings, projects, GST/ITR/TDS views, invoices/payments, documents, support, messages, reports and notifications.

## Security / isolation

The backend is the authority for access control. Customer-scoped collections are filtered by the authenticated customer's `customer_id` and employee/agent workspaces are filtered by authenticated ownership/assignment. Unauthorized record probing returns `404` for customer-scoped resources. Employee attendance/leave/task/payslip writes are restricted to the logged-in employee.

Important mutations are recorded in `erp_audit_logs` with user, role, collection, record and timestamp.

## Key API groups

All endpoints are under `/api`.

- `GET /health` — backend health.
- `GET /admin/dashboard` — live Admin KPI data and operational datasets.
- `GET /customer/dashboard` — live customer KPI, filing, spending, service-use and due-date data.
- `GET/POST/PUT/DELETE /{collection}` — authenticated CRUD for the ERP collections, with role/ownership enforcement.
- `GET/POST/PUT/DELETE /dynamic-records/{module_key}` — admin-created module records validated against saved module field configuration.
- `POST /payments/create-order` and `POST /payments/verify` — payment workflow with idempotent verification.
- `GET/POST /bookings/{booking_id}/messages` — booking communication thread.

Collection endpoints support `search`, `status`, `page`, and `page_size` query parameters.

## Invoice rules

Invoice create/update operations calculate taxable amount, discount, GST rate, CGST/SGST or IGST, and total on the backend. The backend rejects negative values, discounts above taxable value, and invalid GST rates. Seed invoices also carry a due date.

## Document rules

Customer document creation is ownership-bound to the authenticated customer. The existing customer UI currently uploads document metadata; binary file storage/download can be added behind the same authorization layer when a storage provider is selected.

## Compliance status

GST, ITR, TDS and ROC records are ordinary workflow records. The system does not claim that an external government filing occurred unless an actual filing integration/workflow records it.

## Authentication

All four roles use the same FastAPI authentication service. Email/password and mobile OTP flows are supported. Public registration is limited to Employee, Customer and Agent; Super Admin cannot be created through public registration.
