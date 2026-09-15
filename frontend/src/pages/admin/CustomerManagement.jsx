import CrudModule from "@/components/shared/CrudModule";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { inr } from "@/lib/utils";

const BIZ = ["Private Limited", "Public Limited", "Proprietorship", "Partnership", "LLP"];
const STATES = ["Telangana", "Andhra Pradesh", "Karnataka", "Tamil Nadu", "Maharashtra"];
const STATUS = ["Active", "Inactive"];

export default function CustomerManagement() {
  return (
    <CrudModule
      title="Customers"
      singular="Customer"
      name="customers"
      breadcrumb={["Super Admin", "Customers"]}
      columns={[
        { key: "cust_id", label: "ID" },
        { key: "business_name", label: "Business" },
        { key: "gst_number", label: "GSTIN" },
        { key: "business_type", label: "Type" },
        { key: "state", label: "State" },
        { key: "assigned_employee", label: "Consultant" },
        { key: "outstanding", label: "Outstanding", render: (r) => inr(r.outstanding), exportValue: (r) => r.outstanding },
        { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
      ]}
      fields={[
        { key: "cust_id", label: "Customer ID", required: true },
        { key: "business_name", label: "Business Name", required: true, full: true },
        { key: "owner", label: "Owner / Contact Person" },
        { key: "email", label: "Email" },
        { key: "mobile", label: "Mobile" },
        { key: "gst_number", label: "GST Number" },
        { key: "pan", label: "PAN" },
        { key: "tan", label: "TAN" },
        { key: "cin", label: "CIN" },
        { key: "business_type", label: "Business Type", type: "select", options: BIZ },
        { key: "state", label: "State", type: "select", options: STATES },
        { key: "city", label: "City" },
        { key: "assigned_employee", label: "Assigned Employee" },
        { key: "assigned_agent", label: "Assigned Agent" },
        { key: "outstanding", label: "Outstanding (₹)", type: "number" },
        { key: "status", label: "Status", type: "select", options: STATUS },
        { key: "address", label: "Address", full: true },
        { key: "notes", label: "Notes", full: true },
      ]}
      detailFields={["cust_id", "business_name", "owner", "email", "mobile", "gst_number", "pan", "tan", "cin", "business_type", "state", "city", "address", "assigned_employee", "assigned_agent", "outstanding", "status", "notes"]}
    />
  );
}
