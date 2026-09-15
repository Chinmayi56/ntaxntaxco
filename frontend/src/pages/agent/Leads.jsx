import CrudModule from "@/components/shared/CrudModule";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Target, UserPlus, Sparkles, XCircle } from "lucide-react";

const TYPES = ["Private Limited", "Public Limited", "Proprietorship", "Partnership", "LLP"];
const STATES = ["Telangana", "Andhra Pradesh", "Karnataka", "Tamil Nadu", "Maharashtra"];
const SERVICES = ["GST Registration", "GST Filing", "Company Registration", "Income Tax Filing", "Accounting", "ROC Compliance", "MSME Registration", "Trademark Registration"];
const SOURCES = ["Website", "Referral", "Ads", "Walk-in", "Cold Call"];
const STATUS = ["New", "Contacted", "Interested", "Proposal Sent", "Converted", "Lost"];

export default function Leads() {
  return (
    <CrudModule
      title="Leads" singular="Lead" name="leads" breadcrumb={["Tax Consultant", "Leads"]}
      kpiFn={(r) => [
        { title: "Total Leads", value: r.length, icon: Target },
        { title: "Interested", value: r.filter((x) => x.status === "Interested" || x.status === "Proposal Sent").length, icon: Sparkles },
        { title: "Converted", value: r.filter((x) => x.status === "Converted").length, icon: UserPlus },
        { title: "Lost", value: r.filter((x) => x.status === "Lost").length, icon: XCircle },
      ]}
      columns={[
        { key: "lead_id", label: "ID" },
        { key: "business_name", label: "Business" },
        { key: "contact_person", label: "Contact" },
        { key: "mobile", label: "Mobile" },
        { key: "service", label: "Service" },
        { key: "source", label: "Source" },
        { key: "state", label: "State" },
        { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
      ]}
      fields={[
        { key: "business_name", label: "Business Name", required: true, full: true },
        { key: "contact_person", label: "Contact Person", required: true },
        { key: "mobile", label: "Mobile" },
        { key: "email", label: "Email" },
        { key: "business_type", label: "Business Type", type: "select", options: TYPES },
        { key: "state", label: "State", type: "select", options: STATES },
        { key: "service", label: "Service Interested", type: "select", options: SERVICES },
        { key: "source", label: "Source", type: "select", options: SOURCES },
        { key: "assigned_date", label: "Assigned Date", type: "date" },
        { key: "status", label: "Status", type: "select", options: STATUS, default: "New" },
      ]}
    />
  );
}
