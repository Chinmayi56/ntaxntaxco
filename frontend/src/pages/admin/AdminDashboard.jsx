import { useState, useEffect } from "react";
import {
  Users, Building2, UserCog, FileText, BadgeIndianRupee, FolderKanban, CheckCircle2,
  Clock, Wallet, Receipt, CalendarCheck, Bell, TrendingUp, AlertCircle, RefreshCw,
} from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { ChartCard, AreaChartView, BarChartView, LineChartView, DonutChartView } from "@/components/shared/Charts";
import { ActivityFeed, DueDatesWidget } from "@/components/shared/Widgets";
import RemindersWidget from "@/components/shared/RemindersWidget";
import { Button } from "@/components/ui/button";
import api, { describeApiError } from "@/lib/api";
import { toast } from "sonner";
import { inr } from "@/lib/utils";

const B = "/admin";
export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get("/admin/dashboard"); setSummary(data?.data || null); }
    catch (e) { toast.error(describeApiError(e, "Unable to load dashboard")); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const c = summary?.cards || {};
  const projects = summary?.projects || [];
  const invoices = summary?.invoices || [];
  const charts = summary?.charts || {};
  const cards = [
    { title: "Total Customers", value: c.customers ?? 0, icon: Building2, to: `${B}/customers` },
    { title: "Total Employees", value: c.employees ?? 0, icon: Users, to: `${B}/employees` },
    { title: "Active Agents", value: c.active_agents ?? 0, icon: UserCog, to: `${B}/agents` },
    { title: "Running Projects", value: c.running_projects ?? 0, icon: FolderKanban, to: `${B}/projects` },
    { title: "Completed Projects", value: c.completed_projects ?? 0, icon: CheckCircle2, to: `${B}/projects` },
    { title: "Pending Projects", value: c.pending_projects ?? 0, icon: Clock, to: `${B}/projects` },
    { title: "Revenue Collected", value: inr(c.revenue || 0), icon: Wallet, to: `${B}/reports` },
    { title: "Outstanding", value: inr(c.outstanding || 0), icon: AlertCircle, to: `${B}/payments` },
    { title: "Paid Invoices", value: c.paid_invoices ?? 0, icon: Receipt, to: `${B}/invoices` },
    { title: "Pending Invoices", value: c.pending_invoices ?? 0, icon: Receipt, to: `${B}/invoices` },
    { title: "Bookings", value: c.bookings ?? 0, icon: CalendarCheck, to: `${B}/bookings` },
    { title: "Open Compliance", value: c.compliance_open ?? 0, icon: FileText, to: `${B}/gst` },
  ];
  const statusData = [
    { name: "Completed", value: projects.filter(p => p.status === "Completed").length },
    { name: "Running", value: projects.filter(p => p.status === "Running").length },
    { name: "Pending", value: projects.filter(p => p.status === "Pending").length },
  ];
  const serviceRevenue = Object.entries(invoices.reduce((m, i) => { const k = i.service || "Other"; m[k] = (m[k] || 0) + (i.payment_status === "Paid" ? Number(i.total || 0) : 0); return m; }, {})).map(([name, value]) => ({ name, value }));
  const recentProjects = [...projects].sort((a,b) => String(b.updated_at || b.start_date || "").localeCompare(String(a.updated_at || a.start_date || ""))).slice(0, 5);

  return (
    <div>
      <PageHeader
        title="Super Admin Dashboard"
        subtitle="Overview of NTAXCO operations, revenue and compliance."
        breadcrumb={["Super Admin", "Dashboard"]}
        actions={<Button variant="outline" className="border-zinc-300" onClick={load} data-testid="refresh-btn"><RefreshCw className="h-4 w-4 mr-1.5" />Refresh</Button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        {cards.map((c, i) => <KpiCard key={i} {...c} loading={loading} testId={`kpi-${i}`} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <ChartCard title="Monthly Revenue vs Target" subtitle="FY 2025-26 (₹)" testId="chart-revenue">
            <AreaChartView data={charts.revenue_monthly || []} xKey="m" keys={[{ key: "revenue", name: "Revenue" }]} />
          </ChartCard>
        </div>
        <ChartCard title="Revenue by Service" testId="chart-service">
          <DonutChartView data={serviceRevenue} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ChartCard title="GST vs Income Tax Filing Trend" testId="chart-filing">
          <LineChartView data={charts.filing_trend || []} xKey="m" keys={[{ key: "gst", name: "GST" }, { key: "itr", name: "ITR" }]} />
        </ChartCard>
        <ChartCard title="Monthly Customer Growth" testId="chart-growth">
          <BarChartView data={charts.customer_growth || []} xKey="m" keys={[{ key: "customers", name: "New Customers" }]} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ChartCard title="Project Status" testId="chart-projects">
          <DonutChartView data={statusData} />
        </ChartCard>
        <ChartCard title="Employee Performance" testId="chart-performance">
          <BarChartView data={charts.performance || []} xKey="name" keys={[{ key: "score", name: "Score" }]} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ActivityFeed items={recentProjects.map(p => ({ title: `${p.name} — ${p.status}`, time: p.due_date ? `Due ${p.due_date}` : "Active", tag: p.service_type || "Project" }))} />
        <DueDatesWidget items={projects.filter(p => p.due_date).slice(0, 6).map(p => ({ title: p.name, date: p.due_date, type: p.service_type || "Project" }))} />
      </div>
      <RemindersWidget />
    </div>
  );
}
