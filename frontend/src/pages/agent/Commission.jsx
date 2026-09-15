import { useCrud } from "@/hooks/useCrud";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import { KpiCard } from "@/components/shared/KpiCard";
import { ChartCard, BarChartView } from "@/components/shared/Charts";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Landmark, TrendingUp, Clock, CheckCircle2 } from "lucide-react";
import { inr } from "@/lib/utils";

export default function Commission() {
  const { rows, loading } = useCrud("commissions");
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const paid = rows.filter((r) => r.status === "Paid").reduce((s, r) => s + r.amount, 0);
  const pending = rows.filter((r) => r.status === "Pending").reduce((s, r) => s + r.amount, 0);

  const columns = [
    { key: "period", label: "Period" },
    { key: "sales", label: "Sales", render: (r) => inr(r.sales), exportValue: (r) => r.sales },
    { key: "rate", label: "Rate", render: (r) => `${r.rate}%` },
    { key: "amount", label: "Commission", render: (r) => inr(r.amount), exportValue: (r) => r.amount },
    { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
  ];

  return (
    <div>
      <PageHeader title="Commission" breadcrumb={["Tax Consultant", "Commission"]} subtitle="Your monthly sales and commission earnings." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard title="Total Commission" value={inr(total)} icon={Landmark} loading={loading} testId="com-total" />
        <KpiCard title="This Month" value={inr(rows[0]?.amount || 0)} icon={TrendingUp} loading={loading} testId="com-month" />
        <KpiCard title="Paid" value={inr(paid)} icon={CheckCircle2} loading={loading} testId="com-paid" />
        <KpiCard title="Pending" value={inr(pending)} icon={Clock} loading={loading} testId="com-pending" />
      </div>
      <div className="mb-6">
        <ChartCard title="Commission Trend (₹)" testId="com-chart">
          <BarChartView data={[...rows].reverse()} xKey="period" keys={[{ key: "amount", name: "Commission" }]} />
        </ChartCard>
      </div>
      <DataTable title="Commission Statements" columns={columns} rows={rows} loading={loading} pageSize={8} testId="commission-table" />
    </div>
  );
}
