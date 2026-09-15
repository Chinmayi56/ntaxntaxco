import { useState } from "react";
import { Download, Printer, Eye } from "lucide-react";
import { useCrud } from "@/hooks/useCrud";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { exportInvoicePDF } from "@/lib/exports";
import { inr } from "@/lib/utils";
import { Receipt, CheckCircle2, Clock, AlertCircle } from "lucide-react";

function InvoicePreview({ inv }) {
  const Row = ({ l, v, bold }) => (
    <div className={`flex justify-between py-1.5 ${bold ? "font-semibold text-zinc-900 border-t border-zinc-200 mt-1 pt-2" : "text-zinc-600"}`}>
      <span>{l}</span><span>{v}</span>
    </div>
  );
  return (
    <div className="border border-zinc-200 rounded-xl overflow-hidden" data-testid="invoice-preview">
      <div className="bg-brand px-6 py-4">
        <p className="font-heading text-lg font-extrabold text-zinc-900">Nizam's TaX Consultancy</p>
        <p className="text-xs text-zinc-800">Indian Tax • GST • Accounting • Compliance</p>
      </div>
      <div className="p-6">
        <div className="flex justify-between text-sm mb-4">
          <div>
            <p className="text-xs text-zinc-400 uppercase tracking-wider">Bill To</p>
            <p className="font-medium text-zinc-900">{inv.customer}</p>
            <p className="text-xs text-zinc-500">GSTIN: {inv.gst_number}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-400 uppercase tracking-wider">Invoice</p>
            <p className="font-medium text-zinc-900">{inv.invoice_no}</p>
            <p className="text-xs text-zinc-500">{inv.invoice_date}</p>
          </div>
        </div>
        <div className="text-sm">
          <Row l="Taxable Amount" v={inr(inv.taxable)} />
          <Row l="Discount" v={`- ${inr(inv.discount)}`} />
          <Row l={`CGST (${inv.rate / 2}%)`} v={inr(inv.cgst)} />
          <Row l={`SGST (${inv.rate / 2}%)`} v={inr(inv.sgst)} />
          <Row l={`IGST (${inv.rate}%)`} v={inr(inv.igst)} />
          <Row l="Grand Total" v={inr(inv.total)} bold />
        </div>
        <div className="mt-4 flex items-center justify-between">
          <StatusBadge value={inv.payment_status} />
          <span className="text-xs text-zinc-400">Computer-generated invoice</span>
        </div>
      </div>
    </div>
  );
}

export default function Invoices() {
  const { rows, loading } = useCrud("invoices");
  const [preview, setPreview] = useState(null);

  const paid = rows.filter((r) => r.payment_status === "Paid");
  const pending = rows.filter((r) => r.payment_status === "Pending");
  const overdue = rows.filter((r) => r.payment_status === "Overdue");
  const totalRev = rows.reduce((s, r) => s + r.total, 0);

  const columns = [
    { key: "invoice_no", label: "Invoice No" },
    { key: "customer", label: "Customer" },
    { key: "gst_number", label: "GSTIN" },
    { key: "taxable", label: "Taxable", render: (r) => inr(r.taxable), exportValue: (r) => r.taxable },
    { key: "total", label: "Total", render: (r) => inr(r.total), exportValue: (r) => r.total },
    { key: "payment_status", label: "Payment", render: (r) => <StatusBadge value={r.payment_status} /> },
    {
      key: "actions", label: "Actions",
      render: (r) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPreview(r)} data-testid={`preview-${r.id}`}><Eye className="h-4 w-4 text-zinc-500" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => exportInvoicePDF(r)} data-testid={`pdf-${r.id}`}><Download className="h-4 w-4 text-brand-hover" /></Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Invoices" breadcrumb={["Super Admin", "Invoices"]} subtitle="GST invoices with CGST/SGST/IGST breakup and branded PDFs." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard title="Total Billed" value={inr(totalRev)} icon={Receipt} loading={loading} testId="inv-total" />
        <KpiCard title="Paid Invoices" value={paid.length} icon={CheckCircle2} loading={loading} testId="inv-paid" />
        <KpiCard title="Pending" value={pending.length} icon={Clock} loading={loading} testId="inv-pending" />
        <KpiCard title="Overdue" value={overdue.length} icon={AlertCircle} loading={loading} testId="inv-overdue" />
      </div>
      <DataTable title="Invoices" columns={columns} rows={rows} loading={loading} pageSize={8} testId="invoices-table" />

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="bg-white max-w-lg">
          <DialogHeader><DialogTitle className="font-heading">Invoice Preview</DialogTitle></DialogHeader>
          {preview && (
            <>
              <InvoicePreview inv={preview} />
              <div className="flex justify-end gap-2 mt-2">
                <Button variant="outline" className="border-zinc-300" onClick={() => window.print()} data-testid="print-invoice"><Printer className="h-4 w-4 mr-1.5" />Print</Button>
                <Button className="bg-brand text-zinc-900 hover:bg-brand-hover font-semibold" onClick={() => exportInvoicePDF(preview)} data-testid="download-invoice"><Download className="h-4 w-4 mr-1.5" />Download PDF</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
