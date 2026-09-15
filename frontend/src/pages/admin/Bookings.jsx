import CrudModule from "@/components/shared/CrudModule";
import { StatusBadge, PriorityBadge } from "@/components/shared/StatusBadge";

const STATUS = ["Pending", "Running", "Completed"];
const PRIORITY = ["Low", "Medium", "High"];
const PAY = ["Paid", "Pending", "Partial"];

export default function Bookings() {
  return (
    <CrudModule
      title="Bookings"
      singular="Booking"
      name="bookings"
      breadcrumb={["Super Admin", "Bookings"]}
      columns={[
        { key: "booking_no", label: "Booking No" },
        { key: "customer", label: "Customer" },
        { key: "service", label: "Service" },
        { key: "assigned_employee", label: "Employee" },
        { key: "booking_date", label: "Booked" },
        { key: "due_date", label: "Due" },
        { key: "priority", label: "Priority", render: (r) => <PriorityBadge value={r.priority} /> },
        { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
        { key: "payment_status", label: "Payment", render: (r) => <StatusBadge value={r.payment_status} /> },
      ]}
      fields={[
        { key: "booking_no", label: "Booking No", required: true },
        { key: "customer", label: "Customer", required: true },
        { key: "service", label: "Service", required: true },
        { key: "assigned_employee", label: "Assigned Employee" },
        { key: "assigned_agent", label: "Assigned Agent" },
        { key: "booking_date", label: "Booking Date", type: "date" },
        { key: "due_date", label: "Due Date", type: "date" },
        { key: "priority", label: "Priority", type: "select", options: PRIORITY, default: "Medium" },
        { key: "status", label: "Status", type: "select", options: STATUS, default: "Pending" },
        { key: "payment_status", label: "Payment Status", type: "select", options: PAY, default: "Pending" },
      ]}
    />
  );
}
