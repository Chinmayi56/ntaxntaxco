import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  CheckCircle2, Loader2, Upload, X, FileText, CalendarClock, User, ChevronRight, ChevronLeft, Download, LayoutDashboard, Sparkles,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { exportPDF } from "@/lib/exports";
import { inr } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STEPS = ["Details", "Schedule & Docs", "Review"];

export default function BookServiceModal({ open, onOpenChange, preselectService }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [codOpen, setCodOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [services, setServices] = useState([]);
  const [agents, setAgents] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState(false);
  const [pendingBookingId, setPendingBookingId] = useState(null);
  useEffect(() => {
    if (!open || !user) return;
    let active = true;
    // Services and agents are fetched independently: agents is an
    // admin-only endpoint (403 for a customer, by design) and must never
    // block the service catalogue from loading. Previously these were
    // fetched together with Promise.all, so the expected agents 403 for a
    // customer caused the whole call to reject and the service list to
    // silently stay empty.
    setServicesLoading(true);
    setServicesError(false);
    (async () => {
      try {
        const svcRes = await api.get("/services");
        if (!active) return;
        setServices(svcRes.data?.data || []);
      } catch (e) {
        if (!active) return;
        setServicesError(true);
        toast.error("Unable to load the current service catalogue.");
      } finally {
        if (active) setServicesLoading(false);
      }
    })();
    (async () => {
      try {
        const agentRes = await api.get("/agents");
        if (!active) return;
        setAgents(agentRes.data?.data || []);
      } catch (e) {
        // Non-fatal: consultant assignment is a display-only nicety here,
        // and a customer is not expected to have access to this endpoint.
      }
    })();
    return () => { active = false; };
  }, [open, user]);

  const [form, setForm] = useState({
    customer_name: user?.name || "", company: user?.name || "", email: user?.email || "",
    mobile: user?.mobile || "", gst: "", pan: "", business_type: "",
    city: "", state: "", pincode: "", service: preselectService || "", project_name: "",
    description: "", project_value: "", turnover: "", start_date: "", completion_date: "", urgency: "Normal",
    appt_date: "", appt_time: "11:00 AM", mode: "Google Meet", notes: "", accurate: false, terms: false,
  });
  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));
  const consultant = agents.find(a => a.name === form.assigned_agent) || agents[0] || {};
  const selectedService = services.find(s => (s.title || s.name) === form.service);
  const fee = Number(selectedService?.price || form.project_value || 0);
  const gst = Math.round(fee * 0.18);
  const total = fee + gst;

  const reset = () => { setStep(0); setResult(null); setFiles([]); setPendingBookingId(null); setCodOpen(false); };

  const next = () => {
    if (!user) {
      toast.info("Please sign in or create a customer account before booking a service.");
      onOpenChange(false);
      navigate("/login", { state: { from: { pathname: "/customer/services" } } });
      return;
    }
    if (step === 0) {
      if (!form.service) return toast.error("Please select a service");
      if (!form.company.trim()) return toast.error("Company name is required");
    }
    setStep((s) => Math.min(s + 1, 2));
  };

  const submit = async () => {
    if (!user) {
      toast.info("Please sign in or create a customer account before booking.");
      onOpenChange(false);
      navigate("/login");
      return;
    }
    if (!form.accurate || !form.terms) return toast.error("Please accept the confirmations to continue");
    setSaving(true);
    try {
      setCodOpen(true);
        } catch (e) {
      console.error("BOOKING ERROR:", e);
      toast.error(e.response?.data?.detail || e.response?.data?.message || e.message || "Could not create booking. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const confirmCOD = async () => {
    setSaving(true);
    try {
      const payload = {
        customer: form.company || user.name,
        customer_id: user.id,
        service: form.service,
        assigned_employee: form.assigned_employee || "",
        assigned_agent: consultant.name || "",
        booking_date: new Date().toISOString().slice(0, 10),
        due_date: form.completion_date || "",
        priority: form.urgency === "Normal" ? "Low" : form.urgency === "High" ? "Medium" : "High",
        status: "Pending",
        payment_status: "Pending",
        contact_person: form.customer_name || user.name,
        email: form.email || user.email,
        mobile: form.mobile || user.mobile,
        gst_number: form.gst,
        pan: form.pan,
        project_name: form.project_name,
        project_value: Number(form.project_value) || 0,
        mode: form.mode,
        appointment_date: form.appt_date,
        appointment_time: form.appt_time,
        notes: form.notes,
        estimated_fee: total,
        documents: files.length,
      };
      const { data } = await api.post("/bookings", payload);
      const bookingId = data?.data?.id;
      if (!bookingId) throw new Error("Booking was created without a booking ID.");
      setPendingBookingId(bookingId);
      const reference = bookingId;
      setResult({
        booking_id: bookingId,
        ticket: "TKT-" + bookingId.replace("BKG-", ""),
        reference,
        service: form.service,
        consultant: consultant.name,
        completion: form.completion_date || "Within 7 working days",
        status: "Pending",
        total,
        payment_id: "",
        txn_ref: "",
        payment_status: "Pending",
        date: new Date().toISOString().slice(0, 10),
      });
      setCodOpen(false);
      toast.success("Service booking submitted successfully.");
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message || "Could not confirm the booking.");
    } finally {
      setSaving(false);
    }
  };

  const receipt = () => {
    exportPDF(`Booking ${result.booking_id}`, [{ key: "k", label: "Field" }, { key: "v", label: "Value" }], [
      { k: "Booking ID", v: result.booking_id }, { k: "Reference No.", v: result.reference }, { k: "Ticket", v: result.ticket },
      { k: "Service", v: result.service }, { k: "Customer", v: form.company }, { k: "Consultant", v: result.consultant },
      { k: "Payment ID", v: result.payment_id || "-" }, { k: "Transaction Ref", v: result.txn_ref || result.reference },
      { k: "Invoice No.", v: result.invoice_no || "-" }, { k: "Receipt No.", v: result.receipt_no || "-" },
      { k: "Amount Paid", v: inr(result.total) }, { k: "Payment Status", v: result.payment_status || "Pending" },
      { k: "Est. Completion", v: result.completion }, { k: "Status", v: result.status },
    ]);
    toast.success("Booking receipt downloaded");
  };

  const close = (o) => { if (!o) { reset(); } onOpenChange(o); };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="bg-white max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="book-service-modal">
        {!result ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-heading text-xl text-[#0A2540]">Book a Service</DialogTitle>
            </DialogHeader>
            {/* Stepper */}
            <div className="flex items-center gap-2 my-3">
              {STEPS.map((s, i) => (
                <div key={s} className="flex items-center gap-2 flex-1">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i <= step ? "bg-royal text-white" : "bg-zinc-100 text-zinc-500"}`}>{i + 1}</div>
                  <span className={`text-xs font-medium ${i <= step ? "text-zinc-900" : "text-zinc-400"}`}>{s}</span>
                  {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 ${i < step ? "bg-royal" : "bg-zinc-100"}`} />}
                </div>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
                {step === 0 && (
                  <div className="space-y-4">
                    <div><Label className="text-sm font-medium text-zinc-700">Select Service *</Label>
                      <Select value={form.service} onValueChange={(v) => set("service", v)} disabled={servicesLoading}>
                        <SelectTrigger className="mt-1.5 border-zinc-300" data-testid="bs-service">
                          <SelectValue placeholder={servicesLoading ? "Loading services..." : "Choose a service"} />
                        </SelectTrigger>
                        <SelectContent className="bg-white max-h-64">
                          {services.map((s) => <SelectItem key={s.id} value={s.title || s.name}>{s.title || s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {!servicesLoading && servicesError && (
                        <p className="text-xs text-red-600 mt-1.5">Unable to load services. Please try again.</p>
                      )}
                      {!servicesLoading && !servicesError && services.length === 0 && (
                        <p className="text-xs text-zinc-500 mt-1.5">No services are currently available.</p>
                      )}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div><Label className="text-xs text-zinc-600">Contact Name</Label><Input value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} className="mt-1 border-zinc-300" data-testid="bs-name" /></div>
                      <div><Label className="text-xs text-zinc-600">Company Name *</Label><Input value={form.company} onChange={(e) => set("company", e.target.value)} className="mt-1 border-zinc-300" data-testid="bs-company" /></div>
                      <div><Label className="text-xs text-zinc-600">Email</Label><Input value={form.email} onChange={(e) => set("email", e.target.value)} className="mt-1 border-zinc-300" /></div>
                      <div><Label className="text-xs text-zinc-600">Mobile</Label><Input value={form.mobile} onChange={(e) => set("mobile", e.target.value)} className="mt-1 border-zinc-300" /></div>
                      <div><Label className="text-xs text-zinc-600">GSTIN</Label><Input value={form.gst} onChange={(e) => set("gst", e.target.value)} className="mt-1 border-zinc-300" /></div>
                      <div><Label className="text-xs text-zinc-600">PAN</Label><Input value={form.pan} onChange={(e) => set("pan", e.target.value)} className="mt-1 border-zinc-300" /></div>
                      <div><Label className="text-xs text-zinc-600">Project / Business Name</Label><Input value={form.project_name} onChange={(e) => set("project_name", e.target.value)} className="mt-1 border-zinc-300" data-testid="bs-project" /></div>
                      <div><Label className="text-xs text-zinc-600">Estimated Project Value (₹)</Label><Input type="number" value={form.project_value} onChange={(e) => set("project_value", e.target.value)} className="mt-1 border-zinc-300" /></div>
                    </div>
                    <div><Label className="text-xs text-zinc-600">Project Description</Label><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Describe your requirements in detail." className="mt-1 border-zinc-300" /></div>
                  </div>
                )}
                {step === 1 && (
                  <div className="space-y-4">
                    <div className="grid sm:grid-cols-3 gap-3">
                      <div><Label className="text-xs text-zinc-600">Start Date</Label><Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} className="mt-1 border-zinc-300" /></div>
                      <div><Label className="text-xs text-zinc-600">Required Completion</Label><Input type="date" value={form.completion_date} onChange={(e) => set("completion_date", e.target.value)} className="mt-1 border-zinc-300" data-testid="bs-completion" /></div>
                      <div><Label className="text-xs text-zinc-600">Urgency</Label>
                        <Select value={form.urgency} onValueChange={(v) => set("urgency", v)}><SelectTrigger className="mt-1 border-zinc-300"><SelectValue /></SelectTrigger><SelectContent className="bg-white">{["Normal", "High", "Critical"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select>
                      </div>
                      <div><Label className="text-xs text-zinc-600">Preferred Date</Label><Input type="date" value={form.appt_date} onChange={(e) => set("appt_date", e.target.value)} className="mt-1 border-zinc-300" /></div>
                      <div><Label className="text-xs text-zinc-600">Preferred Time</Label><Input value={form.appt_time} onChange={(e) => set("appt_time", e.target.value)} className="mt-1 border-zinc-300" /></div>
                      <div><Label className="text-xs text-zinc-600">Meeting Mode</Label>
                        <Select value={form.mode} onValueChange={(v) => set("mode", v)}><SelectTrigger className="mt-1 border-zinc-300"><SelectValue /></SelectTrigger><SelectContent className="bg-white">{["Office Visit", "Phone Call", "Google Meet", "Microsoft Teams", "Zoom"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-zinc-600">Upload Documents</Label>
                      <label className="mt-1 flex items-center justify-center gap-2 border-2 border-dashed border-zinc-300 rounded-xl py-6 cursor-pointer hover:border-royal transition-colors" data-testid="bs-upload">
                        <Upload className="h-5 w-5 text-zinc-400" /><span className="text-sm text-zinc-500">Click to upload (PDF, JPG, PNG, DOCX, XLSX)</span>
                        <input type="file" multiple className="hidden" onChange={(e) => setFiles((f) => [...f, ...Array.from(e.target.files).map((x) => x.name)])} />
                      </label>
                      {files.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{files.map((f, i) => (<span key={i} className="inline-flex items-center gap-1 text-xs bg-zinc-100 rounded-full px-2.5 py-1"><FileText className="h-3 w-3" />{f}<button onClick={() => setFiles((s) => s.filter((_, x) => x !== i))}><X className="h-3 w-3 text-zinc-500" /></button></span>))}</div>}
                    </div>
                    <div><Label className="text-xs text-zinc-600">Additional Notes</Label><Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Anything else we should know?" className="mt-1 border-zinc-300" /></div>
                  </div>
                )}
                {step === 2 && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-zinc-200 p-4 bg-royal-faint/40 flex items-center gap-3" data-testid="bs-consultant">
                      <div className="h-12 w-12 rounded-full bg-royal text-white flex items-center justify-center font-bold">{consultant.initials}</div>
                      <div className="flex-1"><p className="text-sm font-semibold text-zinc-900">Assigned Consultant: {consultant.name}</p><p className="text-xs text-muted-foreground">{consultant.spec} · {consultant.exp} · ★ {consultant.rating}</p></div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Available</span>
                    </div>
                    <div className="rounded-xl border border-zinc-200 p-4">
                      <p className="text-sm font-semibold text-zinc-900 mb-2">Payment Estimation</p>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">Service Fee</span><span>{inr(fee)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">GST (18%)</span><span>{inr(gst)}</span></div>
                        <div className="flex justify-between font-bold text-zinc-900 border-t border-zinc-100 pt-1.5"><span>Total Estimate</span><span>{inr(total)}</span></div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-zinc-200 p-4 text-sm grid sm:grid-cols-2 gap-y-1.5">
                      <div className="flex justify-between sm:block"><span className="text-muted-foreground sm:text-xs">Service</span><span className="font-medium sm:block">{form.service || "—"}</span></div>
                      <div className="flex justify-between sm:block"><span className="text-muted-foreground sm:text-xs">Company</span><span className="font-medium sm:block">{form.company || "—"}</span></div>
                      <div className="flex justify-between sm:block"><span className="text-muted-foreground sm:text-xs">Mode</span><span className="font-medium sm:block">{form.mode}</span></div>
                      <div className="flex justify-between sm:block"><span className="text-muted-foreground sm:text-xs">Urgency</span><span className="font-medium sm:block">{form.urgency}</span></div>
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm text-zinc-700"><Checkbox checked={form.accurate} onCheckedChange={(v) => set("accurate", !!v)} data-testid="bs-accurate" />I confirm the provided information is accurate.</label>
                      <label className="flex items-center gap-2 text-sm text-zinc-700"><Checkbox checked={form.terms} onCheckedChange={(v) => set("terms", !!v)} data-testid="bs-terms" />I agree to the Terms &amp; Conditions.</label>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="flex items-center justify-between mt-5 pt-4 border-t border-zinc-100">
              <Button variant="outline" className="border-zinc-300" disabled={step === 0} onClick={() => setStep((s) => s - 1)}><ChevronLeft className="h-4 w-4 mr-1" />Back</Button>
              {step < 2 ? (
                <Button className="bg-royal text-white hover:bg-royal-hover font-semibold" onClick={next} data-testid="bs-next">Continue<ChevronRight className="h-4 w-4 ml-1" /></Button>
              ) : (
                <Button className="bg-brand text-[#0A2540] hover:bg-brand-hover font-bold" onClick={submit} disabled={saving} data-testid="bs-submit">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Proceed to Payment"}</Button>
              )}
            </div>
          </>
        ) : (
          <div className="py-4 text-center" data-testid="bs-success">
            <div className="h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4"><CheckCircle2 className="h-9 w-9 text-emerald-600" /></div>
            <h3 className="font-heading text-xl font-bold text-[#0A2540]">Service Booked — Confirmation Complete!</h3>
            <p className="text-sm text-muted-foreground mt-1">Your service booking is confirmed. Payment method: Cash on Delivery.</p>
            <div className="mt-5 rounded-xl border border-zinc-200 p-4 text-left text-sm space-y-2">
              {[["Booking ID", result.booking_id], ["Reference No.", result.reference], ["Payment ID", result.payment_id], ["Transaction Ref", result.txn_ref], ["Invoice No.", result.invoice_no], ["Receipt No.", result.receipt_no], ["Service", result.service], ["Assigned Consultant", result.consultant], ["Amount Paid", inr(result.total)], ["Payment Status", result.payment_status], ["Est. Completion", result.completion], ["Status", result.status]].filter((r) => r[1]).map((r) => (
                <div key={r[0]} className="flex justify-between border-b border-zinc-100 last:border-0 pb-1.5"><span className="text-muted-foreground">{r[0]}</span><span className="font-medium text-zinc-900">{r[1]}</span></div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-5">
              <Button variant="outline" className="border-zinc-300" onClick={receipt} data-testid="bs-receipt"><Download className="h-4 w-4 mr-1.5" />Download Receipt</Button>
              <Button variant="outline" className="border-zinc-300" onClick={() => { close(false); navigate("/customer/bookings"); }}>Track Booking</Button>
              <Button className="bg-royal text-white hover:bg-royal-hover font-semibold" onClick={() => { close(false); navigate("/customer/dashboard"); }}><LayoutDashboard className="h-4 w-4 mr-1.5" />Go to Dashboard</Button>
            </div>
          </div>
        )}
      </DialogContent>
      <Dialog open={codOpen} onOpenChange={(o) => !o && !saving && setCodOpen(false)}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader><DialogTitle className="font-heading text-xl text-[#0A2540]">Choose Payment Method</DialogTitle></DialogHeader>
          <div className="rounded-2xl border-2 border-[#FFB800] bg-[#FFB800]/10 p-5">
            <p className="font-heading font-bold text-[#0A2540]">Cash on Delivery</p>
            <p className="text-sm text-slate-600 mt-1">No online payment is required now. Your service will be booked and the amount will remain pending for collection.</p>
            <div className="flex justify-between mt-4 pt-4 border-t border-[#FFB800]/30 font-semibold"><span>Total</span><span>{inr(total)}</span></div>
          </div>
          <Button onClick={confirmCOD} disabled={saving} className="w-full bg-brand text-[#0A2540] hover:bg-brand-hover font-bold h-11">
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Confirming...</> : "Proceed with Cash on Delivery"}
          </Button>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
